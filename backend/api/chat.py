from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime
import time
import uuid
import logging
import json

from models.schemas import ChatRequest, ChatResponse
from services.database import get_collection
from utils.auth import get_current_user
from utils.config import settings
from agents.agent_router import classify_intent, route_and_respond, AGENT_SYSTEM_PROMPTS
from rag.vector_store import get_rag_context, load_index
from google import genai

router = APIRouter()
logger = logging.getLogger(__name__)

# Try to load FAISS index on startup
try:
    load_index()
except Exception as e:
    logger.warning(f"Could not load FAISS index: {e}")


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Process a chat message through the multi-agent pipeline."""
    start_time = time.time()
    user_id = current_user["id"]
    session_id = request.session_id or str(uuid.uuid4())

    try:
        # 1. Get conversation history
        conversations = get_collection("conversations")
        conv = await conversations.find_one(
            {"user_id": user_id, "session_id": session_id}
        )
        history = conv.get("messages", []) if conv else []

        # 2. Classify intent(s)
        intents = await classify_intent(request.message)
        logger.info(f"Intents detected: {intents} for session {session_id}")

        # 3. RAG - get relevant context
        rag_context, sources = get_rag_context(request.message)

        # 4. Route to agent(s) and get response
        result = await route_and_respond(
            query=request.message,
            intents=intents,
            rag_context=rag_context,
            conversation_history=history,
        )

        response_text = result["response"]
        agents_used = result["agents_used"]
        elapsed_ms = (time.time() - start_time) * 1000

        # 5. Save to conversation history
        user_msg = {
            "role": "user",
            "content": request.message,
            "timestamp": datetime.utcnow(),
        }
        assistant_msg = {
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.utcnow(),
            "agent_used": agents_used,
            "intents": intents,
        }

        now = datetime.utcnow()
        if conv:
            await conversations.update_one(
                {"user_id": user_id, "session_id": session_id},
                {
                    "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
                    "$set": {"updated_at": now},
                },
            )
        else:
            await conversations.insert_one(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "messages": [user_msg, assistant_msg],
                    "created_at": now,
                    "updated_at": now,
                }
            )

        # 6. Save analytics
        analytics = get_collection("analytics")
        await analytics.insert_one(
            {
                "user_id": user_id,
                "session_id": session_id,
                "intents": intents,
                "agents_used": agents_used,
                "response_time_ms": elapsed_ms,
                "timestamp": now,
                "message_length": len(request.message),
            }
        )

        return ChatResponse(
            response=response_text,
            session_id=session_id,
            intents=intents,
            agents_used=agents_used,
            response_time_ms=elapsed_ms,
            sources=sources if sources else None,
        )

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Streaming chat endpoint using Server-Sent Events."""
    user_id = current_user["id"]
    session_id = request.session_id or str(uuid.uuid4())

    async def generate():
        try:
            # Send session_id first
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

            # Classify intent
            intents = await classify_intent(request.message)
            yield f"data: {json.dumps({'type': 'intents', 'intents': intents})}\n\n"

            # Get RAG context
            rag_context, sources = get_rag_context(request.message)

            # Pick primary agent system prompt
            agent_type = intents[0] if intents else "faq"
            system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_type, AGENT_SYSTEM_PROMPTS["faq"])

            if rag_context:
                system_prompt += f"\n\n=== KNOWLEDGE BASE CONTEXT ===\n{rag_context}\n=== END CONTEXT ==="

            # Stream using new google.genai package
            client = genai.Client(api_key=settings.GOOGLE_API_KEY)
            full_response = ""
            full_prompt = f"{system_prompt}\n\nUser: {request.message}"

            for chunk in client.models.generate_content_stream(
                model=settings.GEMINI_MODEL,
                contents=full_prompt
            ):
                if chunk.text:
                    full_response += chunk.text
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.text})}\n\n"

            # Save to DB
            now = datetime.utcnow()
            conversations = get_collection("conversations")
            conv = await conversations.find_one(
                {"user_id": user_id, "session_id": session_id}
            )

            msgs = [
                {"role": "user", "content": request.message, "timestamp": now},
                {
                    "role": "assistant",
                    "content": full_response,
                    "timestamp": now,
                    "agent_used": intents,
                    "intents": intents,
                },
            ]

            if conv:
                await conversations.update_one(
                    {"user_id": user_id, "session_id": session_id},
                    {"$push": {"messages": {"$each": msgs}}, "$set": {"updated_at": now}},
                )
            else:
                await conversations.insert_one(
                    {
                        "user_id": user_id,
                        "session_id": session_id,
                        "messages": msgs,
                        "created_at": now,
                        "updated_at": now,
                    }
                )

            # Save analytics
            analytics = get_collection("analytics")
            await analytics.insert_one(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "intents": intents,
                    "agents_used": intents,
                    "response_time_ms": 0,
                    "timestamp": now,
                    "message_length": len(request.message),
                }
            )

            yield f"data: {json.dumps({'type': 'done', 'agents_used': intents, 'sources': sources})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
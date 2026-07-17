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
from agents.agent_router import (
    analyze_query, route_and_respond, AGENT_SYSTEM_PROMPTS, PRIVACY_FALLBACK_PROMPT,
    RESPONSE_LENGTH_INSTRUCTIONS, LANGUAGE_NAMES, get_language_instruction,
    get_frustration_instruction,
)
from rag.vector_store import get_rag_context, load_index
from api.user import DEFAULT_PREFERENCES
from google import genai

router = APIRouter()
logger = logging.getLogger(__name__)

# Try to load FAISS index on startup
try:
    load_index()
except Exception as e:
    logger.warning(f"Could not load FAISS index: {e}")

FRUSTRATION_AUTO_COMPLAINT_THRESHOLD = 4


def _resolve_rag_context(query_for_retrieval: str, intents: list):
    """
    Resolve RAG context. query_for_retrieval should be the English-translated
    version of the customer's message — your knowledge base PDFs are all in
    English, so retrieval quality is meaningfully better against English text
    even when the customer wrote in another language.
    """
    priority_filename = "PrivacyPolicy.pdf" if "privacy" in intents else None
    context, sources, is_confident, best_score = get_rag_context(
        query_for_retrieval, priority_filename=priority_filename
    )
    return context, sources, is_confident, best_score


def _resolve_preferences(current_user: dict) -> dict:
    """Merge stored preferences with defaults so every field always has a value."""
    stored = current_user.get("preferences", {})
    return {**DEFAULT_PREFERENCES, **stored}


def _resolve_response_language(prefs: dict, detected_language_name: str) -> str:
    """
    If the user has an explicit response_language preference set (not
    'auto'), that always wins — even if they type in a different language.
    Otherwise, respond in whatever language the customer's message was
    detected in.
    """
    pref_lang_code = prefs.get("response_language", "auto")
    if pref_lang_code and pref_lang_code != "auto":
        return LANGUAGE_NAMES.get(pref_lang_code) or detected_language_name
    return detected_language_name


def _apply_frustration_routing(intents: list, frustration_level: int) -> list:
    """High frustration auto-includes the Complaint agent for extra empathy,
    even when the literal topic (e.g. billing) wasn't classified as a complaint."""
    if frustration_level >= FRUSTRATION_AUTO_COMPLAINT_THRESHOLD and "complaint" not in intents:
        return intents + ["complaint"]
    return intents


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Process a chat message through the multi-agent pipeline."""
    start_time = time.time()
    user_id = current_user["id"]
    session_id = request.session_id or str(uuid.uuid4())
    prefs = _resolve_preferences(current_user)

    try:
        # 1. Get conversation history
        conversations = get_collection("conversations")
        conv = await conversations.find_one(
            {"user_id": user_id, "session_id": session_id}
        )
        history = conv.get("messages", []) if conv else []

        # 2. Analyze query: intents + language detection/translation + sentiment
        analysis = await analyze_query(request.message)
        intents = _apply_frustration_routing(analysis["intents"], analysis["frustration_level"])
        response_language = _resolve_response_language(prefs, analysis["language_name"])
        logger.info(
            f"Session {session_id}: intents={intents} lang={analysis['language_code']} "
            f"frustration={analysis['frustration_level']}"
        )

        # 3. RAG - retrieve using the English-translated query for better match quality
        rag_context, sources, is_confident, best_score = _resolve_rag_context(
            analysis["query_english"], intents
        )
        if "privacy" in intents:
            logger.info(f"Privacy retrieval confidence: {best_score:.3f} (confident={is_confident})")

        # 4. Route to agent(s), applying language + sentiment + AI preferences
        result = await route_and_respond(
            query=request.message,
            intents=intents,
            rag_context=rag_context,
            conversation_history=history,
            privacy_confident=is_confident,
            response_length=prefs.get("response_length", "balanced"),
            model=prefs.get("ai_model") or settings.GEMINI_MODEL,
            language_name=response_language,
            frustration_level=analysis["frustration_level"],
        )

        response_text = result["response"]
        agents_used = result["agents_used"]
        elapsed_ms = (time.time() - start_time) * 1000

        # 5. Save to conversation history
        user_msg = {
            "role": "user",
            "content": request.message,
            "timestamp": datetime.utcnow(),
            "language_code": analysis["language_code"],
            "language_name": analysis["language_name"],
        }
        assistant_msg = {
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.utcnow(),
            "agent_used": agents_used,
            "intents": intents,
            "language_code": analysis["language_code"],
            "language_name": response_language,
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

        # 6. Save analytics — now including language and frustration signal
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
                "language_code": analysis["language_code"],
                "language_name": analysis["language_name"],
                "frustration_level": analysis["frustration_level"],
            }
        )

        show_sources = sources if (sources and prefs.get("show_citations", True)) else None

        return ChatResponse(
            response=response_text,
            session_id=session_id,
            intents=intents,
            agents_used=agents_used,
            response_time_ms=elapsed_ms,
            sources=show_sources,
            language_code=analysis["language_code"],
            language_name=analysis["language_name"],
            frustration_level=analysis["frustration_level"],
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
    prefs = _resolve_preferences(current_user)

    async def generate():
        try:
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

            # Analyze: intents + language + sentiment, one call
            analysis = await analyze_query(request.message)
            intents = _apply_frustration_routing(analysis["intents"], analysis["frustration_level"])
            response_language = _resolve_response_language(prefs, analysis["language_name"])

            yield f"data: {json.dumps({'type': 'intents', 'intents': intents})}\n\n"
            yield f"data: {json.dumps({'type': 'language', 'language_code': analysis['language_code'], 'language_name': analysis['language_name']})}\n\n"

            logger.info(
                f"Session {session_id}: intents={intents} lang={analysis['language_code']} "
                f"frustration={analysis['frustration_level']}"
            )

            # RAG using English-translated query for better retrieval quality
            rag_context, sources, is_confident, best_score = _resolve_rag_context(
                analysis["query_english"], intents
            )
            if "privacy" in intents:
                logger.info(f"Privacy retrieval confidence: {best_score:.3f} (confident={is_confident})")

            agent_type = intents[0] if intents else "faq"
            response_length = prefs.get("response_length", "balanced")
            model_override = prefs.get("ai_model") or settings.GEMINI_MODEL

            if agent_type == "privacy" and not is_confident:
                system_prompt = PRIVACY_FALLBACK_PROMPT
            else:
                system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_type, AGENT_SYSTEM_PROMPTS["faq"])
                if rag_context:
                    system_prompt += f"\n\n=== NOVATECH KNOWLEDGE BASE CONTEXT ===\n{rag_context}\n=== END CONTEXT ==="

            system_prompt += RESPONSE_LENGTH_INSTRUCTIONS.get(response_length, "")
            system_prompt += get_language_instruction(response_language)
            system_prompt += get_frustration_instruction(analysis["frustration_level"])

            client = genai.Client(api_key=settings.GOOGLE_API_KEY)
            full_response = ""
            full_prompt = f"{system_prompt}\n\nUser: {request.message}"

            for chunk in client.models.generate_content_stream(
                model=model_override,
                contents=full_prompt
            ):
                if chunk.text:
                    full_response += chunk.text
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.text})}\n\n"

            now = datetime.utcnow()
            conversations = get_collection("conversations")
            conv = await conversations.find_one(
                {"user_id": user_id, "session_id": session_id}
            )

            msgs = [
                {
                    "role": "user", "content": request.message, "timestamp": now,
                    "language_code": analysis["language_code"], "language_name": analysis["language_name"],
                },
                {
                    "role": "assistant", "content": full_response, "timestamp": now,
                    "agent_used": intents, "intents": intents,
                    "language_code": analysis["language_code"], "language_name": response_language,
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
                    "language_code": analysis["language_code"],
                    "language_name": analysis["language_name"],
                    "frustration_level": analysis["frustration_level"],
                }
            )

            show_sources = sources if prefs.get("show_citations", True) else []

            yield f"data: {json.dumps({'type': 'done', 'agents_used': intents, 'sources': show_sources, 'frustration_level': analysis['frustration_level']})}\n\n"

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

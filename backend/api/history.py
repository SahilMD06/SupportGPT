from fastapi import APIRouter, Depends, HTTPException
from typing import List
from bson import ObjectId

from models.schemas import ConversationResponse, ChatMessage
from services.database import get_collection
from utils.auth import get_current_user

router = APIRouter()


@router.get("", response_model=List[dict])
async def get_history(current_user: dict = Depends(get_current_user)):
    """Get all conversation sessions for the current user."""
    conversations = get_collection("conversations")
    user_id = current_user["id"]

    sessions = await conversations.find(
        {"user_id": user_id},
        {"session_id": 1, "created_at": 1, "updated_at": 1, "messages": {"$slice": 1}}
    ).sort("updated_at", -1).to_list(length=50)

    result = []
    for s in sessions:
        first_msg = s.get("messages", [{}])[0]
        result.append({
            "id": str(s["_id"]),
            "session_id": s["session_id"],
            "preview": first_msg.get("content", "")[:100] + "..."
            if len(first_msg.get("content", "")) > 100
            else first_msg.get("content", ""),
            "created_at": s.get("created_at"),
            "updated_at": s.get("updated_at"),
        })

    return result


@router.get("/{session_id}")
async def get_conversation(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific conversation by session ID."""
    conversations = get_collection("conversations")
    user_id = current_user["id"]

    conv = await conversations.find_one(
        {"user_id": user_id, "session_id": session_id}
    )

    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Serialize messages
    messages = []
    for msg in conv.get("messages", []):
        messages.append({
            "role": msg["role"],
            "content": msg["content"],
            "timestamp": msg.get("timestamp"),
            "agent_used": msg.get("agent_used"),
            "intents": msg.get("intents"),
        })

    return {
        "id": str(conv["_id"]),
        "session_id": conv["session_id"],
        "messages": messages,
        "created_at": conv.get("created_at"),
        "updated_at": conv.get("updated_at"),
    }


@router.delete("/{session_id}")
async def delete_conversation(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a specific conversation."""
    conversations = get_collection("conversations")
    user_id = current_user["id"]

    result = await conversations.delete_one(
        {"user_id": user_id, "session_id": session_id}
    )

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {"message": "Conversation deleted successfully"}

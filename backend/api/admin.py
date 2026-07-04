from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime
from bson import ObjectId

from models.schemas import RebuildEmbeddingsResponse
from services.database import get_collection
from utils.auth import get_current_admin
from rag.pdf_processor import process_all_pdfs
from rag.vector_store import rebuild_index, get_index_stats

router = APIRouter()


@router.post("/rebuild-embeddings", response_model=RebuildEmbeddingsResponse)
async def rebuild_embeddings(current_user: dict = Depends(get_current_admin)):
    """Rebuild the entire FAISS vector index from all PDFs (admin only)."""
    try:
        # Process all PDFs
        documents = process_all_pdfs()

        # Rebuild FAISS index
        total_chunks = rebuild_index(documents)

        return RebuildEmbeddingsResponse(
            status="success",
            documents_processed=len(documents),
            chunks_created=total_chunks,
            message=f"Rebuilt index with {total_chunks} chunks from {len(documents)} documents",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rebuild failed: {str(e)}")


@router.get("/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_admin)):
    """Get admin dashboard statistics."""
    users = get_collection("users")
    conversations = get_collection("conversations")
    knowledge_base = get_collection("knowledge_base")
    analytics = get_collection("analytics")

    index_stats = get_index_stats()

    return {
        "total_users": await users.count_documents({}),
        "total_conversations": await conversations.count_documents({}),
        "total_documents": await knowledge_base.count_documents({}),
        "total_chat_events": await analytics.count_documents({}),
        "faiss_index": index_stats,
    }


@router.get("/users")
async def list_users(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_admin),
):
    """List all users (admin only)."""
    users = get_collection("users")
    user_list = await users.find(
        {},
        {"password": 0}
    ).skip(skip).limit(limit).to_list(length=limit)

    return [
        {
            "id": str(u["_id"]),
            "name": u["name"],
            "email": u["email"],
            "role": u.get("role", "user"),
            "created_at": u.get("created_at"),
            "last_login": u.get("last_login"),
        }
        for u in user_list
    ]


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    current_user: dict = Depends(get_current_admin),
):
    """Update user role (admin only)."""
    if role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'user' or 'admin'")

    users = get_collection("users")
    result = await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": role, "updated_at": datetime.utcnow()}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": f"User role updated to '{role}'"}


@router.get("/conversations")
async def admin_list_conversations(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_admin),
):
    """List all conversations (admin only)."""
    conversations = get_collection("conversations")
    convs = await conversations.find(
        {},
        {"messages": {"$slice": 2}}
    ).sort("updated_at", -1).skip(skip).limit(limit).to_list(length=limit)

    return [
        {
            "id": str(c["_id"]),
            "user_id": c["user_id"],
            "session_id": c["session_id"],
            "message_count": len(c.get("messages", [])),
            "created_at": c.get("created_at"),
            "updated_at": c.get("updated_at"),
        }
        for c in convs
    ]

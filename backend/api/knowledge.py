from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from datetime import datetime
from typing import List
import os
import logging

from models.schemas import KnowledgeBaseResponse
from services.database import get_collection
from utils.auth import get_current_user, get_current_admin
from rag.pdf_processor import save_uploaded_pdf, process_pdf
from rag.vector_store import add_documents

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/upload", response_model=KnowledgeBaseResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_admin),
):
    """Upload a PDF to the knowledge base (admin only)."""
    # Validate file type
    filename = file.filename or "document.pdf"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    try:
        # Save PDF
        file_path = save_uploaded_pdf(content, filename)

        # Process PDF (extract + chunk)
        processed = process_pdf(file_path, filename)

        # Add chunks to FAISS index
        if processed["chunks"]:
            add_documents(
                processed["chunks"],
                [{"filename": filename}] * len(processed["chunks"]),
            )

        # Save to database
        kb = get_collection("knowledge_base")
        now = datetime.utcnow()
        doc = {
            "filename": filename,
            "file_path": file_path,
            "file_size": len(content),
            "chunk_count": processed["chunk_count"],
            "char_count": processed["char_count"],
            "upload_date": now,
            "uploaded_by": current_user["id"],
            "status": "processed",
        }
        result = await kb.insert_one(doc)

        return KnowledgeBaseResponse(
            id=str(result.inserted_id),
            filename=filename,
            upload_date=now,
            file_size=len(content),
            status="processed",
            chunk_count=processed["chunk_count"],
        )

    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@router.get("/documents", response_model=List[KnowledgeBaseResponse])
async def list_documents(current_user: dict = Depends(get_current_user)):
    """List all documents in the knowledge base."""
    kb = get_collection("knowledge_base")
    docs = await kb.find().sort("upload_date", -1).to_list(length=100)

    return [
        KnowledgeBaseResponse(
            id=str(d["_id"]),
            filename=d["filename"],
            upload_date=d["upload_date"],
            file_size=d.get("file_size", 0),
            status=d.get("status", "processed"),
            chunk_count=d.get("chunk_count"),
        )
        for d in docs
    ]


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_admin)):
    """Delete a document from the knowledge base (admin only)."""
    from bson import ObjectId

    kb = get_collection("knowledge_base")
    doc = await kb.find_one({"_id": ObjectId(doc_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove file if it exists
    file_path = doc.get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    await kb.delete_one({"_id": ObjectId(doc_id)})

    return {"message": f"Document '{doc['filename']}' deleted successfully"}

import os
import re
import logging
from typing import List, Dict, Any
from pathlib import Path

import pymupdf  # PyMuPDF - fast PDF extraction
from langchain_text_splitters import RecursiveCharacterTextSplitter

from utils.config import settings

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text content from a PDF file using PyMuPDF."""
    try:
        doc = pymupdf.open(file_path)
        text_parts = []

        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                text_parts.append(f"[Page {page_num + 1}]\n{text.strip()}")

        doc.close()
        full_text = "\n\n".join(text_parts)
        logger.info(f"Extracted {len(full_text)} chars from {file_path}")
        return full_text

    except Exception as e:
        logger.error(f"PDF extraction error for {file_path}: {e}")
        raise


def clean_text(text: str) -> str:
    """Clean extracted text."""
    # Remove excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    # Remove null bytes
    text = text.replace("\x00", "")
    return text.strip()


def chunk_text(text: str, chunk_size: int = None, chunk_overlap: int = None) -> List[str]:
    """Split text into overlapping chunks."""
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = splitter.split_text(text)
    # Filter out very short chunks
    chunks = [c.strip() for c in chunks if len(c.strip()) > 50]
    return chunks


def process_pdf(file_path: str, filename: str) -> Dict[str, Any]:
    """Full PDF processing pipeline: extract -> clean -> chunk."""
    logger.info(f"Processing PDF: {filename}")

    # Extract text
    raw_text = extract_text_from_pdf(file_path)
    clean = clean_text(raw_text)

    # Chunk
    chunks = chunk_text(clean)
    logger.info(f"Created {len(chunks)} chunks from {filename}")

    return {
        "filename": filename,
        "raw_text": clean,
        "chunks": chunks,
        "chunk_count": len(chunks),
        "char_count": len(clean),
    }


def process_all_pdfs(knowledge_base_path: str = None) -> List[Dict[str, Any]]:
    """Process all PDFs in the knowledge base directory."""
    kb_path = Path(knowledge_base_path or settings.KNOWLEDGE_BASE_PATH)

    if not kb_path.exists():
        logger.warning(f"Knowledge base path does not exist: {kb_path}")
        return []

    documents = []
    pdf_files = list(kb_path.glob("*.pdf"))
    logger.info(f"Found {len(pdf_files)} PDF files")

    for pdf_file in pdf_files:
        try:
            result = process_pdf(str(pdf_file), pdf_file.name)
            documents.append(result)
        except Exception as e:
            logger.error(f"Failed to process {pdf_file.name}: {e}")

    return documents


def save_uploaded_pdf(file_content: bytes, filename: str) -> str:
    """Save an uploaded PDF to the knowledge base directory."""
    kb_path = Path(settings.KNOWLEDGE_BASE_PATH)
    kb_path.mkdir(parents=True, exist_ok=True)

    file_path = kb_path / filename
    with open(file_path, "wb") as f:
        f.write(file_content)

    logger.info(f"Saved PDF: {filename} ({len(file_content)} bytes)")
    return str(file_path)

import os
import re
import logging
from typing import List, Dict, Any
from pathlib import Path

import pymupdf  # PyMuPDF - fast PDF extraction

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
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    text = text.replace("\x00", "")
    return text.strip()


def recursive_character_split(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
    separators: List[str] = None,
) -> List[str]:
    """
    Lightweight recursive character text splitter.

    Mirrors the core behavior of LangChain's RecursiveCharacterTextSplitter
    (try paragraph breaks first, then lines, then sentences, then words, then
    hard character splits) without pulling in langchain-text-splitters, which
    transitively depends on nltk and other heavy packages — dependencies
    that were both crashing on Python 3.13+ (nltk's removed inspect
    function) and, once removed from requirements.txt, leaving this file
    with a dangling import that crashed deploys outright. This has zero
    external dependencies beyond the standard library.
    """
    if separators is None:
        separators = ["\n\n", "\n", ". ", " ", ""]

    def _split(text: str, seps: List[str]) -> List[str]:
        if len(text) <= chunk_size:
            return [text] if text else []
        if not seps:
            return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

        sep = seps[0]
        parts = text.split(sep) if sep else list(text)

        result: List[str] = []
        buffer = ""
        for part in parts:
            piece = part + sep if sep else part
            if len(buffer) + len(piece) <= chunk_size:
                buffer += piece
            else:
                if buffer:
                    result.append(buffer)
                if len(piece) > chunk_size:
                    result.extend(_split(piece, seps[1:]))
                    buffer = ""
                else:
                    buffer = piece
        if buffer:
            result.append(buffer)
        return result

    chunks = _split(text, separators)

    # Add overlap between consecutive chunks so context isn't lost at boundaries
    if chunk_overlap > 0 and len(chunks) > 1:
        overlapped = [chunks[0]]
        for i in range(1, len(chunks)):
            prev_tail = chunks[i - 1][-chunk_overlap:]
            overlapped.append(prev_tail + chunks[i])
        chunks = overlapped

    return [c.strip() for c in chunks if c.strip()]


def chunk_text(text: str, chunk_size: int = None, chunk_overlap: int = None) -> List[str]:
    """Split text into overlapping chunks."""
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    chunks = recursive_character_split(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = [c for c in chunks if len(c) > 50]
    return chunks


def process_pdf(file_path: str, filename: str) -> Dict[str, Any]:
    """Full PDF processing pipeline: extract -> clean -> chunk."""
    logger.info(f"Processing PDF: {filename}")

    raw_text = extract_text_from_pdf(file_path)
    clean = clean_text(raw_text)

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

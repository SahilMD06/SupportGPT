import os
import pickle
import logging
from typing import List, Tuple, Optional
from pathlib import Path

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

from utils.config import settings

logger = logging.getLogger(__name__)

# Global FAISS index and metadata
_index: Optional[faiss.IndexFlatIP] = None
_chunks: List[str] = []
_metadata: List[dict] = []
_model: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model


def get_embeddings(texts: List[str]) -> np.ndarray:
    model = get_embedding_model()
    return model.encode(texts, show_progress_bar=False, normalize_embeddings=True)


def load_index():
    """Load FAISS index from disk if it exists."""
    global _index, _chunks, _metadata
    index_path = Path(settings.FAISS_INDEX_PATH)

    faiss_file = index_path / "index.faiss"
    chunks_file = index_path / "chunks.pkl"
    meta_file = index_path / "metadata.pkl"

    if faiss_file.exists() and chunks_file.exists():
        logger.info("Loading existing FAISS index...")
        _index = faiss.read_index(str(faiss_file))
        with open(chunks_file, "rb") as f:
            _chunks = pickle.load(f)
        if meta_file.exists():
            with open(meta_file, "rb") as f:
                _metadata = pickle.load(f)
        logger.info(f"✅ Loaded FAISS index with {len(_chunks)} chunks")
        return True
    return False


def save_index():
    """Save FAISS index to disk."""
    global _index, _chunks, _metadata
    index_path = Path(settings.FAISS_INDEX_PATH)
    index_path.mkdir(parents=True, exist_ok=True)

    faiss.write_index(_index, str(index_path / "index.faiss"))
    with open(index_path / "chunks.pkl", "wb") as f:
        pickle.dump(_chunks, f)
    with open(index_path / "metadata.pkl", "wb") as f:
        pickle.dump(_metadata, f)
    logger.info(f"✅ Saved FAISS index with {len(_chunks)} chunks")


def add_documents(texts: List[str], metadata: List[dict] = None):
    """Add documents to the FAISS index."""
    global _index, _chunks, _metadata

    if not texts:
        return

    embeddings = get_embeddings(texts)
    dimension = embeddings.shape[1]

    if _index is None:
        _index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity

    _index.add(embeddings.astype(np.float32))
    _chunks.extend(texts)
    _metadata.extend(metadata or [{}] * len(texts))

    save_index()
    logger.info(f"Added {len(texts)} chunks. Total: {len(_chunks)}")


def search(query: str, top_k: int = None) -> List[Tuple[str, float, dict]]:
    """
    Search FAISS index for relevant chunks.
    Returns (chunk_text, similarity_score, metadata) tuples, ordered by
    descending similarity. Scores are cosine similarity (embeddings are
    normalized), roughly in the range -1 to 1, where higher is more relevant.
    """
    global _index, _chunks, _metadata

    if _index is None or len(_chunks) == 0:
        load_index()

    if _index is None or len(_chunks) == 0:
        return []

    top_k = top_k or settings.TOP_K_RESULTS
    query_embedding = get_embeddings([query]).astype(np.float32)

    n_results = min(top_k, len(_chunks))
    scores, indices = _index.search(query_embedding, n_results)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx >= 0 and idx < len(_chunks):
            meta = _metadata[idx] if idx < len(_metadata) else {}
            results.append((_chunks[idx], float(score), meta))

    return results


def get_rag_context(
    query: str,
    top_k: int = None,
    priority_filename: str = None,
) -> Tuple[str, List[str], bool, float]:
    """
    Retrieve RAG context for a query, with optional document priority boosting
    and confidence scoring.

    Args:
        query: the user's question
        top_k: number of chunks to include in context
        priority_filename: if set (e.g. "PrivacyPolicy.pdf"), chunks from this
            document are ranked ahead of equally-or-less relevant chunks from
            other documents. Implemented by searching a wider candidate pool
            and re-ordering, since FAISS's flat index doesn't support native
            metadata filtering.

    Returns:
        (context_string, sources_list, is_confident, best_score)

        is_confident is False when the best matching chunk's similarity score
        falls below settings.RAG_CONFIDENCE_THRESHOLD — callers handling
        sensitive topics (e.g. privacy/security) should use this signal to
        fall back to a clearly-labeled general-knowledge response instead of
        presenting a weak match as an authoritative company answer.
    """
    top_k = top_k or settings.TOP_K_RESULTS

    # Widen the candidate pool when we need room to re-rank for priority,
    # so a relevant priority-document chunk outside the raw top-k can still
    # surface.
    candidate_k = max(top_k * 3, 10) if priority_filename else top_k
    results = search(query, candidate_k)

    if not results:
        return "", [], False, 0.0

    if priority_filename:
        priority_hits = [r for r in results if r[2].get("filename") == priority_filename]
        other_hits = [r for r in results if r[2].get("filename") != priority_filename]
        ordered = priority_hits + other_hits
    else:
        ordered = results

    top_results = ordered[:top_k]
    best_score = max((r[1] for r in top_results), default=0.0)
    is_confident = best_score >= settings.RAG_CONFIDENCE_THRESHOLD

    context_parts = []
    sources = []
    for chunk, score, meta in top_results:
        source = meta.get("filename", "Knowledge Base")
        if source not in sources:
            sources.append(source)
        context_parts.append(f"[Source: {source}]\n{chunk}")

    context = "\n\n---\n\n".join(context_parts)
    return context, sources, is_confident, best_score


def rebuild_index(documents: List[dict]):
    """Rebuild FAISS index from scratch."""
    global _index, _chunks, _metadata

    _index = None
    _chunks = []
    _metadata = []

    all_chunks = []
    all_meta = []

    for doc in documents:
        chunks = doc.get("chunks", [])
        filename = doc.get("filename", "Unknown")
        for chunk in chunks:
            all_chunks.append(chunk)
            all_meta.append({"filename": filename})

    if all_chunks:
        add_documents(all_chunks, all_meta)

    return len(all_chunks)


def get_index_stats() -> dict:
    """Get statistics about the current FAISS index."""
    global _index, _chunks
    if _index is None:
        load_index()
    return {
        "total_chunks": len(_chunks),
        "index_loaded": _index is not None,
        "embedding_model": settings.EMBEDDING_MODEL,
        "confidence_threshold": settings.RAG_CONFIDENCE_THRESHOLD,
    }

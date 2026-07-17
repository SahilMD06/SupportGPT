import os
import pickle
import time
import logging
from typing import List, Tuple, Optional
from pathlib import Path

import numpy as np
import faiss
from google import genai
from google.genai import types

from utils.config import settings

logger = logging.getLogger(__name__)

# Global FAISS index and metadata
_index: Optional[faiss.IndexFlatIP] = None
_chunks: List[str] = []
_metadata: List[dict] = []

# Output dimensionality for Gemini embeddings. 768 is one of the
# officially recommended sizes (alongside 1536/3072) and keeps the index
# small and fast for a knowledge base this size (12 documents).
EMBEDDING_DIM = 768
EMBED_BATCH_SIZE = 20  # conservative batch size per API call


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


def get_embeddings(texts: List[str], task_type: str = "RETRIEVAL_DOCUMENT") -> np.ndarray:
    """
    Generate embeddings via the Gemini API rather than a local model.

    This replaces the previous local sentence-transformers/PyTorch pipeline,
    which routinely used 400-600MB of RAM on its own — enough by itself to
    exceed Render's free-tier 512MB limit and crash the deploy. Calling the
    embedding API instead adds a small amount of network latency per call,
    but keeps the backend's memory footprint small enough to actually run
    on constrained/free hosting, and removes a large, fragile dependency
    chain (torch + sentence-transformers) entirely.

    task_type should be "RETRIEVAL_DOCUMENT" when embedding knowledge base
    chunks for indexing, and "RETRIEVAL_QUERY" when embedding a user's
    search query — using the right one improves retrieval quality since
    the two are optimized asymmetrically.

    IMPORTANT: gemini-embedding-001 does not reliably support batched
    requests (sending a list of texts in one call) — the API rejects it
    with "unexpected model name format" on the batch path. Each text is
    embedded with its own individual API call instead, matching the
    documented single-string usage pattern.
    """
    if not texts:
        return np.zeros((0, EMBEDDING_DIM), dtype=np.float32)

    client = _get_client()
    all_vectors = []

    for i, text in enumerate(texts):
        result = client.models.embed_content(
            model=settings.EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBEDDING_DIM,
            ),
        )
        all_vectors.append(result.embeddings[0].values)
        if i < len(texts) - 1:
            time.sleep(0.1)  # be gentle on rate limits across many individual calls

    vectors = np.array(all_vectors, dtype=np.float32)

    # Normalize so inner product == cosine similarity, matching the
    # IndexFlatIP index below.
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1
    vectors = vectors / norms
    return vectors


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

    embeddings = get_embeddings(texts, task_type="RETRIEVAL_DOCUMENT")

    if _index is None:
        _index = faiss.IndexFlatIP(EMBEDDING_DIM)

    _index.add(embeddings.astype(np.float32))
    _chunks.extend(texts)
    _metadata.extend(metadata or [{}] * len(texts))

    save_index()
    logger.info(f"Added {len(texts)} chunks. Total: {len(_chunks)}")


def search(query: str, top_k: int = None) -> List[Tuple[str, float, dict]]:
    """
    Search FAISS index for relevant chunks.
    Returns (chunk_text, similarity_score, metadata) tuples, ordered by
    descending similarity.
    """
    global _index, _chunks, _metadata

    if _index is None or len(_chunks) == 0:
        load_index()

    if _index is None or len(_chunks) == 0:
        return []

    top_k = top_k or settings.TOP_K_RESULTS
    query_embedding = get_embeddings([query], task_type="RETRIEVAL_QUERY").astype(np.float32)

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
    and confidence scoring. See get_index_stats() for the confidence
    threshold used to decide is_confident.
    """
    top_k = top_k or settings.TOP_K_RESULTS

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

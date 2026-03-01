"""
RAG Store using ChromaDB + sentence-transformers.
Stores resume chunks per user, retrieves context for interview questions.
"""

import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from core.config import settings


class RAGStore:
    def __init__(self):
        os.makedirs(settings.CHROMA_PATH, exist_ok=True)
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PATH)
        try:
            self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
            self.enabled = True
            print("✅ RAG Store initialized with sentence-transformers")
        except Exception as e:
            print(f"⚠️ RAG embedder failed: {e}. RAG disabled.")
            self.enabled = False

    def _get_collection(self, user_id: int):
        return self.client.get_or_create_collection(
            name=f"resume_user_{user_id}", metadata={"hnsw:space": "cosine"}
        )

    def store_resume(self, user_id: int, resume_text: str):
        """Chunk and embed resume text into ChromaDB."""
        if not self.enabled:
            return
        # Split into ~400 char chunks with 50 char overlap
        chunks = self._chunk_text(resume_text, chunk_size=400, overlap=50)
        if not chunks:
            return
        collection = self._get_collection(user_id)
        # Clear old entries for this user
        try:
            existing = collection.get()
            if existing["ids"]:
                collection.delete(ids=existing["ids"])
        except Exception:
            pass
        embeddings = self.embedder.encode(chunks).tolist()
        ids = [f"chunk_{i}" for i in range(len(chunks))]
        collection.add(documents=chunks, embeddings=embeddings, ids=ids)
        print(f"✅ Stored {len(chunks)} resume chunks for user {user_id}")

    def retrieve_context(self, user_id: int, query: str, top_k: int = 3) -> str:
        """Retrieve top-k relevant resume chunks for a given query."""
        if not self.enabled:
            return ""
        try:
            collection = self._get_collection(user_id)
            query_embedding = self.embedder.encode([query]).tolist()
            results = collection.query(
                query_embeddings=query_embedding, n_results=top_k
            )
            docs = results.get("documents", [[]])[0]
            return "\n".join(docs) if docs else ""
        except Exception as e:
            print(f"RAG retrieve error: {e}")
            return ""

    def _chunk_text(self, text: str, chunk_size: int = 400, overlap: int = 50):
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start += chunk_size - overlap
        return [c.strip() for c in chunks if c.strip()]


rag_store = RAGStore()

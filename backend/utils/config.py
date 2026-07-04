from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SupportGPT"
    DEBUG: bool = False
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # MongoDB
    MONGODB_URL: str = "mongodb+srv://username:password@cluster.mongodb.net/supportgpt"
    MONGODB_DB_NAME: str = "supportgpt"

    # Google Gemini
    GOOGLE_API_KEY: str = "your-google-gemini-api-key"
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://your-frontend-domain.vercel.app",
    ]

    # RAG
    FAISS_INDEX_PATH: str = "./faiss_index"
    KNOWLEDGE_BASE_PATH: str = "./knowledge_base"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    TOP_K_RESULTS: int = 5

    # Rate Limiting
    RATE_LIMIT: str = "60/minute"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

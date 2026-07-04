from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import logging

from api.auth import router as auth_router
from api.chat import router as chat_router
from api.knowledge import router as knowledge_router
from api.history import router as history_router
from api.analytics import router as analytics_router
from api.admin import router as admin_router
from services.database import connect_to_mongo, close_mongo_connection
from utils.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SupportGPT API...")
    await connect_to_mongo()
    yield
    logger.info("Shutting down SupportGPT API...")
    await close_mongo_connection()


app = FastAPI(
    title="SupportGPT Multi-Agent AI Customer Support API",
    description="Production-ready Multi-Agent AI Customer Support Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(chat_router, prefix="/chat", tags=["Chat"])
app.include_router(knowledge_router, prefix="/knowledge", tags=["Knowledge Base"])
app.include_router(history_router, prefix="/history", tags=["History"])
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])


@app.get("/")
async def root():
    return {
        "message": "SupportGPT Multi-Agent AI Customer Support API",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SupportGPT API"}

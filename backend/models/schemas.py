from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    user = "user"
    admin = "admin"


class IntentType(str, Enum):
    billing = "billing"
    technical = "technical"
    product = "product"
    complaint = "complaint"
    faq = "faq"


# ─── Auth Models ─────────────────────────────────────────────────────────────


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Chat Models ─────────────────────────────────────────────────────────────


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    agent_used: Optional[List[str]] = None
    intents: Optional[List[str]] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    intents: List[str]
    agents_used: List[str]
    response_time_ms: float
    sources: Optional[List[str]] = None


# ─── Conversation Models ──────────────────────────────────────────────────────


class ConversationCreate(BaseModel):
    user_id: str
    session_id: str


class ConversationResponse(BaseModel):
    id: str
    session_id: str
    messages: List[ChatMessage]
    created_at: datetime
    updated_at: datetime


# ─── Knowledge Base Models ────────────────────────────────────────────────────


class KnowledgeBaseResponse(BaseModel):
    id: str
    filename: str
    upload_date: datetime
    file_size: int
    status: str
    chunk_count: Optional[int] = None


# ─── Analytics Models ─────────────────────────────────────────────────────────


class AgentUsageStat(BaseModel):
    agent: str
    count: int
    percentage: float


class AnalyticsResponse(BaseModel):
    total_chats: int
    total_users: int
    avg_response_time_ms: float
    agent_usage: List[AgentUsageStat]
    intent_distribution: Dict[str, int]
    chats_per_day: List[Dict[str, Any]]
    most_common_intents: List[Dict[str, Any]]


# ─── Admin Models ─────────────────────────────────────────────────────────────


class RebuildEmbeddingsResponse(BaseModel):
    status: str
    documents_processed: int
    chunks_created: int
    message: str

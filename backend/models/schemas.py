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
    privacy = "privacy"
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
    full_name: Optional[str] = None
    profile_picture: Optional[str] = None


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
    language_code: Optional[str] = None
    language_name: Optional[str] = None


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
    language_code: Optional[str] = None
    language_name: Optional[str] = None
    frustration_level: Optional[int] = None


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


class SentimentStat(BaseModel):
    avg_frustration: float
    low_frustration_count: int    # levels 1-2
    medium_frustration_count: int  # level 3
    high_frustration_count: int   # levels 4-5
    frustration_trend: List[Dict[str, Any]]  # per-day average, last 30 days


class LanguageStat(BaseModel):
    language_name: str
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
    sentiment: SentimentStat
    languages: List[LanguageStat]


# ─── Admin Models ─────────────────────────────────────────────────────────────


class RebuildEmbeddingsResponse(BaseModel):
    status: str
    documents_processed: int
    chunks_created: int
    message: str


# ─── User Profile & Settings Models ───────────────────────────────────────────


class UserProfileUpdate(BaseModel):
    """All fields optional — supports partial updates."""
    username: Optional[str] = Field(None, min_length=3, max_length=30)
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[str] = None  # ISO date string, e.g. "1995-06-15"
    profile_picture: Optional[str] = None  # URL only — no file upload support


class UserProfileResponse(BaseModel):
    id: str
    name: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    profile_picture: Optional[str] = None
    role: UserRole
    created_at: datetime
    last_login: Optional[datetime] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class DeleteAccountRequest(BaseModel):
    password: str  # required confirmation before permanent deletion


class UserPreferencesUpdate(BaseModel):
    theme_preference: Optional[str] = None  # "light" | "dark" | "system"
    font_size: Optional[str] = None  # "small" | "medium" | "large"
    notification_enabled: Optional[bool] = None
    privacy_preferences: Optional[Dict[str, bool]] = None
    ai_model: Optional[str] = None
    response_length: Optional[str] = None  # "concise" | "balanced" | "detailed"
    show_citations: Optional[bool] = None
    show_suggestions: Optional[bool] = None
    response_language: Optional[str] = None  # "auto" | "en" | "es" | "fr" | ...


class UserPreferencesResponse(BaseModel):
    theme_preference: str = "system"
    font_size: str = "medium"
    notification_enabled: bool = True
    privacy_preferences: Dict[str, bool] = Field(default_factory=dict)
    ai_model: str = "gemini-2.5-flash"
    response_length: str = "balanced"
    show_citations: bool = True
    show_suggestions: bool = True
    response_language: str = "auto"


class SessionInfo(BaseModel):
    session_id: str
    device: str
    ip_address: str
    created_at: datetime
    last_active: datetime
    is_current: bool


class DataExportResponse(BaseModel):
    export_date: datetime
    profile: Dict[str, Any]
    preferences: Dict[str, Any]
    conversation_count: int
    conversations: List[Dict[str, Any]]

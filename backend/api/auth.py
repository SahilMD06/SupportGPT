from fastapi import APIRouter, HTTPException, status, Depends, Request
from datetime import datetime
from bson import ObjectId
import uuid

from models.schemas import UserRegister, UserLogin, TokenResponse, UserResponse
from services.database import get_collection
from utils.auth import hash_password, verify_password, create_access_token, get_current_user
from utils.config import settings

router = APIRouter()


def _get_client_ip(request: Request) -> str:
    """Prefer X-Forwarded-For when behind a reverse proxy (Render, Vercel)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _describe_device(user_agent: str) -> str:
    """Lightweight, dependency-free device/browser guess from User-Agent."""
    ua = (user_agent or "").lower()

    if "iphone" in ua:
        os_name = "iPhone"
    elif "ipad" in ua:
        os_name = "iPad"
    elif "android" in ua:
        os_name = "Android"
    elif "windows" in ua:
        os_name = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Unknown device"

    if "edg/" in ua:
        browser = "Edge"
    elif "chrome" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua:
        browser = "Safari"
    else:
        browser = "Unknown browser"

    return f"{browser} on {os_name}"


async def _create_session_record(user_id: str, session_id: str, request: Request):
    sessions = get_collection("sessions")
    now = datetime.utcnow()
    await sessions.insert_one({
        "user_id": user_id,
        "session_id": session_id,
        "device": _describe_device(request.headers.get("user-agent", "")),
        "ip_address": _get_client_ip(request),
        "created_at": now,
        "last_active": now,
    })


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, request: Request):
    """Register a new user account."""
    users = get_collection("users")

    existing = await users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    now = datetime.utcnow()
    user_doc = {
        "name": user_data.name.strip(),
        "email": user_data.email.lower(),
        "password": hash_password(user_data.password),
        "role": "user",
        "token_version": 0,
        "created_at": now,
        "updated_at": now,
        "last_login": now,
    }

    result = await users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    session_id = str(uuid.uuid4())
    access_token = create_access_token({"sub": user_id, "role": "user", "tv": 0, "sid": session_id})
    await _create_session_record(user_id, session_id, request)

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            name=user_doc["name"],
            email=user_doc["email"],
            role="user",
            created_at=now,
            full_name=user_doc.get("full_name"),
            profile_picture=user_doc.get("profile_picture"),
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, request: Request):
    """Login with email and password."""
    users = get_collection("users")

    user = await users.find_one({"email": credentials.email.lower()})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(user["_id"])
    token_version = user.get("token_version", 0)
    session_id = str(uuid.uuid4())

    access_token = create_access_token({
        "sub": user_id,
        "role": user.get("role", "user"),
        "tv": token_version,
        "sid": session_id,
    })

    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.utcnow()}},
    )
    await _create_session_record(user_id, session_id, request)

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            name=user["name"],
            email=user["email"],
            role=user.get("role", "user"),
            created_at=user["created_at"],
            # These two were previously omitted from the login/register response,
            # which caused the sidebar avatar to revert to the fallback initial
            # every time a user logged back in — the Settings page still showed
            # the picture correctly because it fetches the full profile
            # separately via GET /user/profile, which was never missing this data.
            full_name=user.get("full_name"),
            profile_picture=user.get("profile_picture"),
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info."""
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        role=current_user.get("role", "user"),
        created_at=current_user["created_at"],
        full_name=current_user.get("full_name"),
        profile_picture=current_user.get("profile_picture"),
    )

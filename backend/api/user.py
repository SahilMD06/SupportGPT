from fastapi import APIRouter, HTTPException, Depends, Request, status
from datetime import datetime
from bson import ObjectId
import logging

from models.schemas import (
    UserProfileUpdate, UserProfileResponse, PasswordChangeRequest,
    DeleteAccountRequest, UserPreferencesUpdate, UserPreferencesResponse,
    SessionInfo, DataExportResponse,
)
from services.database import get_collection
from utils.auth import get_current_user, hash_password, verify_password
from api.auth import _get_client_ip

router = APIRouter()
logger = logging.getLogger(__name__)


async def _log_audit_event(user_id: str, action: str, request: Request, metadata: dict = None):
    """Record a sensitive account action for audit purposes."""
    audit_log = get_collection("audit_log")
    await audit_log.insert_one({
        "user_id": user_id,
        "action": action,
        "timestamp": datetime.utcnow(),
        "ip_address": _get_client_ip(request),
        "metadata": metadata or {},
    })


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the current user's full profile."""
    return UserProfileResponse(
        id=current_user["id"],
        name=current_user["name"],
        username=current_user.get("username"),
        full_name=current_user.get("full_name"),
        email=current_user["email"],
        phone=current_user.get("phone"),
        date_of_birth=current_user.get("date_of_birth"),
        profile_picture=current_user.get("profile_picture"),
        role=current_user.get("role", "user"),
        created_at=current_user["created_at"],
        last_login=current_user.get("last_login"),
    )


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    update: UserProfileUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Update profile fields. All fields optional — only provided ones change."""
    users = get_collection("users")
    update_data = {k: v for k, v in update.dict(exclude_unset=True).items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    if "username" in update_data:
        existing = await users.find_one({
            "username": update_data["username"],
            "_id": {"$ne": ObjectId(current_user["id"])},
        })
        if existing:
            raise HTTPException(status_code=409, detail="Username is already taken")

    if "email" in update_data:
        update_data["email"] = update_data["email"].lower()
        existing = await users.find_one({
            "email": update_data["email"],
            "_id": {"$ne": ObjectId(current_user["id"])},
        })
        if existing:
            raise HTTPException(status_code=409, detail="Email is already in use")

    update_data["updated_at"] = datetime.utcnow()

    await users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": update_data},
    )
    await _log_audit_event(current_user["id"], "profile_updated", request, {"fields": list(update_data.keys())})

    updated = await users.find_one({"_id": ObjectId(current_user["id"])})
    return UserProfileResponse(
        id=str(updated["_id"]),
        name=updated["name"],
        username=updated.get("username"),
        full_name=updated.get("full_name"),
        email=updated["email"],
        phone=updated.get("phone"),
        date_of_birth=updated.get("date_of_birth"),
        profile_picture=updated.get("profile_picture"),
        role=updated.get("role", "user"),
        created_at=updated["created_at"],
        last_login=updated.get("last_login"),
    )


# ─── Password ─────────────────────────────────────────────────────────────────

@router.put("/password")
async def change_password(
    body: PasswordChangeRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Change password — also bumps token_version, logging out every other session."""
    if not verify_password(body.current_password, current_user["password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    users = get_collection("users")
    new_version = current_user.get("token_version", 0) + 1

    await users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {
            "$set": {
                "password": hash_password(body.new_password),
                "updated_at": datetime.utcnow(),
                "token_version": new_version,
            }
        },
    )

    sessions = get_collection("sessions")
    await sessions.delete_many({"user_id": current_user["id"]})

    await _log_audit_event(current_user["id"], "password_changed", request)

    return {"message": "Password changed successfully. Please sign in again."}


# ─── Sessions ─────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=list[SessionInfo])
async def list_sessions(current_user: dict = Depends(get_current_user)):
    """List all active sessions (devices logged in) for the current user."""
    sessions = get_collection("sessions")
    current_sid = current_user.get("_session_id")

    docs = await sessions.find({"user_id": current_user["id"]}).sort("last_active", -1).to_list(length=50)

    return [
        SessionInfo(
            session_id=d["session_id"],
            device=d.get("device", "Unknown device"),
            ip_address=d.get("ip_address", "Unknown"),
            created_at=d["created_at"],
            last_active=d.get("last_active", d["created_at"]),
            is_current=(d["session_id"] == current_sid),
        )
        for d in docs
    ]


@router.post("/logout")
async def logout(request: Request, current_user: dict = Depends(get_current_user)):
    """Log out of this device only — removes this session from the visible list."""
    sessions = get_collection("sessions")
    current_sid = current_user.get("_session_id")
    if current_sid:
        await sessions.delete_one({"user_id": current_user["id"], "session_id": current_sid})

    await _log_audit_event(current_user["id"], "logout", request)
    return {"message": "Logged out"}


@router.post("/logout-all")
async def logout_all(request: Request, current_user: dict = Depends(get_current_user)):
    """Log out of every device by bumping token_version."""
    users = get_collection("users")
    new_version = current_user.get("token_version", 0) + 1

    await users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"token_version": new_version}},
    )

    sessions = get_collection("sessions")
    await sessions.delete_many({"user_id": current_user["id"]})

    await _log_audit_event(current_user["id"], "logout_all_devices", request)
    return {"message": "Logged out of all devices"}


# ─── Account Deletion ─────────────────────────────────────────────────────────

@router.delete("/account")
async def delete_account(
    body: DeleteAccountRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Permanently delete the account and all associated data. Requires password confirmation."""
    if not verify_password(body.password, current_user["password"]):
        raise HTTPException(status_code=401, detail="Password is incorrect")

    user_id = current_user["id"]

    await _log_audit_event(user_id, "account_deleted", request)

    users = get_collection("users")
    conversations = get_collection("conversations")
    analytics = get_collection("analytics")
    sessions = get_collection("sessions")

    await conversations.delete_many({"user_id": user_id})
    await analytics.delete_many({"user_id": user_id})
    await sessions.delete_many({"user_id": user_id})
    await users.delete_one({"_id": ObjectId(user_id)})

    return {"message": "Account and all associated data permanently deleted"}


# ─── Preferences ──────────────────────────────────────────────────────────────

DEFAULT_PREFERENCES = {
    "theme_preference": "system",
    "font_size": "medium",
    "notification_enabled": True,
    "privacy_preferences": {},
    "ai_model": "gemini-2.5-flash",
    "response_length": "balanced",
    "show_citations": True,
    "show_suggestions": True,
    "response_language": "auto",
}


@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_preferences(current_user: dict = Depends(get_current_user)):
    """Get preferences, falling back to defaults for any unset fields."""
    stored = current_user.get("preferences", {})
    merged = {**DEFAULT_PREFERENCES, **stored}
    return UserPreferencesResponse(**merged)


@router.put("/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    update: UserPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Partially update preferences — only provided fields change."""
    users = get_collection("users")
    update_data = {k: v for k, v in update.dict(exclude_unset=True).items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No preference fields provided")

    set_fields = {f"preferences.{k}": v for k, v in update_data.items()}
    set_fields["updated_at"] = datetime.utcnow()

    await users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": set_fields},
    )

    updated = await users.find_one({"_id": ObjectId(current_user["id"])})
    stored = updated.get("preferences", {})
    merged = {**DEFAULT_PREFERENCES, **stored}
    return UserPreferencesResponse(**merged)


# ─── Data Export ──────────────────────────────────────────────────────────────

@router.post("/export-data", response_model=DataExportResponse)
async def export_data(request: Request, current_user: dict = Depends(get_current_user)):
    """Export all of the user's own data — profile, preferences, conversations."""
    conversations = get_collection("conversations")
    convs = await conversations.find({"user_id": current_user["id"]}).to_list(length=1000)

    conv_export = [
        {
            "session_id": c["session_id"],
            "created_at": c.get("created_at").isoformat() if c.get("created_at") else None,
            "messages": [
                {
                    "role": m["role"],
                    "content": m["content"],
                    "timestamp": m.get("timestamp").isoformat() if m.get("timestamp") else None,
                }
                for m in c.get("messages", [])
            ],
        }
        for c in convs
    ]

    profile = {
        "name": current_user["name"],
        "username": current_user.get("username"),
        "full_name": current_user.get("full_name"),
        "email": current_user["email"],
        "phone": current_user.get("phone"),
        "date_of_birth": current_user.get("date_of_birth"),
        "created_at": current_user["created_at"].isoformat(),
    }

    stored_prefs = current_user.get("preferences", {})
    preferences = {**DEFAULT_PREFERENCES, **stored_prefs}

    await _log_audit_event(current_user["id"], "data_exported", request, {"conversation_count": len(convs)})

    return DataExportResponse(
        export_date=datetime.utcnow(),
        profile=profile,
        preferences=preferences,
        conversation_count=len(convs),
        conversations=conv_export,
    )

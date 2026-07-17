from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.config import settings
from services.database import get_collection
from bson import ObjectId

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    data may include:
      - sub: user id (required)
      - role: user role
      - tv: token_version at issue time (enables "logout from all devices")
      - sid: session id, used to identify this specific login in the
             sessions collection (enables "view active sessions" /
             single-device logout)
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )

    users = get_collection("users")
    user = await users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    # Token version check — enables "logout from all devices".
    #
    # Backward compatibility: tokens issued before this feature existed have
    # no "tv" claim at all. We treat that as "skip the check" rather than
    # rejecting the token, so nobody gets silently logged out the moment
    # this code deploys. Any token issued from here forward will always
    # include "tv", so the check becomes fully active for new logins.
    token_version = payload.get("tv")
    if token_version is not None:
        current_version = user.get("token_version", 0)
        if token_version != current_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been logged out. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    user["id"] = str(user["_id"])
    # Attach session id (if present) so route handlers can identify "this"
    # session without re-decoding the token.
    user["_session_id"] = payload.get("sid")
    return user


async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current_user

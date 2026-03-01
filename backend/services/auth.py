"""
JWT utility helpers for creating and verifying tokens.
"""
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_MINUTES


def create_token(user_id: int, identifier: str, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "identifier": identifier,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

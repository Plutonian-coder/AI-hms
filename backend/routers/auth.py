"""
Auth Router — Self-managed JWT authentication (no external auth service).

Flow:
  Register → hash password with bcrypt → insert into users → return JWT
  Login    → verify bcrypt hash        → fetch fresh role from DB → return JWT

The JWT payload contains: user_id, identifier, role, gender.
Role is READ FROM THE DATABASE at login time, so promoting a user to admin
in the DB takes effect on their NEXT login — no code changes needed.

Security notes:
  - Registration always forces role='student'. Admins are created manually in the DB.
  - Passwords are hashed with bcrypt (cost factor 12).
  - Tokens expire after JWT_EXPIRY_MINUTES (default 24h).
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from config import JWT_ALGORITHM, JWT_EXPIRY_MINUTES, JWT_SECRET
from database import get_cursor
from models import TokenResponse, UserLogin, UserRegister

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Bcrypt context — cost factor 12 is the current recommended minimum
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


# ── Internal helpers ─────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def _create_token(payload: dict) -> str:
    """Sign a JWT with an absolute expiry timestamp."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)
    return jwt.encode({**payload, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserRegister):
    data.identifier = data.identifier.strip().upper()

    # SECURITY: Always force student on registration.
    # Admins must be created/promoted directly in the database.
    data.role = "student"

    with get_cursor() as cur:
        # 1. Duplicate check
        cur.execute("SELECT id FROM users WHERE identifier = %s", (data.identifier,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Identifier already registered")

        # 2. Hash password and persist user atomically
        pw_hash = _hash_password(data.password)
        cur.execute(
            """INSERT INTO users (identifier, surname, first_name, gender, role, password_hash)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (data.identifier, data.surname.strip(), data.first_name.strip(),
             data.gender, "student", pw_hash),
        )
        user_id = cur.fetchone()[0]

    token = _create_token({
        "sub":        str(user_id),
        "user_id":    user_id,
        "identifier": data.identifier,
        "role":       "student",
        "gender":     data.gender,
    })

    return TokenResponse(
        access_token=token,
        user_id=user_id,
        identifier=data.identifier,
        full_name=f"{data.surname} {data.first_name}",
        gender=data.gender,
        role="student",
    )


# ── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin):
    data.identifier = data.identifier.strip().upper()

    with get_cursor() as cur:
        cur.execute(
            "SELECT id, surname, first_name, gender, role, password_hash FROM users WHERE identifier = %s",
            (data.identifier,),
        )
        row = cur.fetchone()

    if not row:
        # Use same message as wrong password to avoid account enumeration
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id, surname, first_name, gender, role, pw_hash = row

    if not _verify_password(data.password, pw_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Role is fetched fresh from DB every login — promoting a user to admin
    # in the database takes effect immediately on next login.
    token = _create_token({
        "sub":        str(user_id),
        "user_id":    user_id,
        "identifier": data.identifier,
        "role":       role,
        "gender":     gender,
    })

    return TokenResponse(
        access_token=token,
        user_id=user_id,
        identifier=data.identifier,
        full_name=f"{surname} {first_name}",
        gender=gender,
        role=role,
    )


# ── Password Change (authenticated) ─────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    identifier: str
    old_password: str
    new_password: str


@router.post("/change-password")
def change_password(data: ChangePasswordRequest):
    """
    Allow a logged-in user to change their own password.
    Requires the current password for verification (no magic links needed).
    """
    identifier = data.identifier.strip().upper()

    with get_cursor() as cur:
        cur.execute(
            "SELECT id, password_hash FROM users WHERE identifier = %s", (identifier,)
        )
        row = cur.fetchone()

    if not row or not _verify_password(data.old_password, row[1]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    new_hash = _hash_password(data.new_password)
    with get_cursor() as cur:
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, row[0]))

    return {"message": "Password changed successfully. Please log in again."}

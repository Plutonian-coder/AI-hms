"""
Auth Router — Self-managed JWT authentication.

Registration validates matric number against session_register and auto-populates
student details from the institutional record.

Flow:
  verify-matric → check session_register → return preview of auto-populated fields
  Register → validate matric → hash password → insert user → return JWT
  Login    → verify bcrypt hash → fetch fresh role from DB → return JWT
"""
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from jose import jwt
from passlib.context import CryptContext

from config import JWT_ALGORITHM, JWT_EXPIRY_MINUTES, JWT_SECRET
from database import get_cursor
from models import TokenResponse, UserLogin, UserRegister
from dependencies import get_current_user
from services.audit_logger import log_event, STUDENT_REGISTERED, PASSWORD_CHANGED

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def _hash_password(plain: str) -> str:
    pre_hashed = hashlib.sha256(plain.encode("utf-8")).hexdigest()
    return _pwd_ctx.hash(pre_hashed)


def _verify_password(plain: str, hashed: str) -> bool:
    pre_hashed = hashlib.sha256(plain.encode("utf-8")).hexdigest()
    return _pwd_ctx.verify(pre_hashed, hashed)


def _create_token(payload: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)
    return jwt.encode({**payload, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ── Verify Matric (public, pre-registration) ────────────────────────────────

@router.get("/verify-matric")
def verify_matric(matric: str = Query(...)):
    """
    Check if a matric number exists in the active session register.
    Returns auto-populated fields if found.
    """
    matric = matric.strip().upper()

    with get_cursor() as cur:
        cur.execute(
            """SELECT sr.surname, sr.first_name, sr.gender, sr.department,
                      sr.level, sr.study_type, sr.faculty
               FROM session_register sr
               JOIN academic_sessions s ON s.id = sr.session_id AND s.is_active = TRUE
               WHERE sr.matric_number = %s
               LIMIT 1""",
            (matric,),
        )
        row = cur.fetchone()

        if not row:
            return {"found": False, "message": "Matric number not found in the current session register."}

        # Check if already registered
        cur.execute("SELECT id FROM users WHERE identifier = %s", (matric,))
        existing = cur.fetchone()
        if existing:
            return {
                "found": True,
                "already_registered": True,
                "message": "An account already exists for this matric number. Please log in.",
            }

    return {
        "found": True,
        "already_registered": False,
        "surname": row[0],
        "first_name": row[1],
        "gender": row[2],
        "department": row[3],
        "level": row[4],
        "study_type": row[5],
        "faculty": row[6],
    }


# ── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserRegister):
    identifier = data.identifier.strip().upper()

    with get_cursor() as cur:
        # 1. Check session register
        cur.execute(
            """SELECT sr.surname, sr.first_name, sr.gender, sr.department,
                      sr.level, sr.study_type, sr.faculty, sr.session_id
               FROM session_register sr
               JOIN academic_sessions s ON s.id = sr.session_id AND s.is_active = TRUE
               WHERE sr.matric_number = %s
               LIMIT 1""",
            (identifier,),
        )
        reg_row = cur.fetchone()

        if not reg_row:
            raise HTTPException(
                status_code=403,
                detail="Your matric number was not found in the current session register. Please contact the Student Affairs Unit.",
            )

        surname, first_name, gender, department, level, study_type, faculty, session_id = reg_row

        # 2. Duplicate check
        cur.execute("SELECT id FROM users WHERE identifier = %s", (identifier,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="An account already exists for this matric number. Please log in instead.")

        # 3. Hash password and create user with auto-populated fields
        pw_hash = _hash_password(data.password)
        cur.execute(
            """INSERT INTO users
               (identifier, surname, first_name, gender, role, password_hash,
                email, phone, department, level, study_type,
                next_of_kin_name, next_of_kin_phone)
               VALUES (%s, %s, %s, %s, 'student', %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id""",
            (
                identifier,
                surname,
                first_name,
                gender,
                pw_hash,
                data.email.strip() or None,
                data.phone.strip() or None,
                department,
                level,
                study_type or "Full-time",
                data.next_of_kin_name.strip() or None,
                data.next_of_kin_phone.strip() or None,
            ),
        )
        user_id = cur.fetchone()[0]

    log_event(
        STUDENT_REGISTERED, "student", identifier,
        f"Student {surname} {first_name} registered",
        target_entity="user", target_id=str(user_id),
        session_id=session_id,
    )

    token = _create_token({
        "sub": str(user_id),
        "user_id": user_id,
        "identifier": identifier,
        "role": "student",
        "gender": gender,
    })

    return TokenResponse(
        access_token=token,
        user_id=user_id,
        identifier=identifier,
        full_name=f"{surname} {first_name}",
        gender=gender,
        role="student",
        study_type=study_type,
        level=level,
        department=department,
    )


# ── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin):
    identifier = data.identifier.strip().upper()

    with get_cursor() as cur:
        cur.execute(
            """SELECT id, surname, first_name, gender, role, password_hash,
                      study_type, level, department
               FROM users WHERE identifier = %s""",
            (identifier,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id, surname, first_name, gender, role, pw_hash, study_type, level, department = row

    if not pw_hash:
        raise HTTPException(status_code=401, detail="Account requires password reset.")

    try:
        valid = _verify_password(data.password, pw_hash)
    except Exception:
        raise HTTPException(status_code=401, detail="Account requires password reset.")

    if not valid:
        raise HTTPException(status_code=401, detail="Invalid login credentials")

    token = _create_token({
        "sub": str(user_id),
        "user_id": user_id,
        "identifier": identifier,
        "role": role,
        "gender": gender,
    })

    return TokenResponse(
        access_token=token,
        user_id=user_id,
        identifier=identifier,
        full_name=f"{surname} {first_name}",
        gender=gender,
        role=role,
        study_type=study_type,
        level=level,
        department=department,
    )


# ── Password Change ──────────────────────────────────────────────────────────

from pydantic import BaseModel


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
):
    """
    Authenticated — verifies current password then updates to new password.
    Requires Bearer token; identifier is taken from the JWT, not the request body.
    """
    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    with get_cursor() as cur:
        cur.execute(
            "SELECT id, password_hash FROM users WHERE id = %s",
            (user["user_id"],),
        )
        row = cur.fetchone()

    if not row or not _verify_password(data.current_password, row[1]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    new_hash = _hash_password(data.new_password)
    with get_cursor() as cur:
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, row[0]))

    log_event(
        PASSWORD_CHANGED,
        actor_type=user["role"],
        actor_id=user["identifier"],
        description=f"Password changed for {user['identifier']}",
        target_entity="user",
        target_id=str(user["user_id"]),
    )

    return {"message": "Password changed successfully."}

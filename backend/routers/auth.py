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

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from jose import jwt
from passlib.context import CryptContext

from config import JWT_ALGORITHM, JWT_EXPIRY_MINUTES, JWT_SECRET
from database import get_cursor
from models import TokenResponse, UserLogin, UserRegister
from dependencies import get_current_user
from services.audit_logger import log_event, STUDENT_REGISTERED, PASSWORD_CHANGED
from services.email import send_registration_email, send_password_reset_email

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
                      sr.level, sr.study_type, sr.faculty, sr.email
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
        "email": row[7] or "",
    }


# ── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserRegister, background_tasks: BackgroundTasks):
    identifier = data.identifier.strip().upper()

    with get_cursor() as cur:
        # 1. Check session register
        cur.execute(
            """SELECT sr.surname, sr.first_name, sr.gender, sr.department,
                      sr.level, sr.study_type, sr.faculty, sr.session_id, sr.email
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

        surname, first_name, gender, department, level, study_type, faculty, session_id, reg_email = reg_row

        # Use email from registration form; fall back to session_register email
        student_email = data.email.strip() or (reg_email or "").strip()

        # Validate Gmail-only email
        if not student_email or not student_email.lower().endswith("@gmail.com"):
            raise HTTPException(
                status_code=422,
                detail="Only @gmail.com email addresses are accepted. Please provide a valid Gmail address.",
            )

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
                student_email or None,
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

    # Trigger the background email task — email is always required
    if student_email:
        background_tasks.add_task(
            send_registration_email, student_email, first_name, identifier,
            user_id=user_id, session_id=session_id,
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
# ── Profile Management ─────────────────────────────────────────────────────────

from typing import Optional

class UpdateProfileRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None


@router.get("/profile")
def get_profile(user: dict = Depends(get_current_user)):
    """Fetch the authenticated user's profile information."""
    with get_cursor() as cur:
        cur.execute(
            """SELECT identifier, surname, first_name, email, phone, gender, 
                      department, level, study_type, role, next_of_kin_name, next_of_kin_phone
               FROM users WHERE id = %s""",
            (user["user_id"],),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "identifier": row[0],
        "surname": row[1],
        "first_name": row[2],
        "email": row[3],
        "phone": row[4],
        "gender": row[5],
        "department": row[6],
        "level": row[7],
        "study_type": row[8],
        "role": row[9],
        "next_of_kin_name": row[10],
        "next_of_kin_phone": row[11]
    }


@router.put("/profile")
def update_profile(
    data: UpdateProfileRequest,
    user: dict = Depends(get_current_user)
):
    """Update the authenticated user's contact and next of kin information."""
    update_fields = []
    params = []
    
    if data.email is not None:
        update_fields.append("email = %s")
        params.append(data.email.strip() or None)
        
    if data.phone is not None:
        update_fields.append("phone = %s")
        params.append(data.phone.strip() or None)
        
    if data.next_of_kin_name is not None:
        update_fields.append("next_of_kin_name = %s")
        params.append(data.next_of_kin_name.strip() or None)
        
    if data.next_of_kin_phone is not None:
        update_fields.append("next_of_kin_phone = %s")
        params.append(data.next_of_kin_phone.strip() or None)

    if not update_fields:
        return {"message": "No fields to update."}

    params.append(user["user_id"])
    
    with get_cursor() as cur:
        cur.execute(
            f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s",
            params
        )

    log_event(
        "PROFILE_UPDATED",
        actor_type=user["role"],
        actor_id=user["identifier"],
        description=f"Profile updated for {user['identifier']}",
        target_entity="user",
        target_id=str(user["user_id"]),
    )

    return {"message": "Profile updated successfully."}


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


# ── Forgot Password ──────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _create_reset_token(user_id: int, identifier: str) -> str:
    """Create a short-lived JWT token for password reset (15 minutes)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    return jwt.encode(
        {"sub": str(user_id), "identifier": identifier, "purpose": "password_reset", "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    """
    Send a password reset email if the email exists in the system.
    Always returns success to prevent email enumeration attacks.
    """
    email = data.email.strip().lower()

    if not email:
        return {"message": "If an account exists with that email, we've sent reset instructions."}

    with get_cursor() as cur:
        cur.execute(
            "SELECT id, identifier, first_name, email FROM users WHERE LOWER(email) = %s LIMIT 1",
            (email,),
        )
        row = cur.fetchone()

    if row:
        user_id, identifier, first_name, user_email = row
        reset_token = _create_reset_token(user_id, identifier)
        result = send_password_reset_email(user_email, first_name or "Student", reset_token)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to send reset email. Please try again later.")

    # Always return same response to prevent email enumeration
    return {"message": "If an account exists with that email, we've sent reset instructions."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    """
    Reset password using a token from the reset email.
    """
    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    try:
        payload = jwt.decode(data.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    except jwt.JWTError:
        raise HTTPException(status_code=400, detail="Invalid reset link. Please request a new one.")

    if payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid token type.")

    user_id = int(payload["sub"])
    identifier = payload.get("identifier", "")

    new_hash = _hash_password(data.new_password)
    with get_cursor() as cur:
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (new_hash, user_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="User account not found.")

    log_event(
        PASSWORD_CHANGED,
        actor_type="student",
        actor_id=identifier,
        description=f"Password reset via email for {identifier}",
        target_entity="user",
        target_id=str(user_id),
    )

    return {"message": "Password has been reset successfully. You can now log in."}

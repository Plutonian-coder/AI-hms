"""
Auth Router — Registration and Login powered by Supabase Auth for simplicity.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from models import UserRegister, UserLogin, TokenResponse
from database import get_cursor
from config import supabase

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

def _make_email(identifier: str) -> str:
    """Creates a deterministic pseudo-email for Supabase Auth"""
    return f"{identifier.lower()}@yabatech.edu.ng"

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: UserRegister):
    data.identifier = data.identifier.strip().upper()
    # SECURITY: Always force role to student — admins must be created manually in the database
    data.role = "student"
    email = _make_email(data.identifier)
    
    # Check if identifier already exists in Postgres
    with get_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE identifier = %s", (data.identifier,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Identifier already registered")

    # 1. Sign up via Supabase Auth
    try:
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": data.password,
            "options": {
                "data": {
                    "identifier": data.identifier,
                    "role": data.role
                }
            }
        })
    except Exception as e:
        # If user already exists in Supabase Auth (e.g. after DB wipe), try signing in
        try:
            auth_response = supabase.auth.sign_in_with_password({"email": email, "password": data.password})
        except Exception:
            raise HTTPException(status_code=400, detail="Registration failed. If you already have an account, try logging in after re-registering.")
        
    session = auth_response.session
    if not session:
        # If email confirmation is ON in the Supabase Dashboard, session is None
        raise HTTPException(status_code=400, detail="Supabase requires Email Confirmation to be disabled for seamless registration.")

    # 2. Insert into our Postgres Custom users table for Foreign Keys
    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO users (identifier, surname, first_name, gender, password_hash, role)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (data.identifier, data.surname, data.first_name, data.gender, "supabase_auth", data.role),
        )
        user_id = cur.fetchone()[0]

    return TokenResponse(
        access_token=session.access_token,
        user_id=user_id,
        identifier=data.identifier,
        full_name=f"{data.surname} {data.first_name}",
        gender=data.gender,
        role=data.role
    )

@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin):
    data.identifier = data.identifier.strip().upper()
    email = _make_email(data.identifier)
    
    try:
        # Sign In via Supabase Local Auth
        auth_response = supabase.auth.sign_in_with_password({"email": email, "password": data.password})
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials or " + str(e))
        
    session = auth_response.session
    if not session:
        raise HTTPException(status_code=401, detail="Could not retrieve session from Supabase")

    # Fetch custom user local profile from Postgres
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, surname, first_name, gender, role FROM users WHERE identifier = %s",
            (data.identifier,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=401,
            detail="Account not found. Please register first."
        )

    user_id, surname, first_name, gender, role = row
    
    return TokenResponse(
        access_token=session.access_token,
        user_id=user_id,
        identifier=data.identifier,
        full_name=f"{surname} {first_name}",
        gender=gender,
        role=role
    )


# ---- Password Reset ----

class ForgotPasswordRequest(BaseModel):
    identifier: str

class ResetPasswordRequest(BaseModel):
    access_token: str
    new_password: str



@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    """Send a password reset email via Supabase Auth."""
    identifier = data.identifier.strip().upper()
    email = _make_email(identifier)

    # Verify user exists in our DB
    with get_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE identifier = %s", (identifier,))
        if not cur.fetchone():
            # Don't reveal that the user doesn't exist
            return {"message": "If this account exists, a password reset link has been sent."}

    try:
        supabase.auth.reset_password_email(email)
    except Exception:
        pass  # Don't reveal errors to prevent account enumeration

    return {"message": "If this account exists, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    """Reset password using the access token from the recovery link."""
    try:
        supabase.auth.admin.update_user_by_id(
            # We use the token-based approach instead
            data.access_token,
            {"password": data.new_password}
        )
    except Exception:
        # Fallback: try setting session and updating
        try:
            user_response = supabase.auth.get_user(data.access_token)
            if not user_response or not user_response.user:
                raise HTTPException(status_code=400, detail="Invalid or expired reset token")
            supabase.auth.admin.update_user_by_id(
                user_response.user.id,
                {"password": data.new_password}
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail="Failed to reset password. The link may have expired.")

    return {"message": "Password has been reset successfully. You can now sign in."}


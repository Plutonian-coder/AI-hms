"""
Auth Router — Registration and Login powered by Supabase Auth for simplicity.
"""
from fastapi import APIRouter, HTTPException, status
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
                # Store extra metadata in auth.users just in case
                "data": {
                    "identifier": data.identifier,
                    "role": data.role
                }
            }
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
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
        # Self-Heal: User exists in Auth but not DB (happened before Confirm Email was disabled)
        with get_cursor() as cur:
            cur.execute(
                """INSERT INTO users (identifier, surname, first_name, gender, password_hash, role)
                   VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                (data.identifier, "Unknown", "Student", "male", "supabase_auth", "student"),
            )
            user_id = cur.fetchone()[0]
        surname, first_name, gender, role = "Unknown", "Student", "male", "student"
    else:
        user_id, surname, first_name, gender, role = row
    
    return TokenResponse(
        access_token=session.access_token,
        user_id=user_id,
        identifier=data.identifier,
        full_name=f"{surname} {first_name}",
        gender=gender,
        role=role
    )

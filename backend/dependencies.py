"""
Shared dependencies for FastAPI routing.
"""
from fastapi import HTTPException, Header, Depends
from config import supabase
from database import get_cursor

def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ", 1)[1]
    
    try:
        # Verify completely via Supabase API
        user_response = supabase.auth.get_user(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
        
    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid auth user")
        
    # Get metadata cached on signup
    meta = user_response.user.user_metadata or {}
    identifier = meta.get("identifier")
    
    # Alternatively query Postgres database since the email is deterministic
    with get_cursor() as cur:
        cur.execute("SELECT id, identifier, role, gender FROM users WHERE identifier = %s", (identifier,))
        row = cur.fetchone()
        
    if not row:
        raise HTTPException(status_code=404, detail="User record missing in PostgreSQL")
        
    return {
        "user_id": row[0],
        "identifier": row[1],
        "role": row[2],
        "gender": row[3]
    }

def get_current_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

def get_current_student(user=Depends(get_current_user)):
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="Student privileges required")
    return user

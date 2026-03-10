"""
Shared FastAPI dependencies for route protection.

get_current_user  — validates JWT, returns user dict with role baked-in
get_current_admin — guards admin-only routes (role == 'admin')
get_current_student — guards student-only routes (role == 'student')

The JWT is verified locally using our own secret — no network call to any
external auth service. This makes every authenticated request ~0ms faster
and removes Supabase Auth as a hard dependency.
"""
from fastapi import HTTPException, Header, Depends
from jose import jwt, JWTError, ExpiredSignatureError
from config import JWT_SECRET, JWT_ALGORITHM


def get_current_user(authorization: str = Header(...)):
    """
    Decode and validate the Bearer JWT.
    Returns a dict: {user_id, identifier, role, gender}
    Raises 401 if the token is missing, malformed, or expired.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or tampered token")

    # All these fields are written at login time — if any are missing the token is corrupt
    user_id    = payload.get("user_id")
    identifier = payload.get("identifier")
    role       = payload.get("role")
    gender     = payload.get("gender")

    if not user_id or not identifier or not role:
        raise HTTPException(status_code=401, detail="Token payload is incomplete")

    return {
        "user_id":    user_id,
        "identifier": identifier,
        "role":       role,
        "gender":     gender,
    }


def get_current_admin(user: dict = Depends(get_current_user)):
    """Allow only users whose JWT role == 'admin'."""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


def get_current_student(user: dict = Depends(get_current_user)):
    """Allow only users whose JWT role == 'student'."""
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="Student access only")
    return user

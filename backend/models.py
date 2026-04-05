"""
Shared Pydantic models for the HMS API.
"""
from pydantic import BaseModel, Field
from typing import List, Optional


# ── Auth ─────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    identifier: str                                   # matric number
    password: str = Field(..., min_length=8)
    email: str = ""
    phone: str = ""
    next_of_kin_name: str = ""
    next_of_kin_phone: str = ""


class UserLogin(BaseModel):
    identifier: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    user_id: int
    identifier: str
    full_name: str
    gender: str
    role: str
    study_type: Optional[str] = None
    level: Optional[str] = None
    department: Optional[str] = None


# ── Hostel Infrastructure ────────────────────────────────────────────────────

class HostelCreate(BaseModel):
    name: str
    gender_restriction: str = Field(..., pattern="^(male|female|mixed)$")
    status: str = Field(default="active", pattern="^(active|maintenance|decommissioned)$")


class HostelStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|maintenance|decommissioned)$")


class BlockCreate(BaseModel):
    hostel_id: int
    name: str = Field(..., min_length=1, max_length=50)


class BlockStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|maintenance)$")


class BulkRoomGenerate(BaseModel):
    num_rooms: int = Field(default=10, ge=4, le=50)
    beds_per_room: int = Field(default=4, ge=1, le=8)


# ── Fee Components ───────────────────────────────────────────────────────────

class FeeComponentCreate(BaseModel):
    name: str
    amount_fulltime: int = 0           # kobo
    amount_parttime: int = 0
    amount_sandwich: int = 0
    applies_to: str = Field(default="all", pattern="^(all|fulltime_only|parttime_only|sandwich_only|freshers_only)$")
    is_mandatory: bool = True
    sort_order: int = 0


class FeeComponentUpdate(BaseModel):
    name: Optional[str] = None
    amount_fulltime: Optional[int] = None
    amount_parttime: Optional[int] = None
    amount_sandwich: Optional[int] = None
    applies_to: Optional[str] = None
    is_mandatory: Optional[bool] = None
    sort_order: Optional[int] = None


# ── Sessions ─────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    session_name: str
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    eligible_levels: List[str] = []


# ── Allocation ───────────────────────────────────────────────────────────────

class RoommateInfo(BaseModel):
    identifier: str
    full_name: str
    compatibility_score: Optional[float] = None


class AllocationResult(BaseModel):
    hostel_name: str
    block_name: str
    room_number: str
    bed_number: int
    matched_from_preference: Optional[int] = None
    avg_compatibility_score: Optional[float] = None
    roommates: List[RoommateInfo] = []


# ── Hostel Info ──────────────────────────────────────────────────────────────

class HostelInfo(BaseModel):
    id: int
    name: str
    gender: str
    status: str
    capacity: int
    occupied: int
    available: int

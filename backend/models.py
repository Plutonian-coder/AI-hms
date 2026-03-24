"""
Shared Pydantic models.
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class UserRegister(BaseModel):
    identifier: str
    surname: str
    first_name: str
    gender: str = Field(..., pattern="^(male|female)$")
    role: str = Field(default="student", pattern="^(student|admin)$")
    password: str
    email: str = ""
    department: str = ""
    level: str = ""
    study_mode: str = Field(default="full_time", pattern="^(full_time|part_time)$")
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

class HostelCreate(BaseModel):
    name: str
    gender_restriction: str = Field(..., pattern="^(male|female|mixed)$")
    status: str = Field(default="active", pattern="^(active|maintenance|decommissioned)$")

class HostelStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|maintenance|decommissioned)$")

class BlockCreate(BaseModel):
    hostel_id: int
    name: str = Field(..., min_length=1, max_length=50)  # e.g. "Block A", "Wing 1"

class BlockStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|maintenance)$")

class BulkRoomGenerate(BaseModel):
    num_rooms: int = Field(default=10, ge=4, le=50, description="Min 4, Max 50 rooms per generation")
    beds_per_room: int = Field(default=4, ge=1, le=8, description="Max 8 beds per room")

class RoomCreate(BaseModel):
    block_id: int
    room_number: str

class RoommateInfo(BaseModel):
    identifier: str
    full_name: str

class AllocationResult(BaseModel):
    hostel_name: str
    block_name: str
    room_number: str
    bed_number: int
    roommates: List[RoommateInfo]

class RoomStudentInfo(BaseModel):
    student_id: int
    identifier: str
    full_name: str
    gender: str
    department: Optional[str]
    level: Optional[str]
    bed_number: int
    payment_status: str

class HostelPriceUpdate(BaseModel):
    prices: List[dict]  # [{program_type: str, amount: int}]

class HostelInfo(BaseModel):
    id: int
    name: str
    gender: str
    status: str
    capacity: int
    occupied: int
    available: int

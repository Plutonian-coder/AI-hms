"""
Shared Pydantic models.
"""
from pydantic import BaseModel, Field
from typing import List

class UserRegister(BaseModel):
    identifier: str
    surname: str
    first_name: str
    gender: str = Field(..., pattern="^(male|female)$")
    role: str = Field(default="student", pattern="^(student|admin)$")
    password: str

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
    gender_restriction: str

class RoomCreate(BaseModel):
    hostel_id: int
    room_number: str

class RoommateInfo(BaseModel):
    identifier: str
    full_name: str

class AllocationResult(BaseModel):
    hostel_name: str
    room_number: str
    bed_number: int
    roommates: List[RoommateInfo]

class HostelInfo(BaseModel):
    id: int
    name: str
    gender: str
    capacity: int
    occupied: int
    available: int

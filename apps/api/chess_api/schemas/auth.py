from pydantic import BaseModel, EmailStr, Field
from chess_api.models.user import UserRole


class ParentSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: UserRole
    name: str


class EmailVerifyRequest(BaseModel):
    token: str


class ChildProfileCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=4, le=18)
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    avatar: str = "default"


class ChildProfileResponse(BaseModel):
    id: int
    display_name: str
    age: int
    avatar: str
    teacher_user_id: int | None


class DeviceRegisterRequest(BaseModel):
    device_fingerprint: str
    name: str


class ChildPinLoginRequest(BaseModel):
    child_profile_id: int
    pin: str = Field(min_length=4, max_length=4)
    device_fingerprint: str

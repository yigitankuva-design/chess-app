import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.models import User, UserRole
from chess_api.schemas.auth import (
    ParentSignupRequest, LoginRequest, AuthResponse, EmailVerifyRequest,
)
from chess_api.services.password import hash_password, verify_password
from chess_api.services.jwt import encode_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/parent/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def parent_signup(
    payload: ParentSignupRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.parent,
        name=payload.name,
        email_verification_token=secrets.token_urlsafe(32),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Email sending added in Task 7
    token = encode_token({"user_id": user.id, "role": user.role.value})
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        name=user.name,
    )

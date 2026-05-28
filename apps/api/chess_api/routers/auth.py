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
from chess_api.services.email import send_verification_email

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

    try:
        await send_verification_email(user.email, user.email_verification_token, user.name)
    except Exception:
        import logging
        logging.exception("Failed to send verification email (signup continues)")

    token = encode_token({"user_id": user.id, "role": user.role.value})
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        name=user.name,
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = encode_token({"user_id": user.id, "role": user.role.value})
    return AuthResponse(
        access_token=token, user_id=user.id, role=user.role, name=user.name,
    )


@router.post(
    "/teacher/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def teacher_signup(
    payload: ParentSignupRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.teacher,
        name=payload.name,
        email_verification_token=secrets.token_urlsafe(32),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    try:
        await send_verification_email(user.email, user.email_verification_token, user.name)
    except Exception:
        import logging
        logging.exception("Failed to send verification email (signup continues)")

    token = encode_token({"user_id": user.id, "role": user.role.value})
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        name=user.name,
    )


@router.post("/verify-email")
async def verify_email(payload: EmailVerifyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email_verification_token == payload.token)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid token")
    user.email_verified = True
    user.email_verification_token = None
    await db.commit()
    return {"verified": True}

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models import User, ChildProfile
from chess_api.services.jwt import decode_token, TokenInvalid

bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except TokenInvalid:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Madde 2026-09-09 (Üyelik Girişi Yenileme): /auth/login'deki AYNI
    # kontrol burada da var — signup ANINDA verilen token'la (henüz
    # /auth/login'e hiç uğramadan) korumalı uçlara erişilmesin diye.
    if user.approval_status == "pending":
        raise HTTPException(status_code=403, detail="Hesabınız onay bekliyor")
    return user


async def get_current_child(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> ChildProfile:
    try:
        payload = decode_token(credentials.credentials)
    except TokenInvalid:
        raise HTTPException(status_code=401, detail="Invalid token")
    child_id = payload.get("child_profile_id")
    if not child_id:
        raise HTTPException(status_code=401, detail="Child token required")
    child = await db.get(ChildProfile, child_id)
    if not child:
        raise HTTPException(status_code=401, detail="Child not found")
    return child

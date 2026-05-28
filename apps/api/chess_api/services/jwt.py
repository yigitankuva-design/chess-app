from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from chess_api.settings import settings


class TokenInvalid(Exception):
    pass


def encode_token(payload: dict, custom_exp: datetime | None = None) -> str:
    s = settings()
    to_encode = payload.copy()
    exp = custom_exp or (datetime.now(timezone.utc) + timedelta(minutes=s.JWT_EXPIRE_MINUTES))
    to_encode["exp"] = exp
    return jwt.encode(to_encode, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    s = settings()
    try:
        return jwt.decode(token, s.JWT_SECRET, algorithms=[s.JWT_ALGORITHM])
    except JWTError as e:
        raise TokenInvalid(str(e))

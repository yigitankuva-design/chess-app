# Plan 2: Auth + Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build authentication for three user types — Parent (email/password + JWT + email verification), Teacher (separate flow), Child (PIN on a trusted device). All sessions secure, tested, deployed.

**Architecture:** SQLAlchemy models + Alembic migration for User/ChildProfile/Device. FastAPI dependencies for current-user resolution. JWT with refresh tokens. Bcrypt for passwords/PINs. Device fingerprinting + signed cookie for child PIN binding. Frontend: signup/login forms with react-hook-form + zod, protected routes via middleware.

**Tech Stack:** SQLAlchemy 2 (async), Alembic, passlib (bcrypt), python-jose (JWT), fastapi-mail (SendGrid), react-hook-form, zod, NextAuth pattern (manual, no library).

**Bağımlılık:** Plan 1 (Foundation) tüm acceptance test'leri yeşil olmalı.
**Süre tahmini:** 2 hafta
**Test geçidi:** Plan sonundaki Acceptance Tests yeşil olmadan Plan 3'e geçilmez.

---

## File Structure

```
apps/api/chess_api/
├── models/
│   ├── __init__.py
│   ├── user.py                 # User (parent | teacher)
│   ├── child.py                # ChildProfile
│   └── device.py               # Device
├── schemas/
│   ├── __init__.py
│   └── auth.py                 # Pydantic request/response
├── services/
│   ├── __init__.py
│   ├── password.py             # bcrypt hash/verify
│   ├── jwt.py                  # encode/decode JWT
│   └── email.py                # email verification send
├── routers/
│   └── auth.py                 # All /auth/* endpoints
├── dependencies/
│   ├── __init__.py
│   └── auth.py                 # get_current_user, get_current_child
└── alembic/versions/
    └── XXXX_create_auth_tables.py

apps/web/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── parent-signup/page.tsx
│   │   ├── parent-login/page.tsx
│   │   ├── teacher-login/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── device-setup/page.tsx
│   │   └── child-pin/page.tsx
│   └── middleware.ts
├── lib/
│   ├── auth-context.tsx
│   ├── auth-storage.ts          # Token + device fingerprint
│   └── api-client.ts            # (extended)
└── tests/
    ├── auth-flow.test.tsx
    └── auth-storage.test.ts
```

---

## Task 1: Auth Database Models

**Files:**
- Create: `apps/api/chess_api/models/__init__.py`
- Create: `apps/api/chess_api/models/user.py`
- Create: `apps/api/chess_api/models/child.py`
- Create: `apps/api/chess_api/models/device.py`

- [ ] **Step 1.1: `models/__init__.py`**

```python
from chess_api.models.user import User, UserRole
from chess_api.models.child import ChildProfile
from chess_api.models.device import Device

__all__ = ["User", "UserRole", "ChildProfile", "Device"]
```

- [ ] **Step 1.2: `models/user.py`**

```python
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class UserRole(str, enum.Enum):
    parent = "parent"
    teacher = "teacher"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    name: Mapped[str] = mapped_column(String(120))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verification_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

- [ ] **Step 1.3: `models/child.py`**

```python
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ChildProfile(Base):
    __tablename__ = "child_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    age: Mapped[int] = mapped_column(Integer)
    avatar: Mapped[str] = mapped_column(String(40), default="default")
    pin_hash: Mapped[str] = mapped_column(String(255))
    teacher_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

- [ ] **Step 1.4: `models/device.py`**

```python
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    device_fingerprint: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    trusted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    active_child_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("child_profiles.id"), nullable=True
    )
```

- [ ] **Step 1.5: Alembic migration oluştur**

```bash
cd apps/api
alembic revision --autogenerate -m "create auth tables"
```

Oluşan migration dosyasını incele (`alembic/versions/XXX_create_auth_tables.py`), `users`, `child_profiles`, `devices` tablolarını içerdiğini doğrula.

- [ ] **Step 1.6: Migration uygula (lokal)**

```bash
alembic upgrade head
```

- [ ] **Step 1.7: Commit**

```bash
git add apps/api/chess_api/models/ apps/api/alembic/versions/
git commit -m "feat(auth): User, ChildProfile, Device models + migration"
```

---

## Task 2: Password Hashing Service

**Files:**
- Create: `apps/api/chess_api/services/__init__.py`
- Create: `apps/api/chess_api/services/password.py`
- Create: `apps/api/tests/test_password_service.py`

- [ ] **Step 2.1: `services/__init__.py`** (boş)

- [ ] **Step 2.2: TDD — failing test: `tests/test_password_service.py`**

```python
import pytest
from chess_api.services.password import hash_password, verify_password


def test_hash_password_returns_different_hash_each_time():
    h1 = hash_password("secret123")
    h2 = hash_password("secret123")
    assert h1 != h2

def test_verify_password_correct():
    h = hash_password("secret123")
    assert verify_password("secret123", h) is True

def test_verify_password_wrong():
    h = hash_password("secret123")
    assert verify_password("wrong", h) is False

def test_hash_password_minimum_length():
    with pytest.raises(ValueError):
        hash_password("abc")
```

- [ ] **Step 2.3: Test'i çalıştır, fail görmesini bekle**

```bash
pytest tests/test_password_service.py -v
```

Beklenen: ImportError çünkü modül yok.

- [ ] **Step 2.4: `services/password.py` yaz**

```python
from passlib.context import CryptContext

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

MIN_PASSWORD_LENGTH = 8


def hash_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    return _pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_ctx.verify(plain, hashed)
    except Exception:
        return False
```

- [ ] **Step 2.5: Test'i geçirt**

```bash
pytest tests/test_password_service.py -v
```

Beklenen: 4 passed.

- [ ] **Step 2.6: Commit**

```bash
git add apps/api/chess_api/services/ apps/api/tests/test_password_service.py
git commit -m "feat(auth): bcrypt password hash/verify service"
```

---

## Task 3: JWT Service

**Files:**
- Create: `apps/api/chess_api/services/jwt.py`
- Create: `apps/api/tests/test_jwt_service.py`

- [ ] **Step 3.1: TDD — failing test: `tests/test_jwt_service.py`**

```python
from datetime import datetime, timedelta, timezone
from chess_api.services.jwt import encode_token, decode_token, TokenInvalid
import pytest


def test_encode_decode_roundtrip():
    payload = {"user_id": 42, "role": "parent"}
    token = encode_token(payload)
    decoded = decode_token(token)
    assert decoded["user_id"] == 42
    assert decoded["role"] == "parent"
    assert "exp" in decoded

def test_decode_invalid_token_raises():
    with pytest.raises(TokenInvalid):
        decode_token("not.a.real.token")

def test_decode_expired_token_raises():
    payload = {"user_id": 1, "exp": datetime.now(timezone.utc) - timedelta(hours=1)}
    token = encode_token(payload, custom_exp=datetime.now(timezone.utc) - timedelta(hours=1))
    with pytest.raises(TokenInvalid):
        decode_token(token)
```

- [ ] **Step 3.2: `services/jwt.py` yaz**

```python
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
```

- [ ] **Step 3.3: Test geçirt**

```bash
pytest tests/test_jwt_service.py -v
```

Beklenen: 3 passed.

- [ ] **Step 3.4: Commit**

```bash
git add apps/api/chess_api/services/jwt.py apps/api/tests/test_jwt_service.py
git commit -m "feat(auth): JWT encode/decode service"
```

---

## Task 4: Pydantic Schemas

**Files:**
- Create: `apps/api/chess_api/schemas/__init__.py`
- Create: `apps/api/chess_api/schemas/auth.py`

- [ ] **Step 4.1: `schemas/__init__.py`** (boş)

- [ ] **Step 4.2: `schemas/auth.py`**

```python
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
```

- [ ] **Step 4.3: Commit**

```bash
git add apps/api/chess_api/schemas/
git commit -m "feat(auth): Pydantic schemas for auth endpoints"
```

---

## Task 5: Parent Signup Endpoint

**Files:**
- Create: `apps/api/chess_api/routers/auth.py`
- Modify: `apps/api/chess_api/main.py` (auth router include)
- Create: `apps/api/tests/test_auth_signup.py`

- [ ] **Step 5.1: TDD — failing test: `tests/test_auth_signup.py`**

```python
import pytest
from chess_api.models import User


async def test_parent_signup_creates_user(client, db):
    response = await client.post("/auth/parent/signup", json={
        "email": "anne@test.com",
        "password": "guvenliSifre1",
        "name": "Anne Test",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "parent"
    assert data["name"] == "Anne Test"
    assert "access_token" in data

    # Verify in DB
    result = await db.execute(
        User.__table__.select().where(User.email == "anne@test.com")
    )
    row = result.fetchone()
    assert row is not None
    assert row.email_verified is False

async def test_parent_signup_duplicate_email_rejected(client):
    await client.post("/auth/parent/signup", json={
        "email": "anne2@test.com",
        "password": "guvenliSifre1",
        "name": "Anne",
    })
    response = await client.post("/auth/parent/signup", json={
        "email": "anne2@test.com",
        "password": "baska",
        "name": "Tekrar",
    })
    assert response.status_code == 409

async def test_parent_signup_weak_password_rejected(client):
    response = await client.post("/auth/parent/signup", json={
        "email": "weak@test.com",
        "password": "123",
        "name": "Test",
    })
    assert response.status_code == 422
```

- [ ] **Step 5.2: `conftest.py`'ye db fixture ekle**

```python
# apps/api/tests/conftest.py içine ekle
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from chess_api.database import Base
from chess_api.settings import settings


@pytest_asyncio.fixture
async def db():
    # Use SQLite in-memory for tests
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()
```

`aiosqlite` paketini de `requirements.txt`'e ekle:
```
aiosqlite==0.20.0
```

- [ ] **Step 5.3: `routers/auth.py` yaz**

```python
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

    # TODO Task 7: send verification email here
    token = encode_token({"user_id": user.id, "role": user.role.value})
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        role=user.role,
        name=user.name,
    )
```

- [ ] **Step 5.4: `main.py`'ye router'ı ekle**

`apps/api/chess_api/main.py` içinde `from chess_api.routers import health` satırının altına:

```python
from chess_api.routers import health, auth as auth_router

# ... create_app içinde:
app.include_router(auth_router.router)
```

- [ ] **Step 5.5: Test'leri çalıştır**

```bash
pytest tests/test_auth_signup.py -v
```

Beklenen: 3 passed.

- [ ] **Step 5.6: Commit**

```bash
git add apps/api/
git commit -m "feat(auth): /auth/parent/signup endpoint with tests"
```

---

## Task 6: Login + Auth Dependency

**Files:**
- Create: `apps/api/chess_api/dependencies/__init__.py`
- Create: `apps/api/chess_api/dependencies/auth.py`
- Modify: `apps/api/chess_api/routers/auth.py` (login eklenir)
- Create: `apps/api/tests/test_auth_login.py`

- [ ] **Step 6.1: `dependencies/auth.py`**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.models import User
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
    return user
```

- [ ] **Step 6.2: TDD — failing test: `tests/test_auth_login.py`**

```python
async def test_parent_login_success(client):
    await client.post("/auth/parent/signup", json={
        "email": "login@test.com",
        "password": "guvenli1234",
        "name": "Login User",
    })
    response = await client.post("/auth/login", json={
        "email": "login@test.com",
        "password": "guvenli1234",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "parent"

async def test_login_wrong_password(client):
    await client.post("/auth/parent/signup", json={
        "email": "wrong@test.com",
        "password": "guvenli1234",
        "name": "W",
    })
    response = await client.post("/auth/login", json={
        "email": "wrong@test.com",
        "password": "yanlisSifre",
    })
    assert response.status_code == 401

async def test_login_unknown_email(client):
    response = await client.post("/auth/login", json={
        "email": "yok@test.com",
        "password": "yok",
    })
    assert response.status_code == 401
```

- [ ] **Step 6.3: `routers/auth.py`'ye login ekle**

```python
@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = encode_token({"user_id": user.id, "role": user.role.value})
    return AuthResponse(
        access_token=token, user_id=user.id, role=user.role, name=user.name
    )
```

- [ ] **Step 6.4: Test çalıştır**

```bash
pytest tests/test_auth_login.py -v
```

Beklenen: 3 passed.

- [ ] **Step 6.5: Commit**

```bash
git add apps/api/chess_api/dependencies/ apps/api/chess_api/routers/auth.py apps/api/tests/test_auth_login.py
git commit -m "feat(auth): /auth/login + get_current_user dependency"
```

---

## Task 7: Email Verification

**Files:**
- Create: `apps/api/chess_api/services/email.py`
- Modify: `apps/api/chess_api/routers/auth.py` (verify-email endpoint)
- Create: `apps/api/tests/test_email_verify.py`

- [ ] **Step 7.1: `services/email.py`**

```python
import logging
from fastapi_mail import FastMail, MessageSchema, MessageType, ConnectionConfig
from chess_api.settings import settings

logger = logging.getLogger(__name__)


def _config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME="apikey",
        MAIL_PASSWORD=getattr(settings(), "SENDGRID_API_KEY", ""),
        MAIL_FROM=getattr(settings(), "MAIL_FROM", "no-reply@chess-app.local"),
        MAIL_PORT=587,
        MAIL_SERVER="smtp.sendgrid.net",
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
    )


async def send_verification_email(to_email: str, token: str, name: str) -> None:
    s = settings()
    if s.ENV == "development":
        # Local dev: log instead of send
        logger.info("DEV: verification token for %s: %s", to_email, token)
        return

    verify_url = f"{s.CORS_ORIGINS.split(',')[0]}/verify-email?token={token}"
    message = MessageSchema(
        subject="E-postanızı doğrulayın — Çocuklar İçin Satranç",
        recipients=[to_email],
        body=f"Merhaba {name},\n\nE-postanızı doğrulamak için: {verify_url}\n\nİyi günler.",
        subtype=MessageType.plain,
    )
    fm = FastMail(_config())
    await fm.send_message(message)
```

`settings.py`'a ek alanlar:
```python
SENDGRID_API_KEY: str = ""
MAIL_FROM: str = "no-reply@chess-app.local"
```

- [ ] **Step 7.2: Signup'a email send entegre et**

`routers/auth.py` içinde `parent_signup` fonksiyonunda token oluşturduktan sonra:

```python
from chess_api.services.email import send_verification_email

# ... user.commit'ten sonra:
await send_verification_email(user.email, user.email_verification_token, user.name)
```

- [ ] **Step 7.3: Verify-email endpoint ekle**

```python
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
```

- [ ] **Step 7.4: Test ekle: `tests/test_email_verify.py`**

```python
from sqlalchemy import select
from chess_api.models import User


async def test_verify_email_flow(client, db):
    await client.post("/auth/parent/signup", json={
        "email": "verify@test.com",
        "password": "guvenli1234",
        "name": "V",
    })
    result = await db.execute(select(User).where(User.email == "verify@test.com"))
    user = result.scalar_one()
    token = user.email_verification_token
    assert token is not None

    response = await client.post("/auth/verify-email", json={"token": token})
    assert response.status_code == 200
    assert response.json()["verified"] is True

async def test_verify_email_bad_token(client):
    response = await client.post("/auth/verify-email", json={"token": "fake"})
    assert response.status_code == 404
```

- [ ] **Step 7.5: Test çalıştır**

```bash
pytest tests/test_email_verify.py -v
```

Beklenen: 2 passed.

- [ ] **Step 7.6: Commit**

```bash
git add apps/api/
git commit -m "feat(auth): email verification endpoint + SendGrid wiring"
```

---

## Task 8: Teacher Login + Child Profile Endpoints

**Files:**
- Modify: `apps/api/chess_api/routers/auth.py`
- Create: `apps/api/chess_api/routers/children.py`
- Create: `apps/api/tests/test_children.py`

- [ ] **Step 8.1: Teacher signup endpoint ekle (parent signup'a benzer)**

```python
@router.post("/teacher/signup", response_model=AuthResponse, status_code=201)
async def teacher_signup(payload: ParentSignupRequest, db: AsyncSession = Depends(get_db)):
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
    await send_verification_email(user.email, user.email_verification_token, user.name)
    token = encode_token({"user_id": user.id, "role": user.role.value})
    return AuthResponse(access_token=token, user_id=user.id, role=user.role, name=user.name)
```

- [ ] **Step 8.2: TDD — failing test: `tests/test_children.py`**

```python
async def _signup_parent(client, email="p@t.com"):
    r = await client.post("/auth/parent/signup", json={
        "email": email, "password": "guvenli12345", "name": "P",
    })
    return r.json()["access_token"]


async def test_create_child_profile(client):
    token = await _signup_parent(client)
    response = await client.post(
        "/children",
        headers={"Authorization": f"Bearer {token}"},
        json={"display_name": "Ali", "age": 10, "pin": "1234"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["display_name"] == "Ali"
    assert data["age"] == 10
    assert "pin" not in data  # PIN should NEVER be in response

async def test_list_my_children(client):
    token = await _signup_parent(client, "list@t.com")
    headers = {"Authorization": f"Bearer {token}"}
    await client.post("/children", headers=headers, json={
        "display_name": "Veli", "age": 8, "pin": "1111",
    })
    await client.post("/children", headers=headers, json={
        "display_name": "Ayşe", "age": 12, "pin": "2222",
    })
    response = await client.get("/children", headers=headers)
    assert response.status_code == 200
    children = response.json()
    assert len(children) == 2

async def test_create_child_requires_auth(client):
    response = await client.post("/children", json={
        "display_name": "X", "age": 10, "pin": "1234",
    })
    assert response.status_code == 403  # No bearer
```

- [ ] **Step 8.3: `routers/children.py` yaz**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, ChildProfile, UserRole
from chess_api.schemas.auth import ChildProfileCreate, ChildProfileResponse
from chess_api.services.password import hash_password

router = APIRouter(prefix="/children", tags=["children"])


@router.post("", response_model=ChildProfileResponse, status_code=201)
async def create_child(
    payload: ChildProfileCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Only parents can create children")
    child = ChildProfile(
        parent_user_id=current.id,
        display_name=payload.display_name,
        age=payload.age,
        avatar=payload.avatar,
        pin_hash=hash_password(payload.pin),
    )
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return ChildProfileResponse(
        id=child.id,
        display_name=child.display_name,
        age=child.age,
        avatar=child.avatar,
        teacher_user_id=child.teacher_user_id,
    )


@router.get("", response_model=list[ChildProfileResponse])
async def list_children(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Only parents")
    result = await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == current.id)
    )
    return [
        ChildProfileResponse(
            id=c.id, display_name=c.display_name, age=c.age,
            avatar=c.avatar, teacher_user_id=c.teacher_user_id,
        )
        for c in result.scalars().all()
    ]
```

- [ ] **Step 8.4: `main.py`'a router ekle**

```python
from chess_api.routers import health, auth as auth_router, children as children_router
# ...
app.include_router(children_router.router)
```

- [ ] **Step 8.5: Test çalıştır**

```bash
pytest tests/test_children.py -v
```

Beklenen: 3 passed.

- [ ] **Step 8.6: Commit**

```bash
git add apps/api/
git commit -m "feat(auth): teacher signup + child profile CRUD"
```

---

## Task 9: Device Registration + Child PIN Login

**Files:**
- Modify: `apps/api/chess_api/routers/auth.py`
- Create: `apps/api/tests/test_device_child.py`

- [ ] **Step 9.1: TDD — failing test: `tests/test_device_child.py`**

```python
async def _setup_parent_with_child(client):
    r = await client.post("/auth/parent/signup", json={
        "email": "pc@t.com", "password": "guvenli12345", "name": "PC",
    })
    parent_token = r.json()["access_token"]
    r = await client.post(
        "/children",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"display_name": "Ali", "age": 10, "pin": "1234"},
    )
    child_id = r.json()["id"]
    return parent_token, child_id


async def test_register_device(client):
    parent_token, _ = await _setup_parent_with_child(client)
    response = await client.post(
        "/auth/device/register",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"device_fingerprint": "abc123fingerprint", "name": "Anne tablet"},
    )
    assert response.status_code == 201

async def test_child_pin_login_on_trusted_device(client):
    parent_token, child_id = await _setup_parent_with_child(client)
    await client.post(
        "/auth/device/register",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"device_fingerprint": "dev1", "name": "Test"},
    )
    response = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id,
        "pin": "1234",
        "device_fingerprint": "dev1",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["child_profile_id"] == child_id

async def test_child_pin_login_wrong_pin(client):
    parent_token, child_id = await _setup_parent_with_child(client)
    await client.post(
        "/auth/device/register",
        headers={"Authorization": f"Bearer {parent_token}"},
        json={"device_fingerprint": "dev2", "name": "Test"},
    )
    response = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id,
        "pin": "9999",
        "device_fingerprint": "dev2",
    })
    assert response.status_code == 401

async def test_child_pin_login_untrusted_device(client):
    parent_token, child_id = await _setup_parent_with_child(client)
    # device NOT registered
    response = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id,
        "pin": "1234",
        "device_fingerprint": "unknown",
    })
    assert response.status_code == 403
```

- [ ] **Step 9.2: Device + child PIN endpoint'leri ekle**

`routers/auth.py`'ye:

```python
from chess_api.models import Device, ChildProfile
from chess_api.schemas.auth import DeviceRegisterRequest, ChildPinLoginRequest
from chess_api.dependencies.auth import get_current_user


@router.post("/device/register", status_code=201)
async def register_device(
    payload: DeviceRegisterRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Parents only")
    device = Device(
        parent_user_id=current.id,
        device_fingerprint=payload.device_fingerprint,
        name=payload.name,
    )
    db.add(device)
    await db.commit()
    return {"registered": True}


@router.post("/child/pin")
async def child_pin_login(
    payload: ChildPinLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    # Look up child + verify parent-device link
    child = await db.get(ChildProfile, payload.child_profile_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    device_result = await db.execute(
        select(Device).where(
            Device.device_fingerprint == payload.device_fingerprint,
            Device.parent_user_id == child.parent_user_id,
        )
    )
    device = device_result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=403, detail="Untrusted device")

    if not verify_password(payload.pin, child.pin_hash):
        raise HTTPException(status_code=401, detail="Invalid PIN")

    token = encode_token({
        "child_profile_id": child.id,
        "parent_user_id": child.parent_user_id,
        "role": "child",
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "child_profile_id": child.id,
        "display_name": child.display_name,
    }
```

- [ ] **Step 9.3: Test çalıştır**

```bash
pytest tests/test_device_child.py -v
```

Beklenen: 4 passed.

- [ ] **Step 9.4: Commit**

```bash
git add apps/api/
git commit -m "feat(auth): device registration + child PIN login flow"
```

---

## Task 10: Frontend Auth — Storage + Context

**Files:**
- Create: `apps/web/lib/auth-storage.ts`
- Create: `apps/web/lib/auth-context.tsx`
- Create: `apps/web/tests/auth-storage.test.ts`

- [ ] **Step 10.1: TDD — `tests/auth-storage.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveToken, getToken, clearAuth,
  saveDeviceFingerprint, getDeviceFingerprint,
} from '@/lib/auth-storage';

describe('auth-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reads token', () => {
    saveToken('jwt-token');
    expect(getToken()).toBe('jwt-token');
  });

  it('clears auth removes token', () => {
    saveToken('jwt-token');
    clearAuth();
    expect(getToken()).toBeNull();
  });

  it('generates and persists device fingerprint', () => {
    const fp1 = getDeviceFingerprint();
    const fp2 = getDeviceFingerprint();
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 10.2: `lib/auth-storage.ts`**

```typescript
const TOKEN_KEY = 'chess_app_token';
const FINGERPRINT_KEY = 'chess_app_device_fp';

export function saveToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return '';
  let fp = localStorage.getItem(FINGERPRINT_KEY);
  if (!fp) {
    const random = crypto.randomUUID();
    const ua = navigator.userAgent.slice(0, 50);
    fp = btoa(`${random}-${ua}`).slice(0, 64);
    localStorage.setItem(FINGERPRINT_KEY, fp);
  }
  return fp;
}

export function saveDeviceFingerprint(fp: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FINGERPRINT_KEY, fp);
}
```

- [ ] **Step 10.3: Test geçirt**

```bash
cd apps/web && npm test
```

Beklenen: tüm testler passed.

- [ ] **Step 10.4: `lib/auth-context.tsx`**

```typescript
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getToken, saveToken, clearAuth } from './auth-storage';

interface AuthState {
  token: string | null;
  role: 'parent' | 'teacher' | 'child' | null;
  userId: number | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, role: AuthState['role'], userId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null, role: null, userId: null,
  });

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setState({
          token,
          role: payload.role || null,
          userId: payload.user_id || payload.child_profile_id || null,
        });
      } catch {
        clearAuth();
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login: (token, role, userId) => {
        saveToken(token);
        setState({ token, role, userId });
      },
      logout: () => {
        clearAuth();
        setState({ token: null, role: null, userId: null });
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 10.5: `app/layout.tsx`'i AuthProvider'la sar**

```tsx
import { AuthProvider } from '@/lib/auth-context';

// RootLayout return içinde:
<body>
  <AuthProvider>{children}</AuthProvider>
</body>
```

- [ ] **Step 10.6: Commit**

```bash
git add apps/web/lib/ apps/web/tests/auth-storage.test.ts apps/web/app/layout.tsx
git commit -m "feat(web): auth storage + React context"
```

---

## Task 11: Frontend Auth — Signup/Login UI

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/parent-signup/page.tsx`
- Create: `apps/web/app/(auth)/parent-login/page.tsx`
- Modify: `apps/web/lib/api-client.ts` (auth endpoints ekle)
- Install: `react-hook-form`, `zod`, `@hookform/resolvers`

- [ ] **Step 11.1: Bağımlılıkları kur**

```bash
cd apps/web
npm install react-hook-form zod @hookform/resolvers
```

- [ ] **Step 11.2: `lib/api-client.ts`'i genişlet**

`apiClient`'a ekle:

```typescript
import { getToken } from './auth-storage';

// Modified request to include auth header
async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  return request<T>(path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: token ? `Bearer ${token}` : '' },
  });
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: 'parent' | 'teacher';
  name: string;
}

apiClient.parentSignup = (data: {
  email: string; password: string; name: string;
}) => request<AuthResponse>('/auth/parent/signup', {
  method: 'POST', body: JSON.stringify(data),
});

apiClient.login = (data: { email: string; password: string }) =>
  request<AuthResponse>('/auth/login', {
    method: 'POST', body: JSON.stringify(data),
  });
```

(TypeScript için const yerine class veya let kullan; düzenleme detayı implementasyon sırasında yapılır.)

- [ ] **Step 11.3: `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
```

- [ ] **Step 11.4: `app/(auth)/parent-signup/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  email: z.string().email('Geçerli e-posta gir'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  name: z.string().min(2, 'İsim gerekli'),
});

type FormData = z.infer<typeof schema>;

export default function ParentSignupPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const res = await apiClient.parentSignup(data);
      auth.login(res.access_token, res.role, res.user_id);
      router.push('/parent/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kayıt başarısız');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-3xl font-bold mb-6">Veli Kayıt</h1>
      <input
        {...register('name')}
        placeholder="Adınız"
        className="w-full p-3 border rounded"
      />
      {errors.name && <p className="text-red-600">{errors.name.message}</p>}

      <input
        {...register('email')}
        type="email"
        placeholder="E-posta"
        className="w-full p-3 border rounded"
      />
      {errors.email && <p className="text-red-600">{errors.email.message}</p>}

      <input
        {...register('password')}
        type="password"
        placeholder="Şifre (en az 8 karakter)"
        className="w-full p-3 border rounded"
      />
      {errors.password && <p className="text-red-600">{errors.password.message}</p>}

      {error && <p className="text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Kayıt...' : 'Hesap Aç'}
      </button>
    </form>
  );
}
```

- [ ] **Step 11.5: `app/(auth)/parent-login/page.tsx`** (signup'a benzer, sadece login mantığı)

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default function ParentLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auth = useAuth();
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setError(null);
    try {
      const res = await apiClient.login(data);
      auth.login(res.access_token, res.role, res.user_id);
      router.push('/parent/dashboard');
    } catch {
      setError('E-posta veya şifre yanlış');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h1 className="text-3xl font-bold mb-6">Veli Giriş</h1>
      <input {...register('email')} type="email" placeholder="E-posta" className="w-full p-3 border rounded" />
      <input {...register('password')} type="password" placeholder="Şifre" className="w-full p-3 border rounded" />
      {error && <p className="text-red-600">{error}</p>}
      <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded">Giriş</button>
    </form>
  );
}
```

- [ ] **Step 11.6: Manuel test — dev sunucularını çalıştır**

```bash
# Terminal 1
cd apps/api && uvicorn chess_api.main:app --reload

# Terminal 2
cd apps/web && npm run dev
```

`http://localhost:3000/parent-signup` aç, formu doldur, başarılı kayıt + token storage'da görünmeli.

- [ ] **Step 11.7: Commit**

```bash
git add apps/web/
git commit -m "feat(web): parent signup + login pages"
```

---

## ACCEPTANCE TESTS — Plan 2 Test Geçidi

### Lokal Birim Testler
- [ ] `cd apps/api && pytest tests/ -v` → tüm auth testleri yeşil (password, jwt, signup, login, verify, children, device, child-pin) → en az 18 test geçer
- [ ] `cd apps/web && npm test` → auth-storage + smoke + api-client → tüm testler geçer

### Lokal E2E Testler (yeni Playwright senaryosu)
Create: `e2e/tests/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('parent signup → dashboard redirect', async ({ page }) => {
  await page.goto('/parent-signup');
  await page.fill('[placeholder="Adınız"]', 'Test Anne');
  await page.fill('[type="email"]', `t${Date.now()}@test.com`);
  await page.fill('[type="password"]', 'guvenliSifre1');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*parent.*dashboard.*/, { timeout: 5000 });
});
```

- [ ] `cd e2e && npm test` → 2/2 passed (smoke + auth)

### Manuel Doğrulama
- [ ] http://localhost:3000/parent-signup formu görünür, doldurulduğunda backend'e gider, başarılı kayıt token döner
- [ ] http://localhost:3000/parent-login mevcut hesapla giriş yapılır
- [ ] localStorage'da `chess_app_token` görünür
- [ ] localStorage'da `chess_app_device_fp` üretilir
- [ ] Yanlış şifre ile login → 401 + UI'da hata mesajı
- [ ] Bad request → Pydantic 422 + UI'da alan hatası
- [ ] Lokal: `ENV=development` ile e-posta doğrulama token'ı log'a düşer

### Canlı Ortam
- [ ] Migration Railway'de uygulandı (`alembic upgrade head` Railway shell'inden)
- [ ] Production'da `/auth/parent/signup` 201 döner
- [ ] Sentry'de auth hataları yakalanıyor (opsiyonel ama önerilen)

### CI Testleri
- [ ] GitHub push → Actions yeşil (web + api + e2e)

### Repo Sağlığı
- [ ] `.env` dosyaları repo'da yok
- [ ] JWT_SECRET production'da güçlü (en az 32 karakter random)
- [ ] CORS doğru yapılandırılmış (sadece Vercel domain'i izinli)

**Tümü ✅ ise Plan 3'e geç.**

---

## Self-Review Notları

- Bu plan spec'in 5. ve 6. bölümlerini (Kullanıcı Tipleri ve Akışlar + Auth & Identity tabloları) implement eder.
- Eksik bırakılan: Parola sıfırlama (forgot-password) — V1.1'e bırakıldı, spec'te kritik yol değil.
- Eksik bırakılan: 2FA — V2'ye.
- Cihaz fingerprint zayıf bir güvenlik mekanizması, ancak çocuk hedefli ürünlerde "düşman model"i zayıf (rakip çocuk veliyi geçemiyor, başka cihazdan çocuk hesabı çalmaya çalışıyor). Bu seviye yeterli.
- Token saklama: localStorage (XSS riski var ama PWA bağlamında ve token kısa ömürlü olduğu için kabul edilebilir). httpOnly cookie'ye geçmek V1.5'te değerlendirilebilir.

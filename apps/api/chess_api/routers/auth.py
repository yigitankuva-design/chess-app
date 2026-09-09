import secrets
from datetime import date as date_cls, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from chess_api.database import get_db
from chess_api.models import User, UserRole, Device, ChildProfile
from chess_api.schemas.auth import (
    ParentSignupRequest, LoginRequest, AuthResponse, EmailVerifyRequest,
    DeviceRegisterRequest, ChildPinLoginRequest, ChildEnterRequest,
    AthleteCreateRequest, MemberSignupRequest, TeacherSignupRequestV2,
)
from chess_api.services.password import hash_password, verify_password, verify_pin, hash_pin
from chess_api.services.jwt import encode_token
from chess_api.services.email import send_verification_email
from chess_api.dependencies.auth import get_current_user

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

    # Sporcu adı verildiyse profil oluştur (yaş/PIN varsayılan)
    if payload.athlete_name:
        athlete = ChildProfile(
            parent_user_id=user.id,
            display_name=payload.athlete_name,
            age=10,
            avatar="default",
            pin_hash=hash_pin(f"{secrets.randbelow(9000) + 1000}"),
        )
        db.add(athlete)
        await db.commit()

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
    # Madde 2026-09-09 (Üyelik Girişi Yenileme): e-posta VEYA kullanıcı adı
    # ile giriş — mevcut hesaplar (username=NULL) e-postayla girmeye devam
    # eder, hiçbir şey bozulmaz.
    result = await db.execute(
        select(User).where(or_(User.email == payload.email, User.username == payload.email))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Madde 2026-09-09 (devam): 18+ kendi kaydolan sporcu hesapları admin
    # onaylayana kadar 'pending' kalır — Tier A (yaş beyanı riskine karşı).
    # Veli/antrenör hesapları zaten 'approved' başlar (bkz. migration).
    # Madde 2026-09-09 (AŞAMA 3): admin reddederse 'rejected' de AYNI
    # şekilde engellenir — sadece "onay bekliyor" DEĞİL, "onaylanmadı" da.
    if user.approval_status != "approved":
        detail = "Hesabınız reddedildi" if user.approval_status == "rejected" else "Hesabınız onay bekliyor"
        raise HTTPException(status_code=403, detail=detail)
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


@router.post(
    "/athlete/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def athlete_signup(
    payload: ParentSignupRequest,
    db: AsyncSession = Depends(get_db),
):
    """Self-registration for athletes aged 14+. No parental consent required."""
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.athlete,
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


def _age_from_birth_date(birth_date: date_cls) -> int:
    """Madde 2026-09-09 (Üyelik Girişi Yenileme): "Kayıt Ol" formundaki
    Doğum Tarihi'nden yaş hesabı — üyelik yolunu (sporcu kendi hesabı mı,
    veli hesabı mı) belirlemek için (bkz. member_signup)."""
    today = date_cls.today()
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


async def _check_email_username_free(db: AsyncSession, email: str, username: str) -> None:
    if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="E-posta zaten kayıtlı")
    if (await db.execute(select(User).where(User.username == username))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Kullanıcı adı zaten kullanılıyor")


@router.post(
    "/member/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def member_signup(
    payload: MemberSignupRequest,
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-09 (Üyelik Girişi Yenileme): "Kayıt Ol" formunun "Üye"
    (Sporcu) yolu. Doğum tarihinden hesaplanan yaş 18+ ise sporcu KENDİ
    hesabını açar (role=athlete); 18 altıysa veli hesabı açar (role=parent)
    ve sporcu ChildProfile olarak bağlanır — mevcut parent/signup ile AYNI
    desen, sadece daha zengin veriyle. Madde 2026-09-09 (devam 4): Zafer'in
    kararıyla sporcu tarafında admin onayı ARANMIYOR (approval_status
    varsayılan 'approved' — bkz. migration) — Tier A onay gereksinimi
    SADECE antrenör başvurusuna taşındı (bkz. teacher_register), çünkü
    çocuklarla doğrudan çalışacak rol antrenör."""
    await _check_email_username_free(db, payload.email, payload.username)

    full_name = f"{payload.first_name} {payload.last_name}"
    age = _age_from_birth_date(payload.birth_date)
    now = datetime.utcnow()

    if age >= 18:
        user = User(
            email=payload.email,
            username=payload.username,
            password_hash=hash_password(payload.password),
            role=UserRole.athlete,
            name=full_name,
            phone=payload.phone,
            province=payload.province,
            lichess_username=payload.lichess_username,
            birth_date=payload.birth_date,
            kvkk_consent_at=now,
            father_name=payload.father_name,
            father_phone=payload.father_phone,
            father_email=payload.father_email,
            mother_name=payload.mother_name,
            mother_phone=payload.mother_phone,
            mother_email=payload.mother_email,
            email_verification_token=secrets.token_urlsafe(32),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Madde (devam): tek e-posta/kullanıcı adı/şifre seti var — 18 altı
        # sporcu için bu, VELİNİN giriş bilgisi olur (sporcu henüz kendi
        # hesabını yönetemeyecek yaşta — KURAL: veli sorumluluğu alır).
        user = User(
            email=payload.email,
            username=payload.username,
            password_hash=hash_password(payload.password),
            role=UserRole.parent,
            name=full_name,
            kvkk_consent_at=now,
            email_verification_token=secrets.token_urlsafe(32),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        athlete = ChildProfile(
            parent_user_id=user.id,
            display_name=full_name,
            age=age,
            avatar="default",
            pin_hash=hash_pin(f"{secrets.randbelow(9000) + 1000}"),
            province=payload.province,
            athlete_phone=payload.phone,
            athlete_email=payload.email,
            lichess_username=payload.lichess_username,
            father_name=payload.father_name,
            father_phone=payload.father_phone,
            father_email=payload.father_email,
            mother_name=payload.mother_name,
            mother_phone=payload.mother_phone,
            mother_email=payload.mother_email,
        )
        db.add(athlete)
        await db.commit()

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
        approval_status=user.approval_status,
    )


@router.post(
    "/teacher/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def teacher_register(
    payload: TeacherSignupRequestV2,
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-09 (Üyelik Girişi Yenileme): "Kayıt Ol" formunun
    "Antrenör" yolu — zengin alan seti (telefon/şehir/Lichess/kullanıcı
    adı). Mevcut /teacher/signup (test paketinde 20+ yerde kullanılan
    basit {email,password,name} şekli) KURAL #3 gereği DOKUNULMADAN kalır
    — bu YENİ, AYRI bir uç. Madde 2026-09-09 (devam 4): Zafer'in kararıyla
    Tier A onay gereksinimi (admin onaylayana kadar giriş yapılamaz)
    SPORCUDAN antrenöre taşındı — çocuklarla doğrudan çalışacak rol
    antrenör olduğu için kimlik/iletişim bilgisi admin tarafından
    incelenmeden hesap aktif olmaz (bkz. admin.py pending-members uçları,
    apps/web/app/admin/onay-bekleyenler)."""
    await _check_email_username_free(db, payload.email, payload.username)

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=UserRole.teacher,
        name=f"{payload.first_name} {payload.last_name}",
        phone=payload.phone,
        province=payload.province,
        lichess_username=payload.lichess_username,
        kvkk_consent_at=datetime.utcnow(),
        approval_status="pending",
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
        approval_status=user.approval_status,
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


@router.post("/device/register", status_code=201)
async def register_device(
    payload: DeviceRegisterRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Parents only")

    # Idempotent: if same fingerprint already trusted by this parent, return success
    existing = await db.execute(
        select(Device).where(
            Device.device_fingerprint == payload.device_fingerprint,
            Device.parent_user_id == current.id,
        )
    )
    if existing.scalar_one_or_none():
        return {"registered": True, "already_trusted": True}

    device = Device(
        parent_user_id=current.id,
        device_fingerprint=payload.device_fingerprint,
        name=payload.name,
    )
    db.add(device)
    await db.commit()
    return {"registered": True, "already_trusted": False}


@router.get("/device/children")
async def device_children(device_fingerprint: str, db: AsyncSession = Depends(get_db)):
    """List child profiles available on a trusted device (no auth — fingerprint is the key).

    Returns [] for unknown/untrusted devices. Never exposes pin_hash.
    """
    device_result = await db.execute(
        select(Device).where(Device.device_fingerprint == device_fingerprint)
    )
    device = device_result.scalar_one_or_none()
    if not device:
        return []
    children = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == device.parent_user_id)
    )).scalars().all()
    return [
        {"id": c.id, "display_name": c.display_name, "avatar": c.avatar, "age": c.age}
        for c in children
    ]


@router.post("/child/pin")
async def child_pin_login(
    payload: ChildPinLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    child = await db.get(ChildProfile, payload.child_profile_id)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    # Verify device is trusted by this child's parent
    device_result = await db.execute(
        select(Device).where(
            Device.device_fingerprint == payload.device_fingerprint,
            Device.parent_user_id == child.parent_user_id,
        )
    )
    device = device_result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=403, detail="Untrusted device")

    if not verify_pin(payload.pin, child.pin_hash):
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


@router.post("/child/enter")
async def child_enter(
    payload: ChildEnterRequest,
    db: AsyncSession = Depends(get_db),
):
    """PIN'siz çocuk girişi. Güvenlik: cihaz, çocuğun velisinin güvenilir cihazı olmalı."""
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


def _athlete_token(child: ChildProfile) -> dict:
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


@router.post("/athlete/session")
async def athlete_session(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Veli token'ı ile hesabın (en eski) sporcusu için child oturumu. PIN yok."""
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Parents only")
    child = (await db.execute(
        select(ChildProfile)
        .where(ChildProfile.parent_user_id == current.id)
        .order_by(ChildProfile.id.asc())
    )).scalars().first()
    if not child:
        raise HTTPException(status_code=404, detail="No athlete")
    return _athlete_token(child)


@router.post("/athlete/create", status_code=201)
async def athlete_create(
    payload: AthleteCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Veli token'ı ile sporcu profili oluşturur (yaş/PIN varsayılan) ve oturum döner."""
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Parents only")
    child = ChildProfile(
        parent_user_id=current.id,
        display_name=payload.full_name,
        age=10,
        avatar="default",
        pin_hash=hash_pin(f"{secrets.randbelow(9000) + 1000}"),
    )
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return _athlete_token(child)

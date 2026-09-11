"""Madde 2026-09-11 (Görsel Turu Aşama F): antrenöre OYUN PROFİLİ.

Zafer'in kararı (S3): antrenör de sporcu gibi oynasın — Maç Yap, Dersler,
Pratik, Analiz, Eğlence, Bildirimler, aktiflik kaydı. Bu uçların HEPSİ bir
ChildProfile (get_current_child) ister; antrenörün şimdiye kadar böyle bir
profili YOKTU. Çözüm, 18+ sporcularla (member_signup) AYNI desen: antrenöre,
`parent_user_id` KENDİ hesabını gösteren bir ChildProfile açılır ("kendi
kendinin velisi"). Antrenörün oturum jetonu bu profili `child_profile_id`
olarak taşır (bkz. auth.py: teacher token'ları) — böylece TEK jetonla hem
antrenör uçları (get_current_user, role=teacher) hem sporcu uçları
(get_current_child) çalışır; jeton değiştirme YOK.

Kimlik/iletişim (isim, il, telefon, Lichess) antrenör hesabında (User) kalır;
oyun profili SADECE maç/pratik/aktiflik/bildirim verisini taşır.
"""
import secrets
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import User, UserRole, ChildProfile
from chess_api.services.password import hash_pin


def _age_from_birth_date(birth_date: date | None) -> int:
    """Antrenör kayıt formunda doğum tarihi yok — çoğunda 0 kalır ("belirtilmedi").
    Yaş sporcu listelerinde gösterilmiyor (bkz. routers/athletes.py)."""
    if birth_date is None:
        return 0
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


async def get_own_play_profile(db: AsyncSession, user: User) -> ChildProfile | None:
    """Kullanıcının KENDİ oyun profili — parent_user_id == user.id olan en eski
    ChildProfile (18+ sporcu ve antrenör için tek satırdır; veli için ise
    çocuklarından ilki — veli bu fonksiyonu kullanmaz, athlete_session kullanır)."""
    return (await db.execute(
        select(ChildProfile)
        .where(ChildProfile.parent_user_id == user.id)
        .order_by(ChildProfile.id.asc())
    )).scalars().first()


async def ensure_teacher_play_profile(db: AsyncSession, user: User) -> ChildProfile:
    """Antrenörün oyun profilini döner; yoksa OLUŞTURUR (flush eder, commit
    ETMEZ — çağıran commit eder). Sadece role=teacher için çağrılır.
    PIN rastgele ve atılır: antrenör PIN'le değil kendi jetonuyla girer."""
    assert user.role == UserRole.teacher
    existing = await get_own_play_profile(db, user)
    if existing is not None:
        return existing
    profile = ChildProfile(
        parent_user_id=user.id,
        display_name=user.name,
        age=_age_from_birth_date(user.birth_date),
        avatar="default",
        pin_hash=hash_pin(secrets.token_urlsafe(16)),
        province=user.province,
        athlete_phone=user.phone,
        athlete_email=user.email,
        lichess_username=user.lichess_username,
    )
    db.add(profile)
    await db.flush()
    return profile


def teacher_token_payload(user: User, profile: ChildProfile) -> dict:
    """Antrenör jetonu: user_id + role (antrenör uçları) + child_profile_id
    (sporcu uçları) — TEK jeton."""
    return {"user_id": user.id, "role": user.role.value, "child_profile_id": profile.id}

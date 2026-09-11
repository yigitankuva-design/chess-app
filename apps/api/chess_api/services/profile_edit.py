"""Madde 2026-09-11 (Görsel Turu Aşama B / Madde 3): sporcu ve antrenörün
kendi profilini düzenlemesi — ortak kurallar.

- Nickname: maçlarda gerçek isim yerine görünen ad (Madde 11). 2–24 karakter,
  harf/rakam/boşluk/alt çizgi. BENZERSİZ (büyük/küçük harf duyarsız, tüm
  oyun profilleri arasında). 3 ayda en fazla 1 kez değiştirilebilir (ilk
  belirleme serbest). Zafer: "sporcu sürekli nickname değiştirmesin".
- Ülke: liste (Türkiye varsayılan). Şehir: Türkiye'nin 81 ili — uygulama
  şimdilik ülke dışını baz almıyor, listeler burada doğrulanmaz (frontend
  seçtirir); sadece uzunluk sınırı.
"""
import re
from datetime import datetime, timedelta
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import ChildProfile

NICKNAME_COOLDOWN_DAYS = 90
NICKNAME_MIN, NICKNAME_MAX = 2, 24
_NICKNAME_RE = re.compile(r"^[0-9A-Za-zÇĞİÖŞÜçğıöşü_ ]+$")


def nickname_next_change_at(profile: ChildProfile) -> datetime | None:
    if profile.nickname_changed_at is None:
        return None
    return profile.nickname_changed_at + timedelta(days=NICKNAME_COOLDOWN_DAYS)


def _normalize_nickname(raw: str) -> str:
    value = " ".join(raw.split())
    if not (NICKNAME_MIN <= len(value) <= NICKNAME_MAX):
        raise HTTPException(422, f"Nickname {NICKNAME_MIN}–{NICKNAME_MAX} karakter olmalı")
    if not _NICKNAME_RE.match(value):
        raise HTTPException(422, "Nickname sadece harf, rakam, boşluk ve alt çizgi içerebilir")
    return value


async def set_nickname(db: AsyncSession, profile: ChildProfile, raw: str, now: datetime | None = None) -> bool:
    """Nickname'i kurallara göre değiştirir. Aynı değer gönderilirse no-op
    (False döner, sayaç işlemez). commit ETMEZ."""
    now = now or datetime.utcnow()
    value = _normalize_nickname(raw)
    if profile.nickname is not None and profile.nickname.lower() == value.lower():
        if profile.nickname != value:
            profile.nickname = value  # sadece harf büyüklüğü değişti — sayaç işlemez
        return False
    next_at = nickname_next_change_at(profile)
    if next_at is not None and now < next_at:
        days = max(1, (next_at - now).days + (1 if (next_at - now).seconds else 0))
        raise HTTPException(
            409,
            f"Nickname 3 ayda bir değiştirilebilir — {days} gün sonra tekrar deneyebilirsin",
        )
    taken = (await db.execute(
        select(func.count(ChildProfile.id)).where(
            func.lower(ChildProfile.nickname) == value.lower(),
            ChildProfile.id != profile.id,
        )
    )).scalar_one()
    if taken:
        raise HTTPException(409, "Bu nickname zaten kullanılıyor")
    profile.nickname = value
    profile.nickname_changed_at = now
    return True


def clean_optional(value: str | None, max_len: int) -> str | None:
    """Boş/boşluk → None; aksi halde kırpılmış ve uzunluk sınırlı."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    if len(v) > max_len:
        raise HTTPException(422, f"En fazla {max_len} karakter")
    return v

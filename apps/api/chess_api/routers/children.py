from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from pydantic import BaseModel, Field
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user, get_current_child
from chess_api.models import (
    User, ChildProfile, UserRole,
    ChildLessonProgress, ChildLessonStepResult,
    ChildPuzzleAttempt, SRSCard, ChildBadge, ChildRank,
    ParentTimeLimit, ChildActivityLog, ParentSurveyResponse,
    Game, GameMove, Device,
)
from chess_api.schemas.auth import ChildProfileCreate, ChildProfileResponse
from chess_api.services.password import hash_pin
from chess_api.services.child_deletion import delete_child_cascade
from chess_api.services.profile_edit import set_nickname, nickname_next_change_at, clean_optional

router = APIRouter(prefix="/children", tags=["children"])


class MyProfileEditRequest(BaseModel):
    """Madde 2026-09-11 (Görsel Turu Aşama B / Madde 3): sporcunun KENDİ
    düzenleyebildiği alanlar. Gerçek isim ve e-posta salt-okunur (kimlik) —
    bu şemada YOK. Gönderilmeyen alan değişmez (model_fields_set); boş
    string gönderilen telefon/Lichess temizlenir."""
    country: str | None = Field(default=None, max_length=60)
    province: str | None = Field(default=None, max_length=60)
    athlete_phone: str | None = Field(default=None, max_length=30)
    lichess_username: str | None = Field(default=None, max_length=60)
    nickname: str | None = Field(default=None, max_length=40)


def profile_edit_payload(child: ChildProfile) -> dict:
    next_at = nickname_next_change_at(child)
    return {
        "country": child.country,
        "province": child.province,
        "athlete_phone": child.athlete_phone,
        "lichess_username": child.lichess_username,
        "nickname": child.nickname,
        "nickname_changed_at": child.nickname_changed_at.isoformat() if child.nickname_changed_at else None,
        "nickname_next_change_at": next_at.isoformat() if next_at else None,
    }


async def apply_profile_edit(db: AsyncSession, child: ChildProfile, payload: MyProfileEditRequest) -> None:
    """Ortak uygulama — sporcu (/children/me/profile) ve antrenörün oyun
    profili (nickname, /teacher/me/profile) aynı kuralları kullanır. commit ETMEZ."""
    sent = payload.model_fields_set
    if "country" in sent:
        child.country = clean_optional(payload.country, 60)
    if "province" in sent:
        child.province = clean_optional(payload.province, 60)
    if "athlete_phone" in sent:
        child.athlete_phone = clean_optional(payload.athlete_phone, 30)
    if "lichess_username" in sent:
        child.lichess_username = clean_optional(payload.lichess_username, 60)
    if "nickname" in sent and payload.nickname is not None and payload.nickname.strip():
        await set_nickname(db, child, payload.nickname)


@router.patch("/me/profile")
async def edit_my_profile(
    payload: MyProfileEditRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Sporcu kendi profilini düzenler: ülke, şehir, telefon, Lichess,
    nickname (3 ayda 1). İsim/e-posta bu uçtan DEĞİŞTİRİLEMEZ."""
    await apply_profile_edit(db, child, payload)
    await db.commit()
    await db.refresh(child)
    return profile_edit_payload(child)


class UploadPhotoRequest(BaseModel):
    # Madde 2026-09-07 (GRUP C): bu projede dosya depolama/S3 YOK — istemci
    # tarafında küçültülmüş görsel doğrudan "data:image/...;base64,..."
    # olarak gönderilir, DB'de Text sütununda tutulur. max_length ~400KB
    # (küçültülmüş bir kare avatar için fazlasıyla yeterli, kötüye
    # kullanımı sınırlar).
    photo_data_url: str = Field(min_length=1, max_length=400_000)


@router.post("/me/photo")
async def upload_my_photo(
    payload: UploadPhotoRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Sporcu kendi profil fotoğrafını yükler (bkz. profil sayfası dairesel
    foto alanı — tıklanınca cihazdan/kameradan seçim). Boş bırakılırsa
    (fotoğraf hiç yüklenmemişse) mevcut emoji avatar gösterilmeye devam
    eder — bu uç ÇAĞRILMADIKÇA davranış DEĞİŞMEZ (KURAL #3)."""
    if not payload.photo_data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image data URL")
    child.photo_data_url = payload.photo_data_url
    await db.commit()
    return {"ok": True}


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
        pin_hash=hash_pin(payload.pin),
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
        raise HTTPException(status_code=403, detail="Only parents can list children")
    result = await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == current.id)
    )
    return [
        ChildProfileResponse(
            id=c.id,
            display_name=c.display_name,
            age=c.age,
            avatar=c.avatar,
            teacher_user_id=c.teacher_user_id,
        )
        for c in result.scalars().all()
    ]


@router.delete("/{child_id}", status_code=204)
async def delete_child(
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Only parents can delete children")
    child = await db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != current.id:
        raise HTTPException(status_code=404, detail="Child not found")

    await delete_child_cascade(db, child)
    await db.commit()
    return None

import secrets
import string
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import (
    User, UserRole, Class, ChildProfile, ParentSurvey, CoachNote, Notification, NotificationType,
)
from chess_api.services.leaderboard import class_leaderboard
from chess_api.routers.gamification import _compute_progress
from chess_api.routers.activity import _compute_day_summary
from chess_api.routers.practice import (
    _compute_lesson_scores, _compute_practice_detail,
    _compute_attempts_summary, _compute_attempts,
)
from chess_api.services.play_profile import ensure_teacher_play_profile
from chess_api.services.profile_edit import set_nickname, nickname_next_change_at, clean_optional
from chess_api.services.profile_stats import compute_match_stats
from chess_api.services.coach_notes import get_coach_note_payload
from pydantic import BaseModel, Field

_ALPHABET = string.ascii_uppercase + string.digits


class CreateClassRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class CreateSurveyRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    questions: list[dict]


router = APIRouter(prefix="/teacher", tags=["teacher"])


def _ensure_teacher(u: User):
    if u.role != UserRole.teacher:
        raise HTTPException(403, "Teachers only")


@router.get("/classes")
async def list_classes(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    result = await db.execute(
        select(Class).where(Class.teacher_user_id == current.id)
    )
    return [
        {"id": c.id, "name": c.name, "join_code": c.join_code}
        for c in result.scalars().all()
    ]


@router.post("/classes", status_code=201)
async def create_class(
    payload: CreateClassRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = Class(
        teacher_user_id=current.id,
        name=payload.name,
        join_code=''.join(secrets.choice(_ALPHABET) for _ in range(8)),
    )
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    return {"id": cls.id, "name": cls.name, "join_code": cls.join_code}


@router.get("/classes/{class_id}/students")
async def class_students(
    class_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    result = await db.execute(
        select(ChildProfile).where(ChildProfile.class_id == class_id)
    )
    return [
        {"id": c.id, "display_name": c.display_name, "avatar": c.avatar, "age": c.age}
        for c in result.scalars().all()
    ]


@router.get("/students/search")
async def search_students(
    q: str = "",
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search children by display_name; include their current class name if enrolled."""
    _ensure_teacher(current)
    stmt = select(ChildProfile)
    if q.strip():
        stmt = stmt.where(ChildProfile.display_name.ilike(f"%{q.strip()}%"))
    stmt = stmt.limit(20)
    result = await db.execute(stmt)
    children = result.scalars().all()

    # Fetch class names for enrolled children
    class_ids = {c.class_id for c in children if c.class_id is not None}
    class_names: dict[int, str] = {}
    if class_ids:
        cls_result = await db.execute(select(Class).where(Class.id.in_(class_ids)))
        for cls in cls_result.scalars().all():
            class_names[cls.id] = cls.name

    return [
        {
            "id": c.id,
            "display_name": c.display_name,
            "avatar": c.avatar,
            "class_id": c.class_id,
            "class_name": class_names.get(c.class_id) if c.class_id else None,
        }
        for c in children
    ]


async def _get_child_for_teacher(
    child_id: int, current: User, db: AsyncSession,
) -> ChildProfile:
    """Madde 2026-09-07 (GRUP B): antrenör bir sporcunun GERÇEK Sporcu
    Profili'ni (salt-okunur) görüntüleyebilsin diye — bu çocuğun antrenörün
    KENDİ öğrencisi olduğunu doğrular (`class_students` ile AYNI desen:
    `child.teacher_user_id` DOĞRUDAN bu antrenöre bağlıysa YA DA
    `child.class_id`'nin sınıfı bu antrenöre aitse izin verilir)."""
    _ensure_teacher(current)
    child = await db.get(ChildProfile, child_id)
    if not child:
        raise HTTPException(404, "Child not found")
    allowed = child.teacher_user_id == current.id
    if not allowed and child.class_id is not None:
        cls = await db.get(Class, child.class_id)
        allowed = cls is not None and cls.teacher_user_id == current.id
    if not allowed:
        raise HTTPException(403, "Not your student")
    return child


@router.get("/me/profile-summary")
async def teacher_profile_summary(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-07 (Antrenör Paneli): antrenörün KENDİ Profil sayfası
    (`/coach/profile`) sporcunun ProfileView'ını (bkz. components/profile/
    ProfileView.tsx) aynen kullanıyor — o bileşen `/gamification/me`'nin
    döndürdüğü `MyProgress` şeklini bekliyor. Antrenörün rütbe/XP/rozet
    sistemi YOK — bu yüzden bunlar hep NULL/0 döner, ProfileView'ın
    "ikon avatar göster"/"bilgi eksik" davranışına düşer (KURAL #3).
    Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): il/telefon/Lichess
    ARTIK gerçek — antrenörün "Kayıt Ol" formunda girdiği bilgiler (bkz.
    User.province/phone/lichess_username, AŞAMA 1-3)."""
    _ensure_teacher(current)
    # Madde 2026-09-11 (Aşama B): nickname antrenörün OYUN PROFİLİNDE (Aşama F)
    # tutulur — maçlarda görünen ad. Ülke/il/telefon/Lichess antrenör
    # hesabında (User).
    play = await ensure_teacher_play_profile(db, current)
    await db.commit()
    next_at = nickname_next_change_at(play)
    return {
        "rank_name": "", "rank_icon": "", "xp_total": 0, "next_rank_xp": 0,
        "badges_earned": 0, "badges_total": 0,
        "member_since": current.created_at.date().isoformat(),
        "display_name": current.name,
        "avatar": "default",
        "photo_data_url": current.photo_data_url,
        "country": current.country,
        "province": current.province,
        "athlete_phone": current.phone, "athlete_email": current.email,
        "lichess_username": current.lichess_username,
        "nickname": play.nickname,
        "nickname_changed_at": play.nickname_changed_at.isoformat() if play.nickname_changed_at else None,
        "nickname_next_change_at": next_at.isoformat() if next_at else None,
        "father_name": None, "father_phone": None, "father_email": None,
        "mother_name": None, "mother_phone": None, "mother_email": None,
    }


class TeacherProfileEditRequest(BaseModel):
    """Madde 2026-09-11 (Aşama B / Madde 3): antrenörün KENDİ düzenleyebildiği
    alanlar — isim ve e-posta salt-okunur (şemada YOK). Gönderilmeyen alan
    değişmez; boş string telefon/Lichess'i temizler."""
    country: str | None = Field(default=None, max_length=60)
    province: str | None = Field(default=None, max_length=60)
    phone: str | None = Field(default=None, max_length=30)
    lichess_username: str | None = Field(default=None, max_length=60)
    nickname: str | None = Field(default=None, max_length=40)


@router.patch("/me/profile")
async def edit_teacher_profile(
    payload: TeacherProfileEditRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Antrenör kendi profilini düzenler: ülke/şehir/telefon/Lichess → User;
    nickname → oyun profili (sporcuyla AYNI 3-ay kuralı ve benzersizlik)."""
    _ensure_teacher(current)
    sent = payload.model_fields_set
    if "country" in sent:
        current.country = clean_optional(payload.country, 60)
    if "province" in sent:
        current.province = clean_optional(payload.province, 60)
    if "phone" in sent:
        current.phone = clean_optional(payload.phone, 30)
    if "lichess_username" in sent:
        current.lichess_username = clean_optional(payload.lichess_username, 60)
    play = await ensure_teacher_play_profile(db, current)
    if "nickname" in sent and payload.nickname is not None and payload.nickname.strip():
        await set_nickname(db, play, payload.nickname)
    await db.commit()
    await db.refresh(current)
    await db.refresh(play)
    next_at = nickname_next_change_at(play)
    return {
        "country": current.country, "province": current.province,
        "athlete_phone": current.phone, "lichess_username": current.lichess_username,
        "nickname": play.nickname,
        "nickname_changed_at": play.nickname_changed_at.isoformat() if play.nickname_changed_at else None,
        "nickname_next_change_at": next_at.isoformat() if next_at else None,
    }


class UploadTeacherPhotoRequest(BaseModel):
    photo_data_url: str = Field(min_length=1, max_length=400_000)


@router.post("/me/photo")
async def upload_teacher_photo(
    payload: UploadTeacherPhotoRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-07 (Antrenör Paneli, 4): antrenör kendi kimlik
    fotoğrafını yükler — `POST /children/me/photo` ile AYNI desen
    (bkz. components/profile/ProfileView.tsx'teki dairesel foto alanı)."""
    _ensure_teacher(current)
    if not payload.photo_data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image data URL")
    current.photo_data_url = payload.photo_data_url
    await db.commit()
    return {"ok": True}


@router.get("/students/{child_id}/profile-summary")
async def student_profile_summary(
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/gamification/me` ile AYNI veri + antrenör görünümü için isim/avatar
    (çocuğun kendi ekranında bunlar zaten cihazından geliyor — antrenör
    görünümünde sunucudan gelmesi gerekir, bkz. ProfileView.tsx)."""
    child = await _get_child_for_teacher(child_id, current, db)
    progress = await _compute_progress(child, db)
    return {**progress, "display_name": child.display_name, "avatar": child.avatar}


@router.get("/students/{child_id}/match-stats")
async def student_match_stats(
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/gamification/me/match-stats` ile AYNI veri — antrenörün salt-okunur
    sporcu görünümü (Madde 2026-09-11, Aşama C)."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await compute_match_stats(db, child.id)


@router.get("/students/{child_id}/day-summary")
async def student_day_summary(
    child_id: int,
    date_str: str | None = None,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/activity/day-summary` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_day_summary(child, date_str, db)


class CoachNoteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@router.put("/students/{child_id}/note")
async def write_coach_note(
    child_id: int,
    payload: CoachNoteRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): antrenör bir
    sporcunun profiline not yazar/değiştirir. S4 (Zafer): SADECE SON not
    tutulur (upsert) — ayrı bir "düzenle" ucu YOK, yeniden yazmak zaten
    değiştirmekle eşdeğer. Her yazımda (ilk kez veya değişiklik) sporcuya
    YENİ bir bildirim düşer ("not yazarsa bildirim görünsün")."""
    child = await _get_child_for_teacher(child_id, current, db)
    text = payload.text.strip()
    if not text:
        raise HTTPException(422, "Not boş olamaz")

    note = (await db.execute(
        select(CoachNote).where(CoachNote.child_id == child.id)
    )).scalar_one_or_none()
    if note is None:
        note = CoachNote(child_id=child.id, teacher_user_id=current.id, text=text)
        db.add(note)
    else:
        note.text = text
        note.teacher_user_id = current.id

    db.add(Notification(
        child_id=child.id, type=NotificationType.hoca_notu,
        title=f"{current.name} sana bir not bıraktı", subtitle=text[:200],
        visible_from=date.today(),
    ))
    await db.commit()
    return await get_coach_note_payload(db, child.id)


@router.delete("/students/{child_id}/note")
async def delete_coach_note(
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """S4 (Zafer): "silinebilir" — antrenör kendi yazdığı notu kaldırır.
    Geçmiş bildirim satırlarına DOKUNULMAZ (bell geçmişi kalır)."""
    child = await _get_child_for_teacher(child_id, current, db)
    note = (await db.execute(
        select(CoachNote).where(CoachNote.child_id == child.id)
    )).scalar_one_or_none()
    if note is not None:
        await db.delete(note)
        await db.commit()
    return {"ok": True}


@router.get("/students/{child_id}/practice/lessons/{lesson_id}/scores")
async def student_lesson_scores(
    child_id: int,
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/practice/lessons/{id}/scores` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_lesson_scores(child.id, lesson_id, db)


@router.get("/students/{child_id}/practice/steps/{step_id}/detail")
async def student_practice_detail(
    child_id: int,
    step_id: int,
    mode: str = "suresiz",
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/practice/steps/{id}/detail` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_practice_detail(child.id, step_id, mode, db)


@router.get("/students/{child_id}/practice/steps/{step_id}/attempts-summary")
async def student_attempts_summary(
    child_id: int,
    step_id: int,
    mode: str = "sureli",
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/practice/steps/{id}/attempts-summary` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_attempts_summary(child.id, step_id, mode, db)


@router.get("/students/{child_id}/practice/steps/{step_id}/attempts")
async def student_attempts(
    child_id: int,
    step_id: int,
    mode: str = "test",
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/practice/steps/{id}/attempts` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_attempts(child.id, step_id, mode, db)


@router.post("/classes/{class_id}/students/{child_id}", status_code=200)
async def add_student(
    class_id: int,
    child_id: int,
    force: bool = False,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    child = await db.get(ChildProfile, child_id)
    if not child:
        raise HTTPException(404, "Child not found")
    if child.class_id is not None and child.class_id != class_id and not force:
        raise HTTPException(409, "Bu öğrenci zaten başka bir sınıfa kayıtlı")
    child.class_id = class_id
    await db.commit()
    return {"ok": True}


@router.delete("/classes/{class_id}/students/{child_id}", status_code=200)
async def remove_student(
    class_id: int,
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    child = await db.get(ChildProfile, child_id)
    if not child or child.class_id != class_id:
        raise HTTPException(404, "Student not in this class")
    child.class_id = None
    await db.commit()
    return {"ok": True}


@router.get("/classes/{class_id}/leaderboard")
async def get_leaderboard(
    class_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    return await class_leaderboard(db, class_id)


@router.post("/surveys", status_code=201)
async def create_survey(
    payload: CreateSurveyRequest,
    target_class_id: int | None = None,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    if target_class_id is not None:
        cls = await db.get(Class, target_class_id)
        if not cls or cls.teacher_user_id != current.id:
            raise HTTPException(403, "Not your class")
    survey = ParentSurvey(
        title=payload.title,
        questions_json=payload.questions,
        created_by_teacher_id=current.id,
        target_class_id=target_class_id,
    )
    db.add(survey)
    await db.commit()
    return {"id": survey.id}

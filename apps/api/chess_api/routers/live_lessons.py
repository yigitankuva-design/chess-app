"""Online Dersler (canlı ders) — REST + WebSocket. Madde 2026-09-15.

Mimari: LiveKit SADECE ses/görüntü taşır (bkz. services/live_lesson_tokens.py,
kendi sunucumuzda self-hosted). Bu router hem dersin YAŞAM DÖNGÜSÜNÜ
(oluştur/başlat/bitir/katıl/ayrıl) hem de ders İÇİ uygulama durumunu
(paylaşılan tahta, katılım onayı, taş oynatma yetkisi, sohbet —
services/live_lesson_room.py, `/ws/live-lesson/{id}`) yönetir. WebSocket
auth deseni `live_game.py`'deki connect-then-authenticate deseninin
AYNISI — tek fark, token'daki `role` claim'i okunup host/katılımcı ayrımı
yapılması (antrenörün jetonu HEM `user_id` HEM `child_profile_id`
taşıyor, bkz. services/play_profile.py — o yüzden host'u child_profile_id
ile DEĞİL, role='teacher' + coach_user_id eşleşmesiyle ayırt ediyoruz).
"""
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.database import get_db, get_session_factory
from chess_api.dependencies.auth import get_current_user, get_current_child
from chess_api.services.jwt import decode_token, TokenInvalid
from chess_api.services.game_validation import validate_move
from chess_api.settings import settings
from chess_api.models import (
    User, UserRole, Class, ChildProfile, Notification, NotificationType,
    LiveLesson, LiveLessonParticipant, LiveLessonStatus, LiveLessonJoinMode, LiveLessonParticipantStatus,
)
from chess_api.services.live_lesson_tokens import (
    room_name, mint_host_token, mint_attendee_token, ensure_room, close_room, mute_child_microphone,
)
from chess_api.services.live_lesson_room import get_room, remove_room

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/live-lessons", tags=["live-lessons"])

INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def _ensure_teacher(u: User):
    if u.role != UserRole.teacher:
        raise HTTPException(403, "Teachers only")


class CreateLiveLessonRequest(BaseModel):
    class_id: int
    title: str = Field(min_length=1, max_length=160)
    scheduled_at: datetime
    duration_minutes: int = Field(gt=0, le=240)
    join_mode: LiveLessonJoinMode = LiveLessonJoinMode.auto

    @field_validator("scheduled_at")
    @classmethod
    def _naive_utc_scheduled_at(cls, v: datetime) -> datetime:
        """BUG FIX (2026-09-15) — tournaments.py::TournamentCreateRequest'teki
        AYNI hata: tarayıcı `new Date(...).toISOString()` ile "Z" ekli
        (tz-AWARE) bir tarih gönderir. live_lessons.scheduled_at kolonu düz
        DateTime (timezone=False) — asyncpg AWARE bir datetime'i bu tür
        kolona yazmaya çalışırken 'timestamp cannot be aware' hatası ATAR ve
        istek 500 ile patlar (SQLite kullanan testler bu hatayı YAKALAMAZ, bu
        yüzden test kapısından geçmişti — canlıda, Zafer'in "Dersi Oluştur"a
        basınca aldığı hata buydu). AWARE gelen değer UTC'ye çevrilip tzinfo
        silinir; NAIVE gelen (doğrudan API çağrıları) değişmeden bırakılır."""
        if v.tzinfo is not None:
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


def _serialize(lesson: LiveLesson) -> dict:
    return {
        "id": lesson.id, "class_id": lesson.class_id, "title": lesson.title,
        "scheduled_at": lesson.scheduled_at.isoformat(),
        "duration_minutes": lesson.duration_minutes,
        "join_mode": lesson.join_mode.value, "status": lesson.status.value,
        "started_at": lesson.started_at.isoformat() if lesson.started_at else None,
        "ended_at": lesson.ended_at.isoformat() if lesson.ended_at else None,
    }


@router.post("", status_code=201)
async def create_live_lesson(
    payload: CreateLiveLessonRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Zafer'in madde 1'i: tarih/saat/süre/sınıf ile ders oluşturma.
    Madde 2: oluşturulunca sınıftaki HER öğrenciye bildirim düşer —
    `homework.py::send_homework`'teki fan-out ile BİREBİR aynı desen."""
    _ensure_teacher(current)
    cls = await db.get(Class, payload.class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403, "Bu sınıf sizin değil")

    lesson = LiveLesson(
        coach_user_id=current.id, class_id=payload.class_id, title=payload.title,
        scheduled_at=payload.scheduled_at, duration_minutes=payload.duration_minutes,
        join_mode=payload.join_mode, livekit_room_name="",
    )
    db.add(lesson)
    await db.flush()
    lesson.livekit_room_name = room_name(lesson.id)

    student_ids = (await db.execute(
        select(ChildProfile.id).where(ChildProfile.class_id == payload.class_id)
    )).scalars().all()
    for sid in student_ids:
        db.add(Notification(
            child_id=sid, type=NotificationType.online_ders,
            title=f"Yeni Canlı Ders: {lesson.title}",
            subtitle=f"{cls.name} — {payload.scheduled_at.strftime('%d.%m.%Y %H:%M')}",
            # Madde: homework'ün AKSİNE (start_date'e kadar gizli), ders
            # bildirimi HEMEN görünür — sporcu dersin varlığından erkenden
            # haberdar olmalı, dersin kendi zamanı gelene kadar gizlenmesi
            # anlamsız (davet niteliğinde).
            visible_from=datetime.utcnow().date(), live_lesson_id=lesson.id,
        ))
    await db.commit()
    await db.refresh(lesson)
    return _serialize(lesson)


@router.get("")
async def list_live_lessons(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    rows = (await db.execute(
        select(LiveLesson).where(LiveLesson.coach_user_id == current.id)
        .order_by(LiveLesson.scheduled_at.desc())
    )).scalars().all()
    return [_serialize(l) for l in rows]


async def _get_lesson_for_coach(lesson_id: int, current: User, db: AsyncSession) -> LiveLesson:
    lesson = await db.get(LiveLesson, lesson_id)
    if not lesson or lesson.coach_user_id != current.id:
        raise HTTPException(403, "Bu ders sizin değil")
    return lesson


@router.get("/usage-estimate")
async def get_usage_estimate(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-17 (madde 6): LiveKit Cloud'un ücretsiz "Build"
    planında gerçek kullanım/kota API'si YOK (Analytics API sadece Scale
    plan ve üzeri) — bu yüzden KENDİ verimizle KABA bir tahmin sunuyoruz.
    Kota LiveKit HESABI genelinde (tek bir antrenöre özel değil), bu
    yüzden TÜM antrenörlerin dersleri toplanır. Oda açık kaldığı süreye
    dayanır — LiveKit'in gerçek faturalandırdığı KATILIMCI-başı bağlantı
    dakikasından farklıdır, bu yüzden gerçek kullanım muhtemelen daha
    yüksektir (frontend'de bu netlikle belirtilir). ÖNEMLİ: bu route
    `/{lesson_id}`'den ÖNCE tanımlı olmalı — aksi halde "usage-estimate"
    metni bir lesson_id gibi eşleşmeye çalışılıp 422 döner."""
    _ensure_teacher(current)
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = (await db.execute(
        select(LiveLesson.started_at, LiveLesson.ended_at).where(
            LiveLesson.started_at.is_not(None), LiveLesson.started_at >= month_start,
        )
    )).all()
    total_minutes = sum(
        ((ended_at or now) - started_at).total_seconds() / 60
        for started_at, ended_at in rows
    )
    return {"estimated_minutes": round(total_minutes), "free_tier_minutes": 5000}


@router.get("/{lesson_id}")
async def get_live_lesson(
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    lesson = await _get_lesson_for_coach(lesson_id, current, db)
    return _serialize(lesson)


class UpdateLiveLessonRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)


@router.patch("/{lesson_id}")
async def update_live_lesson(
    lesson_id: int,
    payload: UpdateLiveLessonRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-16 (Antrenör Ekranı, Faz A / madde 5): "Derslerim"
    listesinde SADECE başlık düzenlenebilir — tarih/süre/sınıf gibi diğer
    alanlar bilerek dışarıda bırakıldı (ders hangi sınıfa/zamana ait
    olduğunu değiştirmek ayrı, istenmeyen bir iş)."""
    _ensure_teacher(current)
    lesson = await _get_lesson_for_coach(lesson_id, current, db)
    lesson.title = payload.title
    await db.commit()
    await db.refresh(lesson)
    return _serialize(lesson)


@router.delete("/{lesson_id}")
async def delete_live_lesson(
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-17 (madde 7): "Derslerim" listesinden yanlışlıkla
    oluşturulmuş/mükerrer bir dersi silme. Devam eden ("live") bir ders
    silinemez — önce bitirilmeli. ORM cascade tanımlı olmadığı için
    bağlı Notification/LiveLessonParticipant satırları burada ELLE
    silinir — aksi halde madde 1'in bildirim filtresine rağmen silinen
    bir derse ait "hayalet" bildirim kalırdı."""
    _ensure_teacher(current)
    lesson = await _get_lesson_for_coach(lesson_id, current, db)
    if lesson.status == LiveLessonStatus.live:
        raise HTTPException(400, "Devam eden bir ders silinemez — önce bitir")
    await db.execute(delete(Notification).where(Notification.live_lesson_id == lesson_id))
    await db.execute(delete(LiveLessonParticipant).where(LiveLessonParticipant.lesson_id == lesson_id))
    await db.delete(lesson)
    await db.commit()
    return {"ok": True}


@router.post("/{lesson_id}/start")
async def start_live_lesson(
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 4'ün karşıtı — antrenör dersi başlatır: LiveKit odası açılır,
    host token'ı döner (frontend bununla LiveKitRoom'a bağlanır)."""
    _ensure_teacher(current)
    lesson = await _get_lesson_for_coach(lesson_id, current, db)
    if lesson.status == LiveLessonStatus.ended:
        raise HTTPException(400, "Ders zaten bitmiş")
    if lesson.status == LiveLessonStatus.scheduled:
        lesson.status = LiveLessonStatus.live
        lesson.started_at = datetime.utcnow()
        await db.commit()
    await ensure_room(lesson_id)
    return {"token": mint_host_token(lesson_id, current.id, current.name), "livekit_url": settings().LIVEKIT_URL}


@router.post("/{lesson_id}/end")
async def end_live_lesson(
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 4: antrenör dersi sonlandırır — LiveKit odası kapanır (herkes
    bağlantıdan düşer), ders-içi WebSocket odası da temizlenir."""
    _ensure_teacher(current)
    lesson = await _get_lesson_for_coach(lesson_id, current, db)
    lesson.status = LiveLessonStatus.ended
    lesson.ended_at = datetime.utcnow()
    await db.commit()
    room = get_room(lesson_id, INITIAL_FEN)
    await room.broadcast({"type": "lesson_ended"})
    remove_room(lesson_id)
    await close_room(lesson_id)
    return {"ok": True}


def _mint_admitted_response(lesson_id: int, child: ChildProfile) -> dict:
    return {
        "status": "admitted",
        "token": mint_attendee_token(lesson_id, child.id, child.public_name),
        "livekit_url": settings().LIVEKIT_URL,
    }


async def _own_participant(lesson_id: int, child_id: int, db: AsyncSession) -> LiveLessonParticipant | None:
    return (await db.execute(select(LiveLessonParticipant).where(
        LiveLessonParticipant.lesson_id == lesson_id, LiveLessonParticipant.child_id == child_id,
    ))).scalar_one_or_none()


@router.post("/{lesson_id}/join-request")
async def join_request(
    lesson_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 3: 'Online Derse Katıl' düğmesi bunu çağırır. `join_mode=
    'auto'` İSE ya da sporcu bu ders için DAHA ÖNCE onaylandıysa (sticky —
    bağlantı kopup tekrar girişte yeniden onay İSTENMEZ) anında LiveKit
    token döner. `'approval'` + ilk giriş ise `pending` döner — istemci
    `/join-status`'u POLL eder (bkz. apps/web/lib/chess/
    useServerGameAnalysis.ts'teki AYNI iste+poll deseni)."""
    lesson = await db.get(LiveLesson, lesson_id)
    if not lesson:
        raise HTTPException(404)
    if lesson.status == LiveLessonStatus.ended:
        raise HTTPException(400, "Ders sona erdi")
    if child.class_id != lesson.class_id:
        raise HTTPException(403, "Bu ders senin sınıfına ait değil")

    participant = await _own_participant(lesson_id, child.id, db)

    if participant is not None and participant.status in (
        LiveLessonParticipantStatus.admitted, LiveLessonParticipantStatus.left,
    ):
        if participant.status == LiveLessonParticipantStatus.left:
            participant.status = LiveLessonParticipantStatus.admitted
            await db.commit()
        return _mint_admitted_response(lesson_id, child)
    if participant is not None and participant.status == LiveLessonParticipantStatus.denied:
        raise HTTPException(403, "Antrenör katılım isteğini reddetti")
    if participant is not None and participant.status == LiveLessonParticipantStatus.pending:
        return {"status": "pending"}

    if lesson.join_mode == LiveLessonJoinMode.auto:
        db.add(LiveLessonParticipant(
            lesson_id=lesson_id, child_id=child.id,
            status=LiveLessonParticipantStatus.admitted, admitted_at=datetime.utcnow(),
        ))
        await db.commit()
        return _mint_admitted_response(lesson_id, child)

    db.add(LiveLessonParticipant(lesson_id=lesson_id, child_id=child.id))
    await db.commit()
    room = get_room(lesson_id, INITIAL_FEN)
    await room.broadcast({"type": "join_requested", "child_id": child.id, "name": child.public_name})
    return {"status": "pending"}


@router.get("/{lesson_id}/join-status")
async def join_status(
    lesson_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    participant = await _own_participant(lesson_id, child.id, db)
    if participant is None:
        raise HTTPException(404)
    if participant.status == LiveLessonParticipantStatus.denied:
        return {"status": "denied"}
    if participant.status in (LiveLessonParticipantStatus.admitted, LiveLessonParticipantStatus.left):
        return _mint_admitted_response(lesson_id, child)
    return {"status": "pending"}


@router.post("/{lesson_id}/leave")
async def leave_lesson(
    lesson_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 3: sporcu istediği an çıkabilir — `status='left'`e döner ama
    (sticky) daha sonra tekrar `join-request` çağırınca yeniden onay
    İSTENMEZ, direkt admitted olur."""
    participant = await _own_participant(lesson_id, child.id, db)
    if participant and participant.status == LiveLessonParticipantStatus.admitted:
        participant.status = LiveLessonParticipantStatus.left
        await db.commit()
    return {"ok": True}


class AdmitRequest(BaseModel):
    child_id: int
    admit: bool


@router.post("/{lesson_id}/admit")
async def admit_participant(
    lesson_id: int,
    payload: AdmitRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 3: antrenörün onay/red kontrolü. Sonuç bekleyen sporcuya
    `/join-status` POLL'uyla ulaşır — WS ÜZERİNDEN DEĞİL: sporcu henüz
    onaylanmadığı için `/ws/live-lesson/{id}`'e zaten bağlanamıyor
    (bkz. `_authenticate_ws` — sadece `admitted` katılımcı girebilir),
    yani bu anda odada dinleyen bir bağlantısı YOK."""
    _ensure_teacher(current)
    await _get_lesson_for_coach(lesson_id, current, db)
    participant = await _own_participant(lesson_id, payload.child_id, db)
    if not participant:
        raise HTTPException(404)
    participant.status = LiveLessonParticipantStatus.admitted if payload.admit else LiveLessonParticipantStatus.denied
    if payload.admit:
        participant.admitted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


def _payload_from_token(token: str) -> dict | None:
    try:
        return decode_token(token)
    except TokenInvalid:
        return None


async def _end_floor(lesson_id: int, room) -> None:
    """Madde 2026-09-17 (Sporcu Ekranı, "Söz Hakkı İstiyor" v2): mevcut söz
    hakkı sahibinin turunu bitirir — diğer öğrencilerin mikrofonlarını
    `grant_floor` ÖNCESİ durumlarına geri yükler. Hem sporcu kendi ikonuna
    tekrar basınca (raise_hand, raised=False) hem antrenör başka birine
    `grant_floor` çağırıp ÖNCEKİ sahibinin turunu örtük olarak bitirdiğinde
    çağrılır."""
    ending_child = room.floor_child_id
    if ending_child is None:
        return
    prior_muted = room.pre_floor_muted_ids or set()
    for cid in list(room.participants.keys()):
        if cid == ending_child:
            continue
        should_be_muted = cid in prior_muted
        if should_be_muted == (cid in room.muted_child_ids):
            continue
        await mute_child_microphone(lesson_id, cid, muted=should_be_muted)
        if should_be_muted:
            room.muted_child_ids.add(cid)
            room.coach_muted_child_ids.add(cid)
        else:
            room.muted_child_ids.discard(cid)
            room.coach_muted_child_ids.discard(cid)
        await room.send_to_child(cid, {"type": "muted", "muted": should_be_muted})
    room.hand_raised_ids.discard(ending_child)
    room.floor_child_id = None
    room.pre_floor_muted_ids = None
    await room.send_to_host({"type": "mute_state_changed", "muted_child_ids": list(room.muted_child_ids)})
    await room.send_to_host({"type": "hand_state_changed", "child_id": ending_child, "raised": False})
    await room.send_to_child(ending_child, {"type": "hand_state_changed", "child_id": ending_child, "raised": False})


async def _handle_ws_message(lesson_id: int, room, is_host: bool, child_id: int | None, msg: dict) -> None:
    """`live_lesson_ws`'in mesaj dispatch'i — AYRI fonksiyona çıkarıldı ki
    testler gerçek eşzamanlı WebSocket bağlantısı AÇMADAN (TestClient tek
    portal iş parçacığı kullandığı için iki eşzamanlı bağlantı kilitleniyor
    — bkz. test_live_two_moves.py'nin AYNI uyarısı) doğrudan çağırabilsin."""
    mtype = msg.get("type")
    if mtype == "grant_control" and is_host:
        room.controller_child_id = msg.get("child_id")
        await room.broadcast({"type": "control_changed", "child_id": room.controller_child_id})
    elif mtype == "revoke_control" and is_host:
        room.controller_child_id = None
        await room.broadcast({"type": "control_changed", "child_id": None})
    elif mtype == "move":
        # Madde 3 (Zafer): SADECE antrenör ya da yetki verilen tek öğrenci
        # taş oynatabilir.
        mover_ok = is_host or (child_id is not None and child_id == room.controller_child_id)
        if not mover_ok:
            return
        result = validate_move(room.fen, msg.get("uci", ""))
        if result:
            room.fen = result["fen_after"]
            room.san_history.append(result["san"])
            await room.broadcast({"type": "move", "fen": room.fen, "san": result["san"]})
    elif mtype == "reset_board" and is_host:
        room.fen = msg.get("fen") or INITIAL_FEN
        room.san_history = []
        await room.broadcast({"type": "board_reset", "fen": room.fen})
    elif mtype == "mute" and is_host:
        target = msg.get("child_id")
        muted = bool(msg.get("muted", True))
        if target is not None:
            await mute_child_microphone(lesson_id, target, muted=muted)
            if muted:
                room.muted_child_ids.add(target)
                room.coach_muted_child_ids.add(target)
            else:
                room.muted_child_ids.discard(target)
                room.coach_muted_child_ids.discard(target)
            await room.send_to_child(target, {"type": "muted", "muted": muted})
            await room.send_to_host({"type": "mute_state_changed", "muted_child_ids": list(room.muted_child_ids)})
    elif mtype == "mute_all" and is_host:
        for target in list(room.participants.keys()):
            await mute_child_microphone(lesson_id, target, muted=True)
            room.muted_child_ids.add(target)
            room.coach_muted_child_ids.add(target)
            await room.send_to_child(target, {"type": "muted", "muted": True})
        await room.send_to_host({"type": "mute_state_changed", "muted_child_ids": list(room.muted_child_ids)})
    elif mtype == "self_mute" and not is_host:
        # Madde 2026-09-17 (Sporcu Ekranı): sporcu KENDİ mikrofonunu
        # LiveKit'te doğrudan (saf istemci çağrısıyla, bu WS'e hiç
        # dokunmadan) açıp kapatabiliyor — antrenör bunu GÖRMÜYORDU çünkü
        # `muted_child_ids` sadece antrenörün kendi susturma eylemlerinden
        # güncelleniyordu. Bu mesaj SADECE durum bilgisini senkronlar,
        # LiveKit'e tekrar mute isteği ATMAZ (zaten sporcunun tarafında
        # oldu). Antrenör bu sporcuyu ZATEN susturmuşsa (coach_muted_child_
        # ids'te varsa) sporcunun "aç" isteği YOKSAYILIR — antrenörün
        # susturması sporcunun kendi isteğinden önce gelir (arayüzde buton
        # zaten devre dışı, bu backend tarafında aynı kuralın ikinci
        # savunması). `coach_muted_child_ids` (muted_child_ids DEĞİL)
        # kontrol edilir ki sporcu kendi ÖNCEKİ self_mute'unu tekrar
        # açabilsin — sadece antrenörün susturması engel olsun.
        muted = bool(msg.get("muted", True))
        if child_id in room.coach_muted_child_ids and not muted:
            pass
        else:
            if muted:
                room.muted_child_ids.add(child_id)
            else:
                room.muted_child_ids.discard(child_id)
            await room.send_to_host({"type": "mute_state_changed", "muted_child_ids": list(room.muted_child_ids)})
    elif mtype == "arrows" and is_host:
        # Madde 2026-09-16 (Antrenör Ekranı, Faz B): antrenörün tahtada
        # çizdiği oklar — SADECE yayınlanır, oda durumunda tutulmaz (fen
        # değişince istemci tarafında zaten otomatik temizleniyor).
        await room.broadcast({"type": "arrows", "arrows": msg.get("arrows", [])})
    elif mtype == "marks" and is_host:
        await room.broadcast({"type": "marks", "marks": msg.get("marks", {})})
    elif mtype == "raise_hand" and not is_host:
        # Madde 2026-09-17 (Sporcu Ekranı, "Söz Hakkı İstiyor" v2):
        # sporcunun genel "dikkatini istiyorum" isteği (taş yetkisi/ses
        # açma/soru sorma gibi tüm nedenleri kapsar). Turuncu↔mavi bir
        # anahtar — sporcu KENDİSİ açar/kapatır (host zorla kapatamaz).
        # Kapatma, eğer bu sporcu o an söz hakkı sahibiyse (floor_child_id)
        # diğer öğrencilerin mikrofonlarını da geri yükler (_end_floor).
        raised = bool(msg.get("raised", True))
        if raised:
            room.hand_raised_ids.add(child_id)
            await room.send_to_host({"type": "hand_state_changed", "child_id": child_id, "raised": True})
            await room.send_to_child(child_id, {"type": "hand_state_changed", "child_id": child_id, "raised": True})
        elif room.floor_child_id == child_id:
            await _end_floor(lesson_id, room)
        else:
            room.hand_raised_ids.discard(child_id)
            await room.send_to_host({"type": "hand_state_changed", "child_id": child_id, "raised": False})
            await room.send_to_child(child_id, {"type": "hand_state_changed", "child_id": child_id, "raised": False})
    elif mtype == "grant_floor" and is_host:
        # Antrenör KENDİ ekranında mavi (istek yapmış) bir sporcunun
        # ikonuna tıklar: diğer TÜM bağlı sporcuların mikrofonu kapanır
        # (önceki durumları pre_floor_muted_ids'e kaydedilir), söz isteyen
        # sporcunun mikrofonu kapalıysa otomatik açılır, SADECE o sporcuya
        # sesli anons tetikleyecek "floor_granted" gider.
        target = msg.get("child_id")
        if target in room.hand_raised_ids:
            if room.floor_child_id is not None and room.floor_child_id != target:
                await _end_floor(lesson_id, room)
            room.floor_child_id = target
            room.pre_floor_muted_ids = set(room.muted_child_ids) - {target}
            for cid in list(room.participants.keys()):
                if cid == target or cid in room.muted_child_ids:
                    continue
                await mute_child_microphone(lesson_id, cid, muted=True)
                room.muted_child_ids.add(cid)
                room.coach_muted_child_ids.add(cid)
                await room.send_to_child(cid, {"type": "muted", "muted": True})
            if target in room.muted_child_ids:
                await mute_child_microphone(lesson_id, target, muted=False)
                room.muted_child_ids.discard(target)
                room.coach_muted_child_ids.discard(target)
                await room.send_to_child(target, {"type": "muted", "muted": False})
            await room.send_to_host({"type": "mute_state_changed", "muted_child_ids": list(room.muted_child_ids)})
            async with get_session_factory()() as db:
                c = await db.get(ChildProfile, target)
                name = c.public_name if c else "Sporcu"
            await room.send_to_child(target, {"type": "floor_granted", "name": name})
    elif mtype == "chat_message":
        text = (msg.get("text") or "").strip()[:500]
        if not text:
            return
        if is_host:
            sender_name = "Antrenör"
        else:
            async with get_session_factory()() as db:
                c = await db.get(ChildProfile, child_id)
                sender_name = c.public_name if c else "Sporcu"
        # Madde: sohbet KALICI DEĞİL (v1) — sadece yayınlanır.
        await room.broadcast({"type": "chat_message", "from": sender_name, "text": text, "is_host": is_host})


def _authenticate_ws(
    payload: dict, lesson: LiveLesson, participant: LiveLessonParticipant | None,
) -> tuple[bool, bool, int | None, int]:
    """`(ok, is_host, child_id, close_code)` döner — `live_lesson_ws`'in
    DB erişiminden AYRI, saf karar mantığı. Antrenörün jetonu HEM
    `user_id` HEM `child_profile_id` taşıdığı için (bkz. services/
    play_profile.py) host'u `role=='teacher'` + `coach_user_id` eşleşmesiyle
    ayırt ediyoruz, `child_profile_id` İLE DEĞİL. Ayrı fonksiyona
    çıkarılmasının nedeni: test_live_lessons.py'de TestClient'in sync
    websocket bağlantısı FARKLI bir event loop'ta çalıştığı için gerçek
    bir WS üzerinden DB'ye dokunan auth akışını test etmek
    test_live_two_moves.py'nin uyardığı AYNI kısıtla karşılaşıyor —
    doğrudan test edilebilsin diye DB'siz bir fonksiyona ayrıldı."""
    if payload.get("role") == "teacher":
        if payload.get("user_id") != lesson.coach_user_id:
            return False, False, None, 4403
        return True, True, None, 0
    child_id = payload.get("child_profile_id")
    if not child_id or not participant or participant.status != LiveLessonParticipantStatus.admitted:
        return False, False, None, 4403
    return True, False, child_id, 0


@router.websocket("/ws/live-lesson/{lesson_id}")
async def live_lesson_ws(websocket: WebSocket, lesson_id: int, token: str = Query(...)):
    """Ders-içi uygulama durumu kanalı (LiveKit'ten AYRI — o ses/görüntüyü
    taşır, bu paylaşılan tahtayı/yetkiyi/sohbeti). `live_game.py`'deki
    connect-then-authenticate deseni: önce accept, sonra token doğrulanır,
    geçersizse özel bir kapanış koduyla kapatılır."""
    await websocket.accept()
    payload = _payload_from_token(token)
    if not payload:
        await websocket.close(code=4401)
        return

    async with get_session_factory()() as db:
        lesson = await db.get(LiveLesson, lesson_id)
        if not lesson:
            await websocket.close(code=4404)
            return
        participant = None
        if payload.get("role") != "teacher":
            cid = payload.get("child_profile_id")
            participant = await _own_participant(lesson_id, cid, db) if cid else None
        ok, is_host, child_id, close_code = _authenticate_ws(payload, lesson, participant)
        if not ok:
            await websocket.close(code=close_code)
            return

    room = get_room(lesson_id, INITIAL_FEN)
    conn_id = room.join_host(websocket) if is_host else room.join_participant(child_id, websocket)

    await websocket.send_json({
        "type": "lesson_state", "fen": room.fen, "san_history": room.san_history,
        "controller_child_id": room.controller_child_id,
        "muted_child_ids": list(room.muted_child_ids),
        "hand_raised_ids": list(room.hand_raised_ids),
    })
    if not is_host:
        await room.broadcast({"type": "participant_joined", "child_id": child_id})

    try:
        while True:
            msg = await websocket.receive_json()
            await _handle_ws_message(lesson_id, room, is_host, child_id, msg)
    except WebSocketDisconnect:
        if is_host:
            room.leave_host(conn_id)
        else:
            room.leave_participant(child_id, conn_id)
            if room.floor_child_id == child_id:
                await _end_floor(lesson_id, room)
            room.hand_raised_ids.discard(child_id)
            await room.broadcast({"type": "participant_left", "child_id": child_id})
    except Exception:
        logger.exception("live_lesson_ws error")
        if is_host:
            room.leave_host(conn_id)
        else:
            room.leave_participant(child_id, conn_id)

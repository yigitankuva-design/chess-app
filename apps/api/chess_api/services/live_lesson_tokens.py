"""LiveKit token üretimi ve oda yönetimi — Online Dersler (madde 2026-09-15).

Motor (ses/görüntü) LiveKit'te, kendi sunucumuzda (self-hosted) çalışıyor
— bu modül SADECE JWT üretir ve LiveKit'in sunucu API'sini (oda aç/kapat,
sustur) çağırır, medya trafiğine hiç dokunmaz. `LIVEKIT_URL`/
`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` Zafer'in Railway'de kurduğu
servisten gelir (bkz. settings.py).
"""
import logging

from fastapi import HTTPException
from livekit import api

from chess_api.settings import settings

logger = logging.getLogger(__name__)


def room_name(lesson_id: int) -> str:
    return f"ders-{lesson_id}"


def mint_host_token(lesson_id: int, coach_user_id: int, name: str) -> str:
    """Antrenör (ders sahibi) — ses+görüntü yayınlayabilir, oda yönetimi
    (susturma vb.) yetkisi var."""
    s = settings()
    return (
        api.AccessToken(s.LIVEKIT_API_KEY, s.LIVEKIT_API_SECRET)
        .with_identity(f"coach-{coach_user_id}")
        .with_name(name)
        .with_grants(api.VideoGrants(
            room_join=True, room=room_name(lesson_id),
            can_publish=True, can_subscribe=True, can_publish_data=True,
            room_admin=True,
        ))
        .to_jwt()
    )


def mint_attendee_token(lesson_id: int, child_id: int, name: str) -> str:
    """Öğrenci — SADECE ses yayınlayabilir (`can_publish_sources` kamera/
    ekran paylaşımını dışarıda bırakır) — Zafer'in netleşen kararı."""
    s = settings()
    return (
        api.AccessToken(s.LIVEKIT_API_KEY, s.LIVEKIT_API_SECRET)
        .with_identity(f"child-{child_id}")
        .with_name(name)
        .with_grants(api.VideoGrants(
            room_join=True, room=room_name(lesson_id),
            can_publish=True, can_subscribe=True, can_publish_data=True,
            can_publish_sources=["microphone"],
        ))
        .to_jwt()
    )


def _client() -> api.LiveKitAPI:
    s = settings()
    return api.LiveKitAPI(s.LIVEKIT_URL, s.LIVEKIT_API_KEY, s.LIVEKIT_API_SECRET)


def _raise_unreachable(lesson_id: int, action: str, e: Exception) -> None:
    """Madde 2026-09-15 (düzeltme): önceden bu hatalar YAKALANMADAN 500'e
    düşüyordu — Zafer "Dersi Başlat"a basınca sadece jenerik "Derse
    bağlanılamadı" görüyordu, GERÇEK sebep (yanlış LIVEKIT_URL, erişilemeyen
    sunucu, geçersiz API key/secret vb.) Railway loglarına erişimimiz
    olmadığı için görünmüyordu. Artık gerçek istisna hem loglanıyor hem de
    502 yanıtına (backend'i doğrudan çağırıp teşhis ederken görülebilecek
    şekilde) ekleniyor."""
    logger.error(
        "LiveKit %s başarısız (lesson_id=%s): %s: %s", action, lesson_id, type(e).__name__, e,
    )
    raise HTTPException(
        502, f"LiveKit sunucusuna bağlanılamadı ({action}): {type(e).__name__}: {e}",
    ) from e


async def ensure_room(lesson_id: int) -> None:
    """Ders başlatılınca (start) LiveKit odasını açar — zaten varsa
    LiveKit sessizce aynı odayı döner (hata vermez)."""
    try:
        async with _client() as lk:
            await lk.room.create_room(api.CreateRoomRequest(name=room_name(lesson_id)))
    except Exception as e:
        _raise_unreachable(lesson_id, "oda açma", e)


async def close_room(lesson_id: int) -> None:
    """Ders bitince (end) LiveKit odasını kapatır — içindeki HERKESİ
    bağlantıdan düşürür."""
    try:
        async with _client() as lk:
            await lk.room.delete_room(api.DeleteRoomRequest(room=room_name(lesson_id)))
    except Exception as e:
        _raise_unreachable(lesson_id, "oda kapatma", e)


async def mute_child_microphone(lesson_id: int, child_id: int, muted: bool = True) -> bool:
    """Antrenörün 'katılımcıyı sustur/aç' kontrolü — önce sporcunun mikrofon
    track'ini bulur, sonra `muted` durumuna göre susturur ya da açar (LiveKit
    `MuteRoomTrackRequest.muted` iki yönde de AYNI çağrı). Sporcu henüz
    bağlanmadıysa/mikrofonu açmadıysa track bulunamaz, sessizce False döner
    (hata değil — sık rastlanan, zararsız bir durum)."""
    identity = f"child-{child_id}"
    try:
        async with _client() as lk:
            try:
                participant = await lk.room.get_participant(
                    api.RoomParticipantIdentity(room=room_name(lesson_id), identity=identity)
                )
            except api.ServerError as e:
                # Sporcu henüz bağlanmadıysa/odadan ayrıldıysa LiveKit bu
                # katılımcıyı "not_found" (404) ile reddeder — bu BEKLENEN,
                # zararsız bir durum (docstring), gerçek bağlantı sorunuyla
                # KARIŞTIRILMASIN.
                if e.status == 404:
                    return False
                raise
            track = next((t for t in participant.tracks if t.source == api.TrackSource.MICROPHONE), None)
            if not track:
                return False
            await lk.room.mute_published_track(api.MuteRoomTrackRequest(
                room=room_name(lesson_id), identity=identity, track_sid=track.sid, muted=muted,
            ))
            return True
    except Exception as e:
        _raise_unreachable(lesson_id, "susturma", e)

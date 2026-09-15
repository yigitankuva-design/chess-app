"""LiveKit token üretimi ve oda yönetimi — Online Dersler (madde 2026-09-15).

Motor (ses/görüntü) LiveKit'te, kendi sunucumuzda (self-hosted) çalışıyor
— bu modül SADECE JWT üretir ve LiveKit'in sunucu API'sini (oda aç/kapat,
sustur) çağırır, medya trafiğine hiç dokunmaz. `LIVEKIT_URL`/
`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` Zafer'in Railway'de kurduğu
servisten gelir (bkz. settings.py).
"""
from livekit import api

from chess_api.settings import settings


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


async def ensure_room(lesson_id: int) -> None:
    """Ders başlatılınca (start) LiveKit odasını açar — zaten varsa
    LiveKit sessizce aynı odayı döner (hata vermez)."""
    async with _client() as lk:
        await lk.room.create_room(api.CreateRoomRequest(name=room_name(lesson_id)))


async def close_room(lesson_id: int) -> None:
    """Ders bitince (end) LiveKit odasını kapatır — içindeki HERKESİ
    bağlantıdan düşürür."""
    async with _client() as lk:
        await lk.room.delete_room(api.DeleteRoomRequest(room=room_name(lesson_id)))


async def mute_child_microphone(lesson_id: int, child_id: int) -> bool:
    """Antrenörün 'katılımcıyı sustur' kontrolü — önce sporcunun mikrofon
    track'ini bulur, sonra susturur. Sporcu henüz bağlanmadıysa/mikrofonu
    açmadıysa track bulunamaz, sessizce False döner (hata değil — sık
    rastlanan, zararsız bir durum)."""
    identity = f"child-{child_id}"
    async with _client() as lk:
        participant = await lk.room.get_participant(
            api.RoomParticipantIdentity(room=room_name(lesson_id), identity=identity)
        )
        track = next((t for t in participant.tracks if t.source == api.TrackSource.MICROPHONE), None)
        if not track:
            return False
        await lk.room.mute_published_track(api.MuteRoomTrackRequest(
            room=room_name(lesson_id), identity=identity, track_sid=track.sid, muted=True,
        ))
        return True

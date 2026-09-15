"""Online Dersler (canlı ders) — REST + ders-içi mesaj mantığı testleri.
Madde 2026-09-15.

LiveKit'in GERÇEK sunucusu (ses/görüntü) testte YOK — token üretimi SAF
JWT imzalama olduğu için gerçekten çalışır (mock'lanmaz, sadece grants
doğrulanır); `ensure_room`/`close_room`/`mute_child_microphone` (gerçek
ağ isteği atan LiveKit sunucu API çağrıları) `bot_engine`/
`game_analysis_engine` testlerindeki AYNI monkeypatch deseniyle
sahtelenir.

Çoklu-taraf WS etkileşimi (kontrol devri + hamle) GERÇEK eşzamanlı
websocket bağlantısı yerine `_handle_ws_message`'ı DOĞRUDAN çağırarak
test edilir — test_live_two_moves.py'nin uyardığı AYNI kısıt: TestClient
tek portal iş parçacığı kullandığı için iki eşzamanlı bağlantı kilitlenir.
"""
import jwt as pyjwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from chess_api.routers import live_lessons as live_lessons_router
from chess_api.services.live_lesson_room import get_room, _reset_for_tests as _reset_rooms

TEST_LK_SECRET = "test-secret-32-bytes-minimum-xx"


def auth(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


async def _teacher(client: AsyncClient, email: str) -> tuple[str, int]:
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Hoca",
    })
    assert r.status_code == 201, r.text
    return r.json()["access_token"], r.json()["user_id"]


async def _class_with_students(client: AsyncClient, teacher_token: str, n: int = 1) -> tuple[int, list[int], list[str]]:
    """(class_id, [child_id...], [child_token...]) döner — sınıf oluşturur,
    n sporcu ekler (veli->çocuk->sınıfa katıl->cihaz kaydı->PIN girişi)."""
    r = await client.post("/teacher/classes", headers=auth(teacher_token), json={"name": "Sınıf X"})
    class_id = r.json()["id"]
    join_code = r.json()["join_code"]

    child_ids, child_tokens = [], []
    for i in range(n):
        r = await client.post("/auth/parent/signup", json={
            "email": f"veli-{class_id}-{i}@t.com", "password": "guvenli12345", "name": "Veli",
        })
        ptok = r.json()["access_token"]
        r = await client.post("/children", headers=auth(ptok), json={
            "display_name": f"Sporcu{i}", "age": 10, "pin": "1234",
        })
        cid = r.json()["id"]
        await client.post(f"/parent/children/{cid}/join-class", headers=auth(ptok), params={"join_code": join_code})
        await client.post("/auth/device/register", headers=auth(ptok), json={
            "device_fingerprint": f"dev-{class_id}-{i}", "name": "Test",
        })
        r = await client.post("/auth/child/pin", json={
            "child_profile_id": cid, "pin": "1234", "device_fingerprint": f"dev-{class_id}-{i}",
        })
        child_ids.append(cid)
        child_tokens.append(r.json()["access_token"])
    return class_id, child_ids, child_tokens


async def _create_lesson(client: AsyncClient, teacher_token: str, class_id: int, join_mode: str = "auto") -> int:
    r = await client.post("/live-lessons", headers=auth(teacher_token), json={
        "class_id": class_id, "title": "Deneme Dersi",
        "scheduled_at": "2026-09-20T10:00:00", "duration_minutes": 45, "join_mode": join_mode,
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.fixture(autouse=True)
def _patch_livekit(monkeypatch):
    """Token üretimi (SAF JWT imzalama) dummy anahtarlarla GERÇEK çalışır;
    gerçek ağ isteği atan fonksiyonlar sahtelenir."""
    from chess_api.settings import settings
    s = settings()
    monkeypatch.setattr(s, "LIVEKIT_API_KEY", "test-key")
    monkeypatch.setattr(s, "LIVEKIT_API_SECRET", TEST_LK_SECRET)
    monkeypatch.setattr(s, "LIVEKIT_URL", "wss://test.example.invalid")

    async def _room_noop(*a, **kw):
        return None

    async def _mute_noop(*a, **kw):
        return True

    monkeypatch.setattr(live_lessons_router, "ensure_room", _room_noop)
    monkeypatch.setattr(live_lessons_router, "close_room", _room_noop)
    monkeypatch.setattr(live_lessons_router, "mute_child_microphone", _mute_noop)
    _reset_rooms()
    yield
    _reset_rooms()


@pytest.fixture(autouse=True)
def _patch_ws_db(monkeypatch, db_engine):
    """`/ws/live-lesson/{id}` `Depends(get_db)`'nin DIŞINDA, doğrudan
    `get_session_factory()()` çağırıyor — test_game_info_moves.py'deki
    AYNI desen, test DB'sine yönlendirir."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(live_lessons_router, "get_session_factory", lambda: factory)


@pytest.mark.asyncio
async def test_ders_olusturunca_sinif_ogrencilerine_bildirim_duser(client):
    ttok, _ = await _teacher(client, "hoca1@t.com")
    class_id, _, child_tokens = await _class_with_students(client, ttok, n=2)
    lesson_id = await _create_lesson(client, ttok, class_id)

    for ctok in child_tokens:
        r = await client.get("/notifications", headers=auth(ctok))
        online_ders = [i for i in r.json()["items"] if i["type"] == "online_ders"]
        assert len(online_ders) == 1
        assert online_ders[0]["target"] == {"live_lesson_id": lesson_id, "live_lesson_status": "scheduled"}


@pytest.mark.asyncio
async def test_baskasinin_sinifi_icin_ders_olusturulamaz(client):
    ttok1, _ = await _teacher(client, "hocaA@t.com")
    ttok2, _ = await _teacher(client, "hocaB@t.com")
    class_id, _, _ = await _class_with_students(client, ttok1, n=1)

    r = await client.post("/live-lessons", headers=auth(ttok2), json={
        "class_id": class_id, "title": "X", "scheduled_at": "2026-09-20T10:00:00",
        "duration_minutes": 30,
    })
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_auto_join_mode_aninda_admitted_token_doner(client):
    ttok, _ = await _teacher(client, "hoca2@t.com")
    class_id, _, child_tokens = await _class_with_students(client, ttok, n=1)
    lesson_id = await _create_lesson(client, ttok, class_id, join_mode="auto")

    r = await client.post(f"/live-lessons/{lesson_id}/join-request", headers=auth(child_tokens[0]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "admitted"
    decoded = pyjwt.decode(data["token"], TEST_LK_SECRET, algorithms=["HS256"])
    assert decoded["video"]["room"] == f"ders-{lesson_id}"
    assert decoded["video"]["canPublishSources"] == ["microphone"]
    assert "roomAdmin" not in decoded["video"]


@pytest.mark.asyncio
async def test_host_token_kamera_ve_oda_yonetimi_yetkisiyle_gelir(client):
    ttok, _ = await _teacher(client, "hoca2b@t.com")
    class_id, _, _ = await _class_with_students(client, ttok, n=0)
    lesson_id = await _create_lesson(client, ttok, class_id)

    r = await client.post(f"/live-lessons/{lesson_id}/start", headers=auth(ttok))
    assert r.status_code == 200, r.text
    decoded = pyjwt.decode(r.json()["token"], TEST_LK_SECRET, algorithms=["HS256"])
    assert decoded["video"]["roomAdmin"] is True
    assert "canPublishSources" not in decoded["video"]  # kısıtlanmamış — kamera da yayınlayabilir


@pytest.mark.asyncio
async def test_approval_join_mode_once_pending_sonra_admit_ile_kabul(client):
    ttok, _ = await _teacher(client, "hoca3@t.com")
    class_id, child_ids, child_tokens = await _class_with_students(client, ttok, n=1)
    lesson_id = await _create_lesson(client, ttok, class_id, join_mode="approval")

    r = await client.post(f"/live-lessons/{lesson_id}/join-request", headers=auth(child_tokens[0]))
    assert r.json() == {"status": "pending"}

    r = await client.get(f"/live-lessons/{lesson_id}/join-status", headers=auth(child_tokens[0]))
    assert r.json() == {"status": "pending"}

    r = await client.post(f"/live-lessons/{lesson_id}/admit", headers=auth(ttok), json={
        "child_id": child_ids[0], "admit": True,
    })
    assert r.status_code == 200, r.text

    r = await client.get(f"/live-lessons/{lesson_id}/join-status", headers=auth(child_tokens[0]))
    assert r.json()["status"] == "admitted"
    assert "token" in r.json()


@pytest.mark.asyncio
async def test_approval_reddedilirse_join_status_denied_ve_tekrar_istek_403(client):
    ttok, _ = await _teacher(client, "hoca4@t.com")
    class_id, child_ids, child_tokens = await _class_with_students(client, ttok, n=1)
    lesson_id = await _create_lesson(client, ttok, class_id, join_mode="approval")

    await client.post(f"/live-lessons/{lesson_id}/join-request", headers=auth(child_tokens[0]))
    r = await client.post(f"/live-lessons/{lesson_id}/admit", headers=auth(ttok), json={
        "child_id": child_ids[0], "admit": False,
    })
    assert r.status_code == 200

    r = await client.get(f"/live-lessons/{lesson_id}/join-status", headers=auth(child_tokens[0]))
    assert r.json() == {"status": "denied"}

    r = await client.post(f"/live-lessons/{lesson_id}/join-request", headers=auth(child_tokens[0]))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_ayrilan_sporcu_tekrar_girince_yeniden_onay_istenmez(client):
    """Madde 3 (sticky): 'istediği zaman çıkıp tekrar girebilir' —
    approval modunda bile ilk kabulden SONRA tekrar onay istenmez."""
    ttok, _ = await _teacher(client, "hoca4b@t.com")
    class_id, child_ids, child_tokens = await _class_with_students(client, ttok, n=1)
    lesson_id = await _create_lesson(client, ttok, class_id, join_mode="approval")

    await client.post(f"/live-lessons/{lesson_id}/join-request", headers=auth(child_tokens[0]))
    await client.post(f"/live-lessons/{lesson_id}/admit", headers=auth(ttok), json={
        "child_id": child_ids[0], "admit": True,
    })
    r = await client.post(f"/live-lessons/{lesson_id}/leave", headers=auth(child_tokens[0]))
    assert r.status_code == 200

    r = await client.post(f"/live-lessons/{lesson_id}/join-request", headers=auth(child_tokens[0]))
    assert r.json()["status"] == "admitted"  # yeniden onay YOK


@pytest.mark.asyncio
async def test_derse_ait_olmayan_sinif_ogrencisi_katilamaz(client):
    ttok, _ = await _teacher(client, "hoca5@t.com")
    class_id, _, _ = await _class_with_students(client, ttok, n=0)
    _, _, other_tokens = await _class_with_students(client, ttok, n=1)
    lesson_id = await _create_lesson(client, ttok, class_id)

    r = await client.post(f"/live-lessons/{lesson_id}/join-request", headers=auth(other_tokens[0]))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_ders_baslat_ve_bitir_status_degisir(client):
    ttok, _ = await _teacher(client, "hoca6@t.com")
    class_id, _, _ = await _class_with_students(client, ttok, n=0)
    lesson_id = await _create_lesson(client, ttok, class_id)

    r = await client.post(f"/live-lessons/{lesson_id}/start", headers=auth(ttok))
    assert r.status_code == 200, r.text
    assert "token" in r.json()
    r = await client.get(f"/live-lessons/{lesson_id}", headers=auth(ttok))
    assert r.json()["status"] == "live"

    r = await client.post(f"/live-lessons/{lesson_id}/end", headers=auth(ttok))
    assert r.status_code == 200
    r = await client.get(f"/live-lessons/{lesson_id}", headers=auth(ttok))
    assert r.json()["status"] == "ended"


@pytest.mark.asyncio
async def test_bitmis_derse_baslanamaz(client):
    ttok, _ = await _teacher(client, "hoca6b@t.com")
    class_id, _, _ = await _class_with_students(client, ttok, n=0)
    lesson_id = await _create_lesson(client, ttok, class_id)
    await client.post(f"/live-lessons/{lesson_id}/start", headers=auth(ttok))
    await client.post(f"/live-lessons/{lesson_id}/end", headers=auth(ttok))

    r = await client.post(f"/live-lessons/{lesson_id}/start", headers=auth(ttok))
    assert r.status_code == 400


def test_ws_onaysiz_ogrenci_baglanamaz():
    """`_authenticate_ws` doğrudan test edilir — gerçek bir WS üzerinden
    DB'ye dokunan bağlantı testi TestClient'in sync websocket'inin FARKLI
    bir event loop'ta çalışması yüzünden mümkün değil (bkz. yukarıdaki
    `_authenticate_ws` docstring'i)."""
    from chess_api.routers.live_lessons import _authenticate_ws
    from chess_api.models import LiveLesson

    lesson = LiveLesson(id=1, coach_user_id=9, class_id=1, title="X",
                         scheduled_at=None, duration_minutes=30, livekit_room_name="ders-1")
    ok, is_host, child_id, code = _authenticate_ws(
        {"child_profile_id": 5, "role": "child"}, lesson, participant=None,
    )
    assert (ok, code) == (False, 4403)


def test_ws_baska_antrenorun_dersine_host_olarak_baglanamaz():
    from chess_api.routers.live_lessons import _authenticate_ws
    from chess_api.models import LiveLesson

    lesson = LiveLesson(id=1, coach_user_id=9, class_id=1, title="X",
                         scheduled_at=None, duration_minutes=30, livekit_room_name="ders-1")
    ok, is_host, child_id, code = _authenticate_ws(
        {"user_id": 999, "role": "teacher"}, lesson, participant=None,
    )
    assert (ok, code) == (False, 4403)


def test_ws_onaylanmis_ogrenci_baglanabilir():
    from chess_api.routers.live_lessons import _authenticate_ws
    from chess_api.models import LiveLesson, LiveLessonParticipant, LiveLessonParticipantStatus

    lesson = LiveLesson(id=1, coach_user_id=9, class_id=1, title="X",
                         scheduled_at=None, duration_minutes=30, livekit_room_name="ders-1")
    participant = LiveLessonParticipant(lesson_id=1, child_id=5, status=LiveLessonParticipantStatus.admitted)
    ok, is_host, child_id, code = _authenticate_ws(
        {"child_profile_id": 5, "role": "child"}, lesson, participant=participant,
    )
    assert (ok, is_host, child_id) == (True, False, 5)


def test_ws_gercek_sahibi_host_olarak_baglanabilir():
    from chess_api.routers.live_lessons import _authenticate_ws
    from chess_api.models import LiveLesson

    lesson = LiveLesson(id=1, coach_user_id=9, class_id=1, title="X",
                         scheduled_at=None, duration_minutes=30, livekit_room_name="ders-1")
    ok, is_host, child_id, code = _authenticate_ws(
        {"user_id": 9, "role": "teacher", "child_profile_id": 42}, lesson, participant=None,
    )
    # Antrenörün jetonu child_profile_id de tasisa bile (kendi oyun profili,
    # bkz. play_profile.py) role='teacher' + coach_user_id eşleşmesi host
    # kararını verir — child_profile_id yolu HİÇ değerlendirilmez.
    assert (ok, is_host, child_id) == (True, True, None)


class _FakeSender:
    """`Sender` protokolünü uygular — gönderilen mesajları toplar (gerçek
    websocket açmadan). `Sender`ın kendisi `LiveLessonRoom` tarafından
    KULLANILAN protokol (bkz. services/live_lesson_room.py)."""

    def __init__(self):
        self.messages: list[dict] = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


@pytest.mark.asyncio
async def test_yetkisiz_ogrenci_tas_oynatamaz_yetkili_oynatabilir():
    """Madde 3 (Zafer): antrenör tek bir öğrenciye taş oynatma yetkisi
    verebilir, o yetkiye sahip olmayan biri oynatamaz."""
    from chess_api.routers.live_lessons import _handle_ws_message

    room = get_room(999001, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    host = _FakeSender()
    s1, s2 = _FakeSender(), _FakeSender()
    room.join_host(host)
    room.join_participant(11, s1)
    room.join_participant(22, s2)

    # 11 numaralı sporcu henüz yetkisiz — hamle YOKSAYILIR.
    await _handle_ws_message(999001, room, False, 11, {"type": "move", "uci": "e2e4"})
    assert room.fen.startswith("rnbqkbnr/pppppppp/8/8/8/8")  # değişmedi
    assert all(m["type"] != "move" for m in host.messages)

    # Antrenör 11'e yetki verir.
    await _handle_ws_message(999001, room, True, None, {"type": "grant_control", "child_id": 11})
    assert room.controller_child_id == 11
    assert host.messages[-1] == {"type": "control_changed", "child_id": 11}
    assert s1.messages[-1] == {"type": "control_changed", "child_id": 11}

    # 22 numaralı sporcu (yetkisiz) yine oynatamaz.
    await _handle_ws_message(999001, room, False, 22, {"type": "move", "uci": "e2e4"})
    assert all(m["type"] != "move" for m in host.messages)

    # 11 numaralı sporcu (yetkili) oynatabilir.
    await _handle_ws_message(999001, room, False, 11, {"type": "move", "uci": "e2e4"})
    assert room.san_history == ["e4"]
    assert host.messages[-1] == {"type": "move", "fen": room.fen, "san": "e4"}
    assert s2.messages[-1] == {"type": "move", "fen": room.fen, "san": "e4"}

    # Antrenör HER ZAMAN oynatabilir (yetki kimde olursa olsun).
    await _handle_ws_message(999001, room, True, None, {"type": "move", "uci": "e7e5"})
    assert room.san_history == ["e4", "e5"]


@pytest.mark.asyncio
async def test_gecersiz_hamle_yoksayilir_yayinlanmaz():
    from chess_api.routers.live_lessons import _handle_ws_message

    room = get_room(999002, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    host = _FakeSender()
    room.join_host(host)

    await _handle_ws_message(999002, room, True, None, {"type": "move", "uci": "e2e5"})  # geçersiz
    assert room.san_history == []
    assert host.messages == []


@pytest.mark.asyncio
async def test_sohbet_mesaji_herkese_yayinlanir():
    from chess_api.routers.live_lessons import _handle_ws_message

    room = get_room(999003, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    host, s1 = _FakeSender(), _FakeSender()
    room.join_host(host)
    room.join_participant(11, s1)

    await _handle_ws_message(999003, room, True, None, {"type": "chat_message", "text": "Merhaba!"})
    assert host.messages[-1] == {"type": "chat_message", "from": "Antrenör", "text": "Merhaba!", "is_host": True}
    assert s1.messages[-1] == host.messages[-1]

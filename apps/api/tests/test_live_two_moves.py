"""Arka arkaya hamle akışı (bildirilen "2. hamleyi yapamıyorum").

_handle_move DOĞRUDAN çağrılır. WebSocket harness'i iki eşzamanlı istemcide
kilitleniyor (TestClient tek portal iş parçacığı kullanıyor) — o yüzden oda
sahte bir nesneyle temsil edilir. Sınanan mantık gerçek: sıra kontrolü,
doğrulama, saat, GameMove kaydı.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.models.game import GameMove
from sqlalchemy import select


class FakeRoom:
    """room.broadcast / room.send_to yerine mesajları toplar."""

    def __init__(self):
        self.broadcasts: list[dict] = []
        self.direct: list[tuple[int, dict]] = []

    async def broadcast(self, message: dict, exclude=None) -> None:
        self.broadcasts.append(message)

    async def send_to(self, child_id: int, message: dict) -> None:
        self.direct.append((child_id, message))


@pytest_asyncio.fixture
async def env(db_engine, monkeypatch):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(
        "chess_api.routers.live_game.get_session_factory", lambda: factory,
    )
    return factory


@pytest.mark.asyncio
async def test_uc_hamle_arka_arkaya_islenir(env):
    from chess_api.routers.live_game import _create_human_game, _handle_move

    gid = await _create_human_game(1, 2, base_ms=300_000, increment_ms=0)
    room = FakeRoom()

    await _handle_move(gid, 1, 1, 2, {"uci": "e2e4"}, room)
    await _handle_move(gid, 2, 1, 2, {"uci": "e7e5"}, room)
    await _handle_move(gid, 1, 1, 2, {"uci": "g1f3"}, room)

    sans = [m["san"] for m in room.broadcasts if m["type"] == "move_made"]
    assert sans == ["e4", "e5", "Nf3"]
    assert room.direct == []          # invalid_move / not_your_turn YOK

    async with env() as db:
        rows = (await db.execute(
            select(GameMove).where(GameMove.game_id == gid).order_by(GameMove.ply)
        )).scalars().all()
    assert [r.ply for r in rows] == [1, 2, 3]


@pytest.mark.asyncio
async def test_sirasi_gelmeyen_oynayamaz(env):
    from chess_api.routers.live_game import _create_human_game, _handle_move

    gid = await _create_human_game(1, 2, base_ms=300_000, increment_ms=0)
    room = FakeRoom()

    await _handle_move(gid, 2, 1, 2, {"uci": "e7e5"}, room)

    assert room.broadcasts == []
    assert room.direct[0][1]["message"] == "not_your_turn"


@pytest.mark.asyncio
async def test_saat_her_hamlede_dogru_tarafa_yazilir(env):
    """TUZAK: saat hep aynı tarafa işlerse ikinci oyuncu bayrak düşürür."""
    from chess_api.routers.live_game import _create_human_game, _handle_move

    gid = await _create_human_game(1, 2, base_ms=300_000, increment_ms=0)
    room = FakeRoom()

    await _handle_move(gid, 1, 1, 2, {"uci": "e2e4"}, room)
    await _handle_move(gid, 2, 1, 2, {"uci": "e7e5"}, room)

    clocks = [m for m in room.broadcasts if m["type"] == "clock"]
    assert len(clocks) == 2
    # 1. hamleden sonra sıra siyahta, 2. hamleden sonra beyazda.
    assert clocks[0]["white_to_move"] is False
    assert clocks[1]["white_to_move"] is True


@pytest.mark.asyncio
async def test_reddedilen_hamle_OTORITE_KONUMU_tasir(env):
    """İstemci iyimser oynadığı taşı geri alabilsin diye ret mesajlarında
    sunucunun konumu bulunmalı. Yoksa istemci sunucudan kopar ve sporcu bir
    daha hamle yapamaz — bildirilen "2. hamleyi yapamıyorum" bu."""
    from chess_api.routers.live_game import _create_human_game, _handle_move

    gid = await _create_human_game(1, 2, base_ms=1_800_000, increment_ms=0)
    room = FakeRoom()

    # Sırası olmayan oynadı.
    await _handle_move(gid, 2, 1, 2, {"uci": "e7e5"}, room)
    _, m = room.direct[-1]
    assert m["type"] == "error" and m["message"] == "not_your_turn"
    assert m["fen"].split()[1] == "w"

    # Kuralsız hamle.
    await _handle_move(gid, 1, 1, 2, {"uci": "a1a8"}, room)
    _, m2 = room.direct[-1]
    assert m2["type"] == "invalid_move"
    assert m2["fen"].split()[1] == "w"


@pytest.mark.asyncio
async def test_game_info_bitmis_maci_bildirir(env):
    """Bitmiş maça yeniden bağlanan sporcu ekranda canlı maç görmemeli."""
    from chess_api.routers.live_game import _create_human_game
    from chess_api.models.game import Game, GameStatus, GameResult
    from fastapi.testclient import TestClient
    from chess_api.main import create_app
    from chess_api.services.jwt import encode_token
    from datetime import datetime

    gid = await _create_human_game(1, 2, base_ms=1_800_000, increment_ms=0)
    async with env() as db:
        g = await db.get(Game, gid)
        g.status = GameStatus.finished
        g.result = GameResult.black_wins
        g.finished_at = datetime.utcnow()
        await db.commit()

    token = encode_token({"child_profile_id": 1, "role": "child"})
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/game/{gid}?token={token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "game_info":
            msg = ws.receive_json()

    assert msg["status"] == "finished"
    assert msg["result"] == "0-1"      # istemcinin sonuc metni bu degeri bekliyor

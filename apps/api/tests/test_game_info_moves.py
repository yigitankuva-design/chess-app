"""game_info notasyon listesi tasir (madde 1).

Yeniden baglanan sporcu, o ana kadar oynanmis TUM hamleleri gormeli;
aksi halde notasyon listesi baglanti kopunca sifirlanir.

NEDEN monkeypatch: bkz. tests/test_game_clock_ws.py.
"""
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.main import create_app
from chess_api.models.game import GameMove
from chess_api.services.jwt import encode_token

ITALYAN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 3"


@pytest_asyncio.fixture
async def env(db_engine, monkeypatch):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(
        "chess_api.routers.live_game.get_session_factory", lambda: factory,
    )
    return factory


@pytest.mark.asyncio
async def test_game_info_gecmis_hamleleri_ve_acilis_konumunu_tasir(env):
    from chess_api.routers.live_game import _create_human_game

    gid = await _create_human_game(1, 2, start_fen=ITALYAN)
    async with env() as db:
        db.add(GameMove(game_id=gid, ply=1, san="Af6", fen_after=ITALYAN))
        db.add(GameMove(game_id=gid, ply=2, san="d4", fen_after=ITALYAN))
        await db.commit()

    token = encode_token({"child_profile_id": 1, "role": "child"})
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/game/{gid}?token={token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "game_info":
            msg = ws.receive_json()

    assert msg["moves"] == ["Af6", "d4"]
    assert msg["start_fen"] == ITALYAN

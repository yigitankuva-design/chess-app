"""Bot macinda game_info'daki bos isim 'Bot' yazar; insan-insan macta
'Sporcu' varsayilani DEGISMEZ (regresyon)."""
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.main import create_app
from chess_api.models import Game, GameType, GameStatus
from chess_api.services.jwt import encode_token


@pytest_asyncio.fixture
async def env(db_engine, monkeypatch):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(
        "chess_api.routers.live_game.get_session_factory", lambda: factory,
    )
    return factory


@pytest.mark.asyncio
async def test_bot_macinda_bos_kalan_taraf_bot_yazar(env):
    async with env() as db:
        game = Game(type=GameType.bot, status=GameStatus.active, white_child_id=9,
                    black_bot_level=5, student_color="w")
        db.add(game)
        await db.commit()
        await db.refresh(game)
        gid = game.id

    token = encode_token({"child_profile_id": 9, "role": "child"})
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/game/{gid}?token={token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "game_info":
            msg = ws.receive_json()

    assert msg["black_name"] == "Bot"


@pytest.mark.asyncio
async def test_insan_macinda_isim_hala_sporcu_varsayilanlidir(env):
    from chess_api.routers.live_game import _create_human_game

    gid = await _create_human_game(1, 2)

    token = encode_token({"child_profile_id": 1, "role": "child"})
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/game/{gid}?token={token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "game_info":
            msg = ws.receive_json()

    assert msg["white_name"] == "Sporcu"
    assert msg["black_name"] == "Sporcu"

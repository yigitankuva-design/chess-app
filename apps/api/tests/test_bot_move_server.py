"""Bot maci motoru sunucuda — WS entegrasyon testleri.

env fixture'i ve FakeRoom, apps/api/tests/test_live_two_moves.py ve
test_draw_offers_ws.py ile AYNI desendir.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.models import Game, GameType, GameStatus


class FakeRoom:
    """room.broadcast / room.send_to yerine mesajlari toplar."""

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


async def _make_bot_game(env, **kwargs) -> int:
    async with env() as db:
        game = Game(type=GameType.bot, status=GameStatus.active, white_child_id=9,
                    black_bot_level=5, **kwargs)
        db.add(game)
        await db.commit()
        await db.refresh(game)
        return game.id


@pytest.mark.asyncio
async def test_siyah_oynayan_sporcu_hamle_yapabilir(env):
    """Bugunku (duzeltmeden onceki) kod bunu REDDEDERDI — white_id/black_id'ye
    bakar, bot macinda black_id hep None'dur."""
    from chess_api.routers.live_game import _handle_move

    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    gid = await _make_bot_game(env, student_color="b", start_fen=acilis_fen)

    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "e7e5"}, room)

    assert room.direct == [], "not_your_turn HATASI OLMAMALI"
    sans = [m["san"] for m in room.broadcasts if m["type"] == "move_made"]
    assert sans == ["e5"]


@pytest.mark.asyncio
async def test_bot_sirasinda_sporcu_hamle_yapamaz(env):
    """Madalyonun diger yuzu: student_color='w' olan macta, siyahin (botun)
    sirasinda sporcu hamle DENERSE reddedilmeli."""
    from chess_api.routers.live_game import _handle_move

    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    gid = await _make_bot_game(env, student_color="w", start_fen=acilis_fen)

    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "e7e5"}, room)

    assert room.broadcasts == []
    assert room.direct[0][1]["message"] == "not_your_turn"

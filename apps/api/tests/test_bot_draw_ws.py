"""Bot maci — beraberlik teklifine sunucu tarafi bot cevabi (WS).

env fixture'i, apps/api/tests/test_live_two_moves.py ile AYNI desendir.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.models import Game, GameType, GameStatus


class FakeRoom:
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


BEYAZ_ONDE = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@pytest.mark.asyncio
async def test_bot_geride_teklifi_kabul_eder_ve_mac_biter(env):
    from chess_api.routers.live_game import _handle_offer_draw

    # student_color='w' -> bot siyah; beyaz vezir fazla -> bot GERIDE.
    gid = await _make_bot_game(env, student_color="w", start_fen=BEYAZ_ONDE)

    room = FakeRoom()
    await _handle_offer_draw(gid, 9, 9, room)

    over = [m for m in room.broadcasts if m["type"] == "game_over"]
    assert over and over[-1]["result"] == "1/2-1/2"


@pytest.mark.asyncio
async def test_bot_acik_ara_ondeyse_reddeder_ve_sporcuya_ULASIR(env):
    """Sorun A'nin regresyon testi: mevcut _handle_decline_draw kullanilsaydi
    bu mesaj HIC sporcuya ULASMAZDI (exclude=child_id, odada tek kisi var)."""
    from chess_api.routers.live_game import _handle_offer_draw

    # student_color='b' -> bot beyaz; beyaz vezir fazla -> bot ONDE.
    gid = await _make_bot_game(env, student_color="b", start_fen=BEYAZ_ONDE)

    room = FakeRoom()
    await _handle_offer_draw(gid, 9, 9, room)

    declined = [m for m in room.broadcasts if m["type"] == "draw_declined"]
    assert declined, "sporcuya draw_declined mesaji ULASMALI"
    assert declined[0]["by_child_id"] is None

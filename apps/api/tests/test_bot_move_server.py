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
async def test_siyah_oynayan_sporcu_hamle_yapabilir(env, monkeypatch):
    """Bugunku (duzeltmeden onceki) kod bunu REDDEDERDI — white_id/black_id'ye
    bakar, bot macinda black_id hep None'dur.

    NOT: sporcu e7e5 oynayinca sira BEYAZA (bota) geciyor — Task 3'ten beri
    _handle_move bunu farkedip botun hamlesini dener. Bu test yalnizca
    SPORCUNUN hamlesinin kabul edildigini sinamak istedigi icin get_bot_move
    sahte bir motorla degistirilir; gercek Stockfish binary'si bu makinede
    kurulu degil (FileNotFoundError vermeden once dogrulandi)."""
    from chess_api.routers.live_game import _handle_move

    async def sahte_motor(fen, skill_level):
        return None  # bot bu turda hamle uretmesin, testi basit tut

    monkeypatch.setattr("chess_api.routers.live_game.get_bot_move", sahte_motor)

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


@pytest.mark.asyncio
async def test_insan_hamlesinden_sonra_bot_hamlesi_otomatik_oynanir(env, monkeypatch):
    from chess_api.routers.live_game import _handle_move

    async def sahte_motor(fen, skill_level):
        return "e7e5"  # 1.e4 sonrasi standart cevap

    monkeypatch.setattr("chess_api.routers.live_game.get_bot_move", sahte_motor)

    gid = await _make_bot_game(env, student_color="w")

    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "e2e4"}, room)

    sans = [m["san"] for m in room.broadcasts if m["type"] == "move_made"]
    assert sans == ["e4", "e5"]
    bot_msg = [m for m in room.broadcasts if m["type"] == "move_made"][1]
    assert bot_msg["by_child_id"] is None


@pytest.mark.asyncio
async def test_bot_hamlesi_veritabanina_kaydedilir(env, monkeypatch):
    from chess_api.routers.live_game import _handle_move
    from sqlalchemy import select
    from chess_api.models import GameMove

    async def sahte_motor(fen, skill_level):
        return "e7e5"

    monkeypatch.setattr("chess_api.routers.live_game.get_bot_move", sahte_motor)

    gid = await _make_bot_game(env, student_color="w")
    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "e2e4"}, room)

    async with env() as db:
        moves = (await db.execute(
            select(GameMove).where(GameMove.game_id == gid).order_by(GameMove.ply)
        )).scalars().all()
    assert [m.san for m in moves] == ["e4", "e5"]
    assert moves[1].by_child_id is None


@pytest.mark.asyncio
async def test_insan_mat_ederse_bot_hamle_denemez(env, monkeypatch):
    """is_checkmate zaten True ise sira botta olsa bile motor CAGRILMAMALI —
    mac zaten bitmis."""
    from chess_api.routers.live_game import _handle_move

    called = {"n": 0}

    async def sahte_motor(fen, skill_level):
        called["n"] += 1
        return "a2a3"

    monkeypatch.setattr("chess_api.routers.live_game.get_bot_move", sahte_motor)

    # Fool's mate'e bir hamle kala: 1.f3 e5 2.g4, siyah (sporcu) Qh4# oynar.
    fen = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"
    gid = await _make_bot_game(env, student_color="b", start_fen=fen)

    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "d8h4"}, room)

    over = [m for m in room.broadcasts if m["type"] == "game_over"]
    assert over, "mat sonunda game_over yayinlanmali"
    assert called["n"] == 0, "insan mat ederse bot hamle DENEMEMELI"

"""Acilis pratigi — arkadasa karsi macin SECILEN konumdan baslamasi.

NEDEN monkeypatch: bkz. tests/test_game_clock_ws.py — _create_human_game kendi
oturumunu acar; fabrika test motoruna baglanir.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.models.game import Game

ITALYAN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1"


@pytest_asyncio.fixture
async def env(db_engine, monkeypatch):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(
        "chess_api.routers.live_game.get_session_factory", lambda: factory,
    )
    return factory


@pytest.mark.asyncio
async def test_acilis_konumu_mac_kaydina_yazilir(env):
    from chess_api.routers.live_game import _create_human_game

    gid = await _create_human_game(1, 2, start_fen=ITALYAN)
    async with env() as db:
        assert (await db.get(Game, gid)).start_fen == ITALYAN


@pytest.mark.asyncio
async def test_hamle_yokken_gecerli_konum_acilis_konumudur(env):
    """Kritik: eskiden hamle yoksa HER ZAMAN standart konum donuyordu; o yuzden
    secilen acilis tahtaya hic yansimiyordu."""
    from chess_api.routers.live_game import _create_human_game, _current_fen_and_ply

    gid = await _create_human_game(1, 2, start_fen=ITALYAN)
    async with env() as db:
        fen, ply = await _current_fen_and_ply(db, gid)
    assert fen == ITALYAN
    assert ply == 1


@pytest.mark.asyncio
async def test_acilissiz_macta_standart_konum_korunur(env):
    """REGRESYON: acilis pratiginden gelmeyen maclar bozulmaz."""
    from chess_api.routers.live_game import (
        _create_human_game, _current_fen_and_ply, INITIAL_FEN,
    )

    gid = await _create_human_game(1, 2)
    async with env() as db:
        fen, ply = await _current_fen_and_ply(db, gid)
    assert fen == INITIAL_FEN
    assert ply == 1

import pytest
from sqlalchemy import select
from chess_api.models import Game, GameType, GameStatus
from chess_api.models.opening import Opening


@pytest.mark.asyncio
async def test_yeni_oyunda_beraberlik_sayaclari_sifirdir(db):
    """Varsayilan 0 olmali; mevcut satirlar da 0 kabul edilir (geriye uyumluluk)."""
    game = Game(type=GameType.human, white_child_id=1, black_child_id=2,
                status=GameStatus.active)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    assert game.white_draw_offers == 0
    assert game.black_draw_offers == 0


@pytest.mark.asyncio
async def test_start_fen_varsayilan_none(db):
    """start_fen bossa standart baslangic pozisyonu varsayilir (geriye uyumluluk)."""
    game = Game(type=GameType.bot, white_child_id=1, black_bot_level=5)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    assert game.start_fen is None


@pytest.mark.asyncio
async def test_start_fen_kaydedilebilir(db):
    fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    game = Game(type=GameType.bot, white_child_id=1, black_bot_level=5, start_fen=fen)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    assert game.start_fen == fen


@pytest.mark.asyncio
async def test_opening_kaydedilir(db):
    op = Opening(name="İtalyan Açılışı",
                 start_fen="r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1")
    db.add(op)
    await db.commit()
    found = (await db.execute(select(Opening))).scalars().all()
    assert len(found) == 1
    assert found[0].name == "İtalyan Açılışı"

import pytest
from sqlalchemy import select
from chess_api.models import ChildProfile, Game, GameType, GameStatus, GameResult, ChildTempoRating
from chess_api.services.tempo import tempo_category
from chess_api.services.rating import (
    title_for_rating, apply_rating_update, get_rating_or_default,
    STARTING_RATING, K_PROVISIONAL, K_ESTABLISHED, PROVISIONAL_GAMES,
)


def test_tempo_siniflandirmasi_9_sabit():
    assert tempo_category(180_000, 2_000) == "Yıldırım"
    assert tempo_category(300_000, 0) == "Yıldırım"
    assert tempo_category(300_000, 3_000) == "Yıldırım"
    assert tempo_category(600_000, 0) == "Hızlı"
    assert tempo_category(600_000, 5_000) == "Hızlı"
    assert tempo_category(900_000, 10_000) == "Hızlı"
    assert tempo_category(1_800_000, 0) == "Klasik"
    assert tempo_category(1_800_000, 10_000) == "Klasik"
    assert tempo_category(1_800_000, 20_000) == "Klasik"


def test_tempo_eslesmeyen_deger_none_doner():
    assert tempo_category(None, None) is None
    assert tempo_category(1_500_000, 0) is None  # 25 dakika — sabit degil
    assert tempo_category(60_000, 0) is None


@pytest.mark.parametrize("rating,title", [
    (0, "BD-1"), (399, "BD-1"), (400, "BD-2"), (999, "BD-4"), (1000, "OD-1"),
    (1999, "İD-2"), (2000, "CM"), (2399, "NM"), (2400, "FM"), (2599, "IM"),
    (2699, "GM"), (2799, "SGM"), (2800, "WEGM"), (3200, "WEGM"),
])
def test_unvan_kademeleri(rating, title):
    assert title_for_rating(rating) == title


@pytest.mark.asyncio
async def test_puansiz_mac_puani_degistirmez(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    game = Game(type=GameType.human, status=GameStatus.finished, result=GameResult.white_wins,
               white_child_id=p1.id, black_child_id=p2.id, base_ms=300_000, increment_ms=0,
               rated=False)
    db.add(game)
    await db.commit()
    await db.refresh(game)

    await apply_rating_update(db, game)
    await db.commit()

    rows = (await db.execute(
        select(ChildTempoRating)
    )).scalars().all()
    assert rows == []  # hicbir satir olusmadi


@pytest.mark.asyncio
async def test_bot_maci_puan_etkilemez(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    db.add(p1)
    await db.commit()
    await db.refresh(p1)

    game = Game(type=GameType.bot, status=GameStatus.finished, result=GameResult.white_wins,
               white_child_id=p1.id, black_child_id=None, base_ms=300_000, increment_ms=0,
               rated=True)  # rated=True bile olsa bot maci etkilenmemeli
    db.add(game)
    await db.commit()
    await db.refresh(game)

    await apply_rating_update(db, game)
    await db.commit()

    rating = await get_rating_or_default(db, p1.id, "Yıldırım")
    assert rating == STARTING_RATING


@pytest.mark.asyncio
async def test_eslesmeyen_tempoda_puan_degismez(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    game = Game(type=GameType.human, status=GameStatus.finished, result=GameResult.white_wins,
               white_child_id=p1.id, black_child_id=p2.id, base_ms=1_500_000, increment_ms=0,
               rated=True)
    db.add(game)
    await db.commit()
    await db.refresh(game)

    await apply_rating_update(db, game)
    await db.commit()

    rows = (await db.execute(
        select(ChildTempoRating)
    )).scalars().all()
    assert rows == []


@pytest.mark.asyncio
async def test_galibiyet_puan_kazandirir_kayip_kaybettirir(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    game = Game(type=GameType.human, status=GameStatus.finished, result=GameResult.white_wins,
               white_child_id=p1.id, black_child_id=p2.id, base_ms=300_000, increment_ms=0,
               rated=True)
    db.add(game)
    await db.commit()
    await db.refresh(game)

    await apply_rating_update(db, game)
    await db.commit()

    # Esit baslangic puaninda (400=400) expected=0.5, K=40 (provisional):
    # beyaz: 400 + 40*(1-0.5) = 420. siyah: 400 + 40*(0-0.5) = 380.
    white_rating = await get_rating_or_default(db, p1.id, "Yıldırım")
    black_rating = await get_rating_or_default(db, p2.id, "Yıldırım")
    assert white_rating == 420
    assert black_rating == 380


@pytest.mark.asyncio
async def test_beraberlik_esit_puanda_degismez(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    game = Game(type=GameType.human, status=GameStatus.finished, result=GameResult.draw,
               white_child_id=p1.id, black_child_id=p2.id, base_ms=300_000, increment_ms=0,
               rated=True)
    db.add(game)
    await db.commit()
    await db.refresh(game)

    await apply_rating_update(db, game)
    await db.commit()

    assert await get_rating_or_default(db, p1.id, "Yıldırım") == STARTING_RATING
    assert await get_rating_or_default(db, p2.id, "Yıldırım") == STARTING_RATING


@pytest.mark.asyncio
async def test_farkli_tempolarda_puan_bagimsiz(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)

    yildirim = Game(type=GameType.human, status=GameStatus.finished, result=GameResult.white_wins,
                    white_child_id=p1.id, black_child_id=p2.id, base_ms=300_000, increment_ms=0, rated=True)
    db.add(yildirim)
    await db.commit()
    await db.refresh(yildirim)
    await apply_rating_update(db, yildirim)
    await db.commit()

    # Yildirim'da p1 kazandi (420), ama Klasik'te hic mac yok — 400 kalmali.
    assert await get_rating_or_default(db, p1.id, "Yıldırım") == 420
    assert await get_rating_or_default(db, p1.id, "Klasik") == STARTING_RATING


@pytest.mark.asyncio
async def test_k_faktoru_20_mactan_sonra_dusuyor(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    db.add(p1)
    await db.commit()
    await db.refresh(p1)
    row = ChildTempoRating(child_id=p1.id, tempo="Yıldırım", rating=400, games_played=PROVISIONAL_GAMES)
    db.add(row)
    await db.commit()

    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add(p2)
    await db.commit()
    await db.refresh(p2)

    game = Game(type=GameType.human, status=GameStatus.finished, result=GameResult.white_wins,
               white_child_id=p1.id, black_child_id=p2.id, base_ms=300_000, increment_ms=0, rated=True)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    await apply_rating_update(db, game)
    await db.commit()

    # p1 artik K_ESTABLISHED(20) kullanmali: 400 + 20*(1-0.5) = 410 (40 degil).
    assert await get_rating_or_default(db, p1.id, "Yıldırım") == 410


@pytest.mark.asyncio
async def test_puan_0in_altina_inmez(db):
    p1 = ChildProfile(parent_user_id=1, display_name="A", age=9, pin_hash="x")
    p2 = ChildProfile(parent_user_id=1, display_name="B", age=9, pin_hash="x")
    db.add_all([p1, p2])
    await db.commit()
    await db.refresh(p1)
    await db.refresh(p2)
    db.add(ChildTempoRating(child_id=p1.id, tempo="Yıldırım", rating=5, games_played=0))
    await db.commit()

    game = Game(type=GameType.human, status=GameStatus.finished, result=GameResult.black_wins,
               white_child_id=p1.id, black_child_id=p2.id, base_ms=300_000, increment_ms=0, rated=True)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    await apply_rating_update(db, game)
    await db.commit()

    assert await get_rating_or_default(db, p1.id, "Yıldırım") >= 0

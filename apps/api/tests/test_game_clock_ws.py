"""Mac saati — router seviyesi testler.

NEDEN monkeypatch: _create_human_game ve _apply_clock_on_move KENDI oturumunu
acar (get_session_factory()). conftest'teki get_db override'i yalnizca FastAPI
bagimliligina uygulanir, dogrudan cagrilan bu fabrikaya DEGIL — o yuzden
testler gercek DATABASE_URL'e baglanmaya kalkar ve ConnectionError verir.
Fabrikayi test motoruna baglamak sahtekarlik degil; kodun aynisi calisir,
sadece hedef veritabani testinki olur.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.models.game import Game
from chess_api.services.clock import ClockState, is_flagged


@pytest_asyncio.fixture
async def clock_env(db_engine, monkeypatch):
    """live_game modulunun oturum fabrikasini test motoruna baglar."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(
        "chess_api.routers.live_game.get_session_factory", lambda: factory,
    )
    return factory


@pytest.mark.asyncio
async def test_tempolu_mac_saat_alanlariyla_acilir(clock_env):
    """5+3 secilirse mac 300000 ms ve 3000 ms artirimla baslar.

    Madde 2026-09-09 (1): last_clock_at ARTIK BASTAN BOS — saat ilk hamleye
    kadar hic islemez (15sn ilk-hamle bekleme penceresinde sure azalmasin
    diye). Bkz. test_saat_ilk_hamleye_kadar_islemez_ilk_hamlede_baslar."""
    from chess_api.routers.live_game import _create_human_game

    gid = await _create_human_game(1, 2, base_ms=300_000, increment_ms=3_000)
    async with clock_env() as db:
        g = await db.get(Game, gid)
        assert g.base_ms == 300_000
        assert g.increment_ms == 3_000
        assert g.white_ms == 300_000
        assert g.black_ms == 300_000
        assert g.last_clock_at is None


@pytest.mark.asyncio
async def test_temposuz_mac_saatsiz_acilir(clock_env):
    """REGRESYON: eski cagiranlar (kuyruk akisi) tempo vermez, bozulmaz."""
    from chess_api.routers.live_game import _create_human_game

    gid = await _create_human_game(1, 2)
    async with clock_env() as db:
        g = await db.get(Game, gid)
        assert g.base_ms is None
        assert g.white_ms is None
        assert g.last_clock_at is None


@pytest.mark.asyncio
async def test_saat_ilk_hamleye_kadar_islemez_ilk_hamlede_baslar(clock_env):
    """Madde 2026-09-09 (1): oyuncular eşleşince verilen ilk-hamle bekleme
    penceresinde (bkz. FIRST_MOVE_TIMEOUT_SECONDS) süre HİÇ azalmaz — saat
    tam ilk hamlede, sıfırdan başlar (o hamleye kadar geçen gerçek süre
    SAYILMAZ). İkinci hamleden itibaren saat NORMAL işler."""
    from datetime import datetime, timedelta
    from chess_api.routers.live_game import _create_human_game, _apply_clock_on_move

    gid = await _create_human_game(1, 2, base_ms=300_000, increment_ms=0)
    async with clock_env() as db:
        g = await db.get(Game, gid)
        assert g.last_clock_at is None  # bekleme penceresi: saat henüz YOK

        # İlk hamle: gerçek geçen süre kaç saniye olursa olsun düşülmemeli.
        flagged = await _apply_clock_on_move(db, g, white_to_move=True)
        assert flagged is False
        assert g.white_ms == 300_000
        assert g.black_ms == 300_000
        assert g.last_clock_at is not None  # artık işliyor

        # İkinci hamle (siyahınki) — saat artık NORMAL işler.
        g.last_clock_at = datetime.utcnow() - timedelta(seconds=5)
        await db.commit()
        flagged2 = await _apply_clock_on_move(db, g, white_to_move=False)
        assert flagged2 is False
        assert g.black_ms is not None and g.black_ms < 300_000


@pytest.mark.asyncio
async def test_hamle_sonrasi_saat_dusulur(clock_env):
    """Hamle isleyince oynayanin saati azalir, rakibinki durur."""
    from datetime import datetime, timedelta
    from chess_api.routers.live_game import _create_human_game, _apply_clock_on_move

    gid = await _create_human_game(1, 2, base_ms=300_000, increment_ms=0)
    async with clock_env() as db:
        g = await db.get(Game, gid)
        # Son hamle 4 saniye once islenmis gibi geri al
        g.last_clock_at = datetime.utcnow() - timedelta(seconds=4)
        await db.commit()

        flagged = await _apply_clock_on_move(db, g, white_to_move=True)
        assert flagged is False
        assert 295_000 <= g.white_ms <= 296_500   # ~4 sn dustu
        assert g.black_ms == 300_000              # rakip dokunulmadi


@pytest.mark.asyncio
async def test_suresi_bitmis_macta_hamle_bayrak_dondurur(clock_env):
    """Son hamleden bu yana kalan sureden COK gecmisse hamle islenmez."""
    from datetime import datetime, timedelta
    from chess_api.routers.live_game import _create_human_game, _apply_clock_on_move

    gid = await _create_human_game(1, 2, base_ms=5_000, increment_ms=0)
    async with clock_env() as db:
        g = await db.get(Game, gid)
        g.last_clock_at = datetime.utcnow() - timedelta(seconds=30)
        await db.commit()
        assert await _apply_clock_on_move(db, g, white_to_move=True) is True


@pytest.mark.asyncio
async def test_saatsiz_macta_clock_islenmez(clock_env):
    """REGRESYON: eski mac (base_ms None) hamlede saat hesabina girmez."""
    from chess_api.routers.live_game import _create_human_game, _apply_clock_on_move

    gid = await _create_human_game(1, 2)
    async with clock_env() as db:
        g = await db.get(Game, gid)
        flagged = await _apply_clock_on_move(db, g, white_to_move=True)
        assert flagged is False
        assert g.white_ms is None


def test_sahte_flag_maci_bitirmez():
    """Sure dolmamisken gelen 'flag' iddiasi REDDEDILIR (saf kontrol)."""
    st = ClockState(white_ms=200_000, black_ms=200_000, last_at=1_000_000.0,
                    white_increment_ms=0, black_increment_ms=0)
    assert is_flagged(st, white_to_move=True, now=1_000_010.0) is False

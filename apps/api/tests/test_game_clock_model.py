import pytest
from chess_api.models.game import Game, GameType, GameStatus


@pytest.mark.asyncio
async def test_saat_alanlari_bos_birakilabilir(db):
    """ESKI MACLAR: saat alanlari NULL kalir, mac calismaya devam eder."""
    g = Game(type=GameType.human, status=GameStatus.active,
             white_child_id=1, black_child_id=2)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    assert g.base_ms is None
    assert g.increment_ms is None
    assert g.white_ms is None
    assert g.black_ms is None
    assert g.last_clock_at is None


@pytest.mark.asyncio
async def test_saat_alanlari_yazilip_okunabilir(db):
    from datetime import datetime
    now = datetime(2026, 7, 27, 10, 0, 0)
    g = Game(type=GameType.human, status=GameStatus.active,
             white_child_id=1, black_child_id=2,
             base_ms=300000, increment_ms=3000,
             white_ms=300000, black_ms=300000, last_clock_at=now)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    assert g.base_ms == 300000
    assert g.increment_ms == 3000
    assert g.last_clock_at == now

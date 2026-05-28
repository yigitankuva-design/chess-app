import pytest_asyncio
from datetime import date
from chess_api.models import Puzzle, PuzzleTheme
from chess_api.services.daily_challenge import todays_puzzle


@pytest_asyncio.fixture
async def puzzles_for_daily(db):
    """Create 10 puzzles in the 700-1000 rating range for daily challenge tests."""
    theme_daily = PuzzleTheme(slug="daily", name_tr="Günlük Bulmaca", description_tr=None)
    db.add(theme_daily)
    await db.flush()

    ps = []
    for i in range(10):
        p = Puzzle(
            lichess_id=f"D{i}", fen="6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
            moves_json=["e1e8"], rating=750 + i * 10, popularity=90,
        )
        p.themes.append(theme_daily)
        ps.append(p)
    db.add_all(ps)
    await db.commit()
    return [p.id for p in ps]


async def test_daily_puzzle_endpoint(client, puzzles_for_daily):
    """Test that /daily/puzzle returns a puzzle when available."""
    r = await client.get("/daily/puzzle")
    assert r.status_code == 200
    data = r.json()
    assert data["available"] is True
    assert "puzzle_id" in data
    assert "fen" in data
    assert "moves" in data
    assert isinstance(data["themes"], list)


async def test_daily_puzzle_deterministic_same_day(db, puzzles_for_daily):
    """Test that same date returns same puzzle."""
    d = date(2026, 5, 28)
    p1 = await todays_puzzle(db, today=d)
    p2 = await todays_puzzle(db, today=d)
    assert p1 is not None
    assert p2 is not None
    assert p1.id == p2.id


async def test_daily_puzzle_changes_across_days(db, puzzles_for_daily):
    """Test that different dates likely return different puzzles."""
    ids = set()
    for day in range(1, 15):
        p = await todays_puzzle(db, today=date(2026, 6, day))
        if p:
            ids.add(p.id)
    # With 10 puzzles and 14 days, we expect >1 distinct puzzle
    assert len(ids) > 1


async def test_daily_no_puzzles_returns_unavailable(client):
    """Test that /daily/puzzle returns unavailable when no puzzles exist."""
    # This client fixture uses a fresh db_engine with no puzzles in the 700-1000 band
    r = await client.get("/daily/puzzle")
    assert r.status_code == 200
    data = r.json()
    assert data["available"] is False
    assert "puzzle_id" not in data

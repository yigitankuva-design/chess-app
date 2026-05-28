import pytest_asyncio
from chess_api.models import Puzzle, PuzzleTheme


@pytest_asyncio.fixture
async def seeded_puzzles(db):
    theme_fork = PuzzleTheme(slug="fork", name_tr="Çatal", description_tr=None)
    theme_mate = PuzzleTheme(slug="mateIn1", name_tr="Tek hamlede mat", description_tr=None)
    db.add_all([theme_fork, theme_mate])
    await db.flush()

    puzzles = []
    for i in range(5):
        p = Puzzle(
            lichess_id=f"P{i}", fen="6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
            moves_json=["e1e8"], rating=800 + i * 10, popularity=90, module_id=None,
        )
        p.themes.append(theme_fork)
        puzzles.append(p)
    db.add_all(puzzles)
    await db.commit()
    return {"puzzle_ids": [p.id for p in puzzles]}


async def test_random_puzzle_requires_auth(client, seeded_puzzles):
    response = await client.get("/puzzles/random")
    assert response.status_code in (401, 403)


async def test_parent_token_rejected_on_random_puzzle(client, seeded_puzzles):
    """A parent token must be rejected on child-only endpoint."""
    r = await client.post("/auth/parent/signup", json={
        "email": "puzparent@t.com", "password": "guvenli12345", "name": "PuzParent",
    })
    parent_token = r.json()["access_token"]
    response = await client.get("/puzzles/random",
                                headers={"Authorization": f"Bearer {parent_token}"})
    assert response.status_code == 401


async def test_random_puzzle_returns_puzzle(client, seeded_puzzles, child_auth):
    token, child_id = child_auth
    response = await client.get("/puzzles/random",
                                headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "fen" in data
    assert "moves" in data
    assert isinstance(data["themes"], list)
    assert "Çatal" in data["themes"]


async def test_record_attempt(client, seeded_puzzles, child_auth):
    token, child_id = child_auth
    pid = seeded_puzzles["puzzle_ids"][0]
    response = await client.post(
        f"/puzzles/{pid}/attempt",
        headers={"Authorization": f"Bearer {token}"},
        json={"success": True, "time_seconds": 12, "moves_attempted": ["e1e8"]},
    )
    assert response.status_code == 200
    assert response.json()["accepted"] is True


async def test_attempt_unknown_puzzle_404(client, seeded_puzzles, child_auth):
    token, child_id = child_auth
    response = await client.post(
        "/puzzles/99999/attempt",
        headers={"Authorization": f"Bearer {token}"},
        json={"success": False, "time_seconds": 5},
    )
    assert response.status_code == 404


async def test_correct_attempt_creates_srs_card(client, seeded_puzzles, db, child_auth):
    from sqlalchemy import select as _select
    from chess_api.models import SRSCard
    token, child_id = child_auth
    pid = seeded_puzzles["puzzle_ids"][0]
    await client.post(
        f"/puzzles/{pid}/attempt",
        headers={"Authorization": f"Bearer {token}"},
        json={"success": True, "time_seconds": 10},
    )
    cards = (await db.execute(_select(SRSCard).where(SRSCard.item_id == pid))).scalars().all()
    assert len(cards) == 1
    assert cards[0].item_type.value == "puzzle"
    # Confirm the card is owned by the real child_id (not a parent User.id)
    assert cards[0].child_id == child_id


async def test_failed_attempt_no_srs_card(client, seeded_puzzles, db, child_auth):
    from sqlalchemy import select as _select
    from chess_api.models import SRSCard
    token, child_id = child_auth
    pid = seeded_puzzles["puzzle_ids"][1]
    await client.post(
        f"/puzzles/{pid}/attempt",
        headers={"Authorization": f"Bearer {token}"},
        json={"success": False, "time_seconds": 10},
    )
    cards = (await db.execute(_select(SRSCard).where(SRSCard.item_id == pid))).scalars().all()
    assert len(cards) == 0

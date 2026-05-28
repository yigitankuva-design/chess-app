import pytest_asyncio
from sqlalchemy import select
from chess_api.services.badge_engine import evaluate_event, BadgeEvent
from chess_api.services.rank_engine import add_xp
from chess_api.models import (
    Badge, ChildProfile, User, UserRole, ChildPuzzleAttempt, Rank, ChildRank,
)
from chess_api.services.password import hash_password


@pytest_asyncio.fixture
async def child_with_badges(db):
    # Create parent + child + seed a couple of badges + ranks
    parent = User(email="b@t.com", password_hash=hash_password("guvenli12345"),
                  role=UserRole.parent, name="P")
    db.add(parent)
    await db.flush()
    child = ChildProfile(parent_user_id=parent.id, display_name="Ali", age=10, pin_hash="x")
    db.add(child)
    await db.flush()

    db.add_all([
        Badge(slug="first_puzzle", name_tr="İlk Bulmaca", description_tr="d", icon="i",
              criteria_json={"type": "puzzles_solved", "count": 1}),
        Badge(slug="puzzle_10", name_tr="10 Puzzle", description_tr="d", icon="i",
              criteria_json={"type": "puzzles_solved", "count": 10}),
        Badge(slug="first_mate", name_tr="İlk Mat", description_tr="d", icon="i",
              criteria_json={"type": "first_mate", "count": 1}),
    ])
    db.add_all([
        Rank(order_index=1, name_tr="Piyon", xp_required=0, icon="p"),
        Rank(order_index=2, name_tr="At", xp_required=200, icon="k"),
    ])
    await db.commit()
    return child.id


async def test_first_puzzle_badge_awarded(db, child_with_badges):
    child_id = child_with_badges
    # Record 1 successful puzzle attempt
    db.add(ChildPuzzleAttempt(child_id=child_id, puzzle_id=1, success=True, time_seconds=20))
    await db.commit()

    new = await evaluate_event(db, child_id, BadgeEvent(type="puzzle_solved"))
    slugs = {b.slug for b in new}
    assert "first_puzzle" in slugs
    assert "puzzle_10" not in slugs  # only 1 solved


async def test_badge_not_double_awarded(db, child_with_badges):
    child_id = child_with_badges
    db.add(ChildPuzzleAttempt(child_id=child_id, puzzle_id=1, success=True, time_seconds=20))
    await db.commit()
    await evaluate_event(db, child_id, BadgeEvent(type="puzzle_solved"))
    # second evaluation should NOT re-award first_puzzle
    new = await evaluate_event(db, child_id, BadgeEvent(type="puzzle_solved"))
    assert all(b.slug != "first_puzzle" for b in new)


async def test_first_mate_event_badge(db, child_with_badges):
    child_id = child_with_badges
    new = await evaluate_event(db, child_id, BadgeEvent(type="first_mate"))
    assert any(b.slug == "first_mate" for b in new)


async def test_add_xp_and_rank_up(db, child_with_badges):
    child_id = child_with_badges
    # 10 puzzle solves = 100 XP, still Piyon (need 200 for At)
    for _ in range(10):
        await add_xp(db, child_id, "puzzle_solved")
    cr = (await db.execute(
        select(ChildRank).where(ChildRank.child_id == child_id)
    )).scalar_one()
    assert cr.xp_total == 100

    # Add a module_completed (100 XP) -> 200 total -> rank up to At
    result = await add_xp(db, child_id, "module_completed")
    assert result["leveled_up"] is True
    assert result["rank"] == "At"

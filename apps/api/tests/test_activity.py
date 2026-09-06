import pytest_asyncio
from datetime import date
from sqlalchemy import select
from chess_api.services.activity_logger import log_activity
from chess_api.services.time_limit_check import check_time_limit
from chess_api.models import ChildActivityLog, ParentTimeLimit, ChildProfile, User, UserRole, Module, Lesson, LessonStepType
from chess_api.services.password import hash_password


@pytest_asyncio.fixture
async def a_child(db):
    parent = User(email="act@t.com", password_hash=hash_password("guvenli12345"), role=UserRole.parent, name="P")
    db.add(parent); await db.flush()
    child = ChildProfile(parent_user_id=parent.id, display_name="Ali", age=10, pin_hash="x")
    db.add(child); await db.commit()
    return child.id


async def test_log_activity_category_seconds(db, a_child):
    """Madde 2026-09-06: play_seconds/lessons_seconds/practice_seconds ayrı
    ayrı tutulur, AMA total_seconds'a da eklenir (geriye uyumluluk)."""
    await log_activity(db, a_child, play_seconds=300)
    await log_activity(db, a_child, lessons_seconds=120)
    await log_activity(db, a_child, practice_seconds=60)
    log = (await db.execute(select(ChildActivityLog).where(ChildActivityLog.child_id == a_child))).scalar_one()
    assert log.play_seconds == 300
    assert log.lessons_seconds == 120
    assert log.practice_seconds == 60
    assert log.total_seconds == 480


async def test_log_activity_upserts(db, a_child):
    await log_activity(db, a_child, time_seconds=120, puzzles=1)
    await log_activity(db, a_child, time_seconds=60, puzzles=2)
    log = (await db.execute(select(ChildActivityLog).where(ChildActivityLog.child_id == a_child))).scalar_one()
    assert log.total_seconds == 180
    assert log.puzzles_solved == 3


async def test_time_limit_no_limit_allowed(db, a_child):
    status = await check_time_limit(db, a_child)
    assert status["allowed"] is True
    assert status["limit_minutes"] is None


async def test_time_limit_enforced(db, a_child):
    db.add(ParentTimeLimit(child_id=a_child, daily_minutes_limit=30))
    await db.commit()
    # log 31 minutes
    await log_activity(db, a_child, time_seconds=31 * 60)
    status = await check_time_limit(db, a_child)
    assert status["allowed"] is False
    assert status["used_minutes"] == 31


async def test_lesson_complete_endpoint(client, child_auth, db):
    child_token, child_id = child_auth
    # seed a module + lesson
    module = Module(order_index=1, name="M", description="d", icon="i")
    db.add(module); await db.flush()
    lesson = Lesson(module_id=module.id, order_index=1, title="L", estimated_minutes=8)
    db.add(lesson); await db.commit()

    r = await client.post(f"/lessons/{lesson.id}/complete",
                          headers={"Authorization": f"Bearer {child_token}"})
    assert r.status_code == 200
    data = r.json()
    assert data["completed"] is True
    assert data["newly_completed"] is True

    # Second call: not newly completed
    r2 = await client.post(f"/lessons/{lesson.id}/complete",
                           headers={"Authorization": f"Bearer {child_token}"})
    assert r2.json()["newly_completed"] is False


async def test_lesson_complete_requires_child_token(client):
    r = await client.post("/lessons/1/complete")
    assert r.status_code in (401, 403)

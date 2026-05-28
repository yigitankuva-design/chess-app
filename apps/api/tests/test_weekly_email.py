import pytest
import pytest_asyncio
from datetime import date
from chess_api.services.weekly_email import build_summary_text, send_weekly_summary_for_parent
from chess_api.models import User, UserRole, ChildProfile, ChildActivityLog
from chess_api.services.password import hash_password


@pytest_asyncio.fixture
async def parent_with_activity(db):
    parent = User(email="we@t.com", password_hash=hash_password("guvenli12345"), role=UserRole.parent, name="Veli")
    db.add(parent)
    await db.flush()
    child = ChildProfile(parent_user_id=parent.id, display_name="Ali", age=10, pin_hash="x")
    db.add(child)
    await db.flush()
    db.add(ChildActivityLog(child_id=child.id, date=date.today(), total_seconds=600, lessons_completed=2, puzzles_solved=5, games_played=1))
    await db.commit()
    return parent


async def test_build_summary_includes_child_stats(db, parent_with_activity):
    text = await build_summary_text(db, parent_with_activity)
    assert text is not None
    assert "Ali" in text
    assert "10 dakika" in text  # 600s = 10 min
    assert "Tamamlanan ders: 2" in text


async def test_send_weekly_logs_in_dev(db, parent_with_activity):
    # ENV defaults to development in tests -> logs, returns True
    result = await send_weekly_summary_for_parent(db, parent_with_activity)
    assert result is True


async def test_parent_no_children_returns_none(db):
    p = User(email="nochild@t.com", password_hash=hash_password("guvenli12345"), role=UserRole.parent, name="X")
    db.add(p)
    await db.commit()
    text = await build_summary_text(db, p)
    assert text is None

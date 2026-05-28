import logging
from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi_mail import FastMail, MessageSchema, MessageType

from chess_api.database import get_session_factory
from chess_api.models import User, UserRole, ChildProfile, ChildActivityLog
from chess_api.services.email import _config
from chess_api.settings import settings

logger = logging.getLogger(__name__)


async def build_summary_text(db: AsyncSession, parent: User) -> str | None:
    """Build the weekly recap text for one parent, or None if they have no children."""
    children = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == parent.id)
    )).scalars().all()
    if not children:
        return None

    seven_days_ago = date.today() - timedelta(days=7)
    parts = []
    for c in children:
        logs = (await db.execute(
            select(ChildActivityLog).where(
                ChildActivityLog.child_id == c.id,
                ChildActivityLog.date >= seven_days_ago,
            )
        )).scalars().all()
        minutes = sum(l.total_seconds for l in logs) // 60
        lessons = sum(l.lessons_completed for l in logs)
        puzzles = sum(l.puzzles_solved for l in logs)
        games = sum(l.games_played for l in logs)
        parts.append(
            f"\n📊 {c.display_name}:\n"
            f"   - Toplam süre: {minutes} dakika\n"
            f"   - Tamamlanan ders: {lessons}\n"
            f"   - Çözülen problem: {puzzles}\n"
            f"   - Oynanan oyun: {games}\n"
        )
    return (
        f"Merhaba {parent.name},\n\n"
        f"Çocuğunuz(larınız)ın bu haftaki satranç ilerlemesi:\n"
        f"{''.join(parts)}\n"
        f"Daha fazlası için panele giriş yapın."
    )


async def send_weekly_summary_for_parent(db: AsyncSession, parent: User) -> bool:
    """Send (or log in dev) the weekly summary. Returns True if something was produced."""
    body = await build_summary_text(db, parent)
    if body is None:
        return False

    s = settings()
    if s.ENV == "development" or not s.SENDGRID_API_KEY:
        logger.info("[weekly-email-stub] to %s:\n%s", parent.email, body)
        return True

    msg = MessageSchema(
        subject="Haftalık Özet — Çocuklar İçin Satranç",
        recipients=[parent.email],
        body=body,
        subtype=MessageType.plain,
    )
    await FastMail(_config()).send_message(msg)
    return True


async def run_weekly_blast() -> int:
    """Send weekly summaries to all verified parents. Returns count sent."""
    sent = 0
    async with get_session_factory()() as db:
        parents = (await db.execute(
            select(User).where(User.role == UserRole.parent)
        )).scalars().all()
        for p in parents:
            try:
                if await send_weekly_summary_for_parent(db, p):
                    sent += 1
            except Exception:
                logger.exception("weekly email failed for %s", p.email)
    return sent

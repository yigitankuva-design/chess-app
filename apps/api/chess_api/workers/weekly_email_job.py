import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from chess_api.services.weekly_email import run_weekly_blast

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    """Start the weekly-email scheduler (Sunday 21:00 UTC). Idempotent."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(run_weekly_blast, "cron", day_of_week="sun", hour=21, minute=0, id="weekly_email")
    _scheduler.start()
    logger.info("Weekly email scheduler started")

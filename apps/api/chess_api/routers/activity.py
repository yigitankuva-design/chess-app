"""Sporcu Profili "Bu Hafta" kartı — Maç Yap/Dersler/Pratik Yap süre takibi.

Madde 2026-09-06 (Görsel 4): Zafer'in isteği — 7 günlük gösterge bir güne
tıklanınca o günün ("Günlük") ve ay içindeki AYNI HAFTA GÜNÜNÜN toplamının
("Aylık" — örn. bu ayki TÜM Pazartesilerin toplamı) 3 kategoride ayrı ayrı
gösterilmesi. `puzzles.py`'nin zaten kurduğu "istemci ölçer, sunucu güvenmez"
deseni Maç Yap/Dersler/Pratik Yap'a da yayılıyor (bkz. log_activity).
"""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, ChildActivityLog
from chess_api.services.activity_logger import log_activity

router = APIRouter(prefix="/activity", tags=["activity"])

CATEGORY_FIELDS = {
    "play": "play_seconds",
    "lessons": "lessons_seconds",
    "practice": "practice_seconds",
}


class LogTimeRequest(BaseModel):
    category: str
    seconds: int = Field(ge=0, le=6 * 60 * 60)  # tek oturum için makul üst sınır: 6 saat


@router.post("/log-time", status_code=204)
async def log_time(
    payload: LogTimeRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    if payload.category not in CATEGORY_FIELDS:
        raise HTTPException(400, "Invalid category")
    if payload.seconds == 0:
        return
    kwargs = {CATEGORY_FIELDS[payload.category]: payload.seconds}
    await log_activity(db, child.id, **kwargs)


def _category_totals(log: ChildActivityLog | None) -> dict:
    if log is None:
        return {"play_seconds": 0, "lessons_seconds": 0, "practice_seconds": 0}
    return {
        "play_seconds": log.play_seconds,
        "lessons_seconds": log.lessons_seconds,
        "practice_seconds": log.practice_seconds,
    }


class DaySummaryResponse(BaseModel):
    date: str
    week_start: str
    week_days: list[dict]
    daily: dict
    monthly: dict


@router.get("/day-summary", response_model=DaySummaryResponse)
async def day_summary(
    date_str: str | None = None,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """`date_str` verilmezse bugün kullanılır (ISO: YYYY-MM-DD)."""
    try:
        target = date.fromisoformat(date_str) if date_str else date.today()
    except ValueError:
        raise HTTPException(400, "Invalid date")

    week_start = target - timedelta(days=target.weekday())  # Pazartesi
    week_end = week_start + timedelta(days=6)

    week_rows = (await db.execute(
        select(ChildActivityLog).where(
            ChildActivityLog.child_id == child.id,
            ChildActivityLog.date >= week_start,
            ChildActivityLog.date <= week_end,
        )
    )).scalars().all()
    activity_by_date = {r.date: r for r in week_rows}
    week_days = [
        {
            "date": (week_start + timedelta(days=i)).isoformat(),
            "weekday": i,
            "has_activity": (week_start + timedelta(days=i)) in activity_by_date,
        }
        for i in range(7)
    ]

    daily_log = activity_by_date.get(target)
    daily = _category_totals(daily_log)

    # Aylık: bu ayki TÜM "target ile aynı haftanın günü" (örn. Pazartesi) olan
    # günlerin toplamı — Zafer'in madde 4'te tarif ettiği anlam.
    month_start = target.replace(day=1)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    month_rows = (await db.execute(
        select(ChildActivityLog).where(
            ChildActivityLog.child_id == child.id,
            ChildActivityLog.date >= month_start,
            ChildActivityLog.date < next_month,
        )
    )).scalars().all()
    same_weekday_rows = [r for r in month_rows if r.date.weekday() == target.weekday()]
    monthly = {
        "play_seconds": sum(r.play_seconds for r in same_weekday_rows),
        "lessons_seconds": sum(r.lessons_seconds for r in same_weekday_rows),
        "practice_seconds": sum(r.practice_seconds for r in same_weekday_rows),
    }

    return DaySummaryResponse(
        date=target.isoformat(), week_start=week_start.isoformat(),
        week_days=week_days, daily=daily, monthly=monthly,
    )

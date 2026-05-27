# Plan 7: Veli Paneli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Veli, çocuk(lar)ının ilerlemesini görür, süre sınırı koyar, haftalık özet email alır, anket/etkinliklere katılır.

**Architecture:** Backend `ParentTimeLimit`, `ParentSurvey`, `ParentSurveyResponse` modelleri + dashboard aggregate endpoint. Background job (APScheduler) Pazar gecesi haftalık email gönderir. Süre sınırı backend middleware'de uygulanır (gün toplam aktif dakikayı sayar).

**Tech Stack:** APScheduler, SendGrid (email), recharts (frontend grafikler), Python jinja2 (email template).

**Bağımlılık:** Plan 6 yeşil.
**Süre tahmini:** 2 hafta

---

## File Structure

```
apps/api/chess_api/
├── models/
│   └── parent.py             # ParentTimeLimit, ParentSurvey, ParentSurveyResponse, ChildActivityLog
├── schemas/
│   └── parent.py
├── routers/
│   └── parent.py
├── services/
│   ├── parent_dashboard.py
│   ├── time_limit_check.py   # middleware-grade enforcement
│   └── weekly_email.py
└── workers/
    └── weekly_email_job.py   # APScheduler

apps/web/
├── components/
│   ├── ChildSummaryCard.tsx
│   ├── TimeLimitDialog.tsx
│   ├── WeeklyActivityChart.tsx
│   └── SurveyForm.tsx
└── app/(parent)/
    ├── dashboard/page.tsx
    ├── child/[id]/page.tsx
    ├── time-limit/page.tsx
    ├── survey/[id]/page.tsx
    └── add-child/page.tsx     # (Plan 5'ten devam)
```

---

## Task 1: Parent Models

**Files:**
- Create: `apps/api/chess_api/models/parent.py`

- [ ] **Step 1.1: `models/parent.py`**

```python
from datetime import datetime
from sqlalchemy import String, Integer, JSON, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ParentTimeLimit(Base):
    __tablename__ = "parent_time_limits"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), unique=True, index=True)
    daily_minutes_limit: Mapped[int] = mapped_column(Integer, default=60)
    reset_hour: Mapped[int] = mapped_column(Integer, default=4)  # 04:00 lokal


class ChildActivityLog(Base):
    """Per-day, per-child total active minutes for limit enforcement + weekly summary."""
    __tablename__ = "child_activity_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    date: Mapped[datetime] = mapped_column(Date, index=True)
    total_seconds: Mapped[int] = mapped_column(Integer, default=0)
    lessons_completed: Mapped[int] = mapped_column(Integer, default=0)
    puzzles_solved: Mapped[int] = mapped_column(Integer, default=0)
    games_played: Mapped[int] = mapped_column(Integer, default=0)


class ParentSurvey(Base):
    __tablename__ = "parent_surveys"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    questions_json: Mapped[list] = mapped_column(JSON)
    created_by_teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    target_class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ParentSurveyResponse(Base):
    __tablename__ = "parent_survey_responses"
    id: Mapped[int] = mapped_column(primary_key=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("parent_surveys.id"), index=True)
    parent_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True)
    answers_json: Mapped[dict] = mapped_column(JSON)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 1.2: Migration + commit**

```bash
alembic revision --autogenerate -m "create parent and activity log tables"
alembic upgrade head
git commit -am "feat(parent): ParentTimeLimit, ChildActivityLog, ParentSurvey models"
```

---

## Task 2: Activity Logging Middleware

**Files:**
- Create: `apps/api/chess_api/services/activity_logger.py`
- Modify: `apps/api/chess_api/routers/lessons.py`, `puzzles.py`, `games.py` (her tamamlamada log)

- [ ] **Step 2.1: `services/activity_logger.py`**

```python
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.models import ChildActivityLog


async def log_activity(
    db: AsyncSession,
    child_id: int,
    time_seconds: int,
    lessons: int = 0, puzzles: int = 0, games: int = 0,
) -> None:
    today = date.today()
    result = await db.execute(
        select(ChildActivityLog).where(
            ChildActivityLog.child_id == child_id,
            ChildActivityLog.date == today,
        )
    )
    log = result.scalar_one_or_none()
    if log:
        log.total_seconds += time_seconds
        log.lessons_completed += lessons
        log.puzzles_solved += puzzles
        log.games_played += games
    else:
        log = ChildActivityLog(
            child_id=child_id, date=today, total_seconds=time_seconds,
            lessons_completed=lessons, puzzles_solved=puzzles, games_played=games,
        )
        db.add(log)
    await db.commit()
```

- [ ] **Step 2.2: Lessons/puzzles/games endpoint'lerini logging ile bağla**

Her başarılı tamamlama sonrası `await log_activity(db, child_id, time_seconds, lessons=1)` çağrısı ekle.

- [ ] **Step 2.3: Commit**

```bash
git commit -am "feat(parent): child activity logging on all events"
```

---

## Task 3: Time Limit Enforcement

**Files:**
- Create: `apps/api/chess_api/services/time_limit_check.py`
- Modify: Critical endpoint'lere check ekle

- [ ] **Step 3.1: `services/time_limit_check.py`**

```python
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.models import ParentTimeLimit, ChildActivityLog


async def check_time_limit(db: AsyncSession, child_id: int) -> dict:
    """Returns {'allowed': True/False, 'used_minutes': X, 'limit_minutes': Y}."""
    limit_q = await db.execute(
        select(ParentTimeLimit).where(ParentTimeLimit.child_id == child_id)
    )
    limit = limit_q.scalar_one_or_none()
    if not limit:
        return {"allowed": True, "used_minutes": 0, "limit_minutes": None}

    today_log_q = await db.execute(
        select(ChildActivityLog).where(
            ChildActivityLog.child_id == child_id,
            ChildActivityLog.date == date.today(),
        )
    )
    log = today_log_q.scalar_one_or_none()
    used_seconds = log.total_seconds if log else 0
    used_minutes = used_seconds // 60
    return {
        "allowed": used_minutes < limit.daily_minutes_limit,
        "used_minutes": used_minutes,
        "limit_minutes": limit.daily_minutes_limit,
    }
```

- [ ] **Step 3.2: Critical endpoint'lere check ekle**

`/lessons/{id}/start`, `/puzzles/random`, `/games/bot/start` gibi başlangıç endpoint'lerinde:

```python
status = await check_time_limit(db, child_id)
if not status["allowed"]:
    raise HTTPException(
        status_code=429,
        detail=f"Günlük süre doldu ({status['used_minutes']}/{status['limit_minutes']} dk)",
    )
```

- [ ] **Step 3.3: Commit**

```bash
git commit -am "feat(parent): daily time limit enforcement"
```

---

## Task 4: Parent Dashboard Aggregate Endpoint

**Files:**
- Create: `apps/api/chess_api/services/parent_dashboard.py`
- Create: `apps/api/chess_api/schemas/parent.py`
- Create: `apps/api/chess_api/routers/parent.py`

- [ ] **Step 4.1: `services/parent_dashboard.py`**

```python
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from chess_api.models import (
    ChildProfile, ChildActivityLog, ChildLessonProgress, LessonStatus,
    ChildBadge, ChildRank,
)


async def child_summary(db: AsyncSession, child_id: int) -> dict:
    child = await db.get(ChildProfile, child_id)
    if not child:
        return {}

    # Last 7 days activity
    seven_days_ago = date.today() - timedelta(days=7)
    logs_q = await db.execute(
        select(ChildActivityLog)
        .where(
            ChildActivityLog.child_id == child_id,
            ChildActivityLog.date >= seven_days_ago,
        )
        .order_by(ChildActivityLog.date)
    )
    logs = logs_q.scalars().all()

    # Total lessons completed
    lessons_count = await db.scalar(
        select(func.count(ChildLessonProgress.id)).where(
            ChildLessonProgress.child_id == child_id,
            ChildLessonProgress.status == LessonStatus.completed,
        )
    )

    # Badges
    badges_count = await db.scalar(
        select(func.count(ChildBadge.id)).where(ChildBadge.child_id == child_id)
    )

    # Rank
    rank_q = await db.execute(
        select(ChildRank).where(ChildRank.child_id == child_id)
    )
    rank = rank_q.scalar_one_or_none()

    return {
        "child_id": child_id,
        "display_name": child.display_name,
        "avatar": child.avatar,
        "age": child.age,
        "lessons_completed": lessons_count or 0,
        "badges_earned": badges_count or 0,
        "xp_total": rank.xp_total if rank else 0,
        "activity_7days": [
            {
                "date": log.date.isoformat(),
                "minutes": log.total_seconds // 60,
                "lessons": log.lessons_completed,
                "puzzles": log.puzzles_solved,
                "games": log.games_played,
            }
            for log in logs
        ],
    }
```

- [ ] **Step 4.2: `routers/parent.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, UserRole, ChildProfile, ParentTimeLimit
from chess_api.services.parent_dashboard import child_summary
from pydantic import BaseModel


class TimeLimitRequest(BaseModel):
    daily_minutes: int


router = APIRouter(prefix="/parent", tags=["parent"])


def _ensure_parent(user: User):
    if user.role != UserRole.parent:
        raise HTTPException(403, "Parents only")


@router.get("/children")
async def list_children(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    result = await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == current.id)
    )
    return [
        {"id": c.id, "display_name": c.display_name, "age": c.age, "avatar": c.avatar}
        for c in result.scalars().all()
    ]


@router.get("/children/{child_id}/summary")
async def get_child_summary(
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    child = await db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != current.id:
        raise HTTPException(403)
    return await child_summary(db, child_id)


@router.post("/children/{child_id}/time-limit")
async def set_time_limit(
    child_id: int,
    payload: TimeLimitRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    child = await db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != current.id:
        raise HTTPException(403)
    existing = await db.execute(
        select(ParentTimeLimit).where(ParentTimeLimit.child_id == child_id)
    )
    limit = existing.scalar_one_or_none()
    if limit:
        limit.daily_minutes_limit = payload.daily_minutes
    else:
        limit = ParentTimeLimit(
            child_id=child_id, daily_minutes_limit=payload.daily_minutes,
        )
        db.add(limit)
    await db.commit()
    return {"daily_minutes": payload.daily_minutes}
```

- [ ] **Step 4.3: `main.py`'a router ekle + commit**

```python
from chess_api.routers import parent as parent_router
app.include_router(parent_router.router)
```

```bash
git commit -am "feat(parent): dashboard endpoints — list children, summary, time limit"
```

---

## Task 5: Weekly Email Job

**Files:**
- Create: `apps/api/chess_api/services/weekly_email.py`
- Create: `apps/api/chess_api/workers/__init__.py`
- Create: `apps/api/chess_api/workers/weekly_email_job.py`
- Modify: `apps/api/chess_api/main.py` (startup'ta scheduler başlat)

- [ ] **Step 5.1: `services/weekly_email.py`**

```python
from datetime import date, timedelta
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.models import User, UserRole, ChildProfile, ChildActivityLog
from chess_api.services.email import send_verification_email  # reuse FastMail setup
from fastapi_mail import FastMail, MessageSchema, MessageType
from chess_api.settings import settings

logger = logging.getLogger(__name__)


async def send_weekly_summary_for_parent(db: AsyncSession, parent: User):
    """Sends a weekly recap email to one parent."""
    children_q = await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == parent.id)
    )
    children = children_q.scalars().all()
    if not children:
        return

    seven_days_ago = date.today() - timedelta(days=7)
    summary_parts = []
    for c in children:
        logs_q = await db.execute(
            select(ChildActivityLog).where(
                ChildActivityLog.child_id == c.id,
                ChildActivityLog.date >= seven_days_ago,
            )
        )
        logs = logs_q.scalars().all()
        total_minutes = sum(l.total_seconds for l in logs) // 60
        total_lessons = sum(l.lessons_completed for l in logs)
        total_puzzles = sum(l.puzzles_solved for l in logs)
        total_games = sum(l.games_played for l in logs)

        summary_parts.append(
            f"\n📊 {c.display_name}:\n"
            f"   - Toplam süre: {total_minutes} dakika\n"
            f"   - Tamamlanan ders: {total_lessons}\n"
            f"   - Çözülen problem: {total_puzzles}\n"
            f"   - Oynanan oyun: {total_games}\n"
        )

    body = (
        f"Merhaba {parent.name},\n\n"
        f"Çocuğunuz(larınız)ın bu haftaki satranç ilerlemesi:\n"
        f"{''.join(summary_parts)}\n"
        f"Daha fazla bilgi için panele giriş yapın."
    )

    if settings().ENV == "development":
        logger.info("DEV weekly summary for %s:\n%s", parent.email, body)
        return

    from chess_api.services.email import _config
    fm = FastMail(_config())
    msg = MessageSchema(
        subject="Haftalık Özet — Çocuklar İçin Satranç",
        recipients=[parent.email],
        body=body, subtype=MessageType.plain,
    )
    await fm.send_message(msg)
```

- [ ] **Step 5.2: `workers/weekly_email_job.py`**

```python
"""Run weekly summary email blast every Sunday 21:00 UTC.

Uses APScheduler in the same process as FastAPI.
"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.models import User, UserRole
from chess_api.services.weekly_email import send_weekly_summary_for_parent

logger = logging.getLogger(__name__)


async def run_weekly_blast():
    logger.info("Starting weekly summary blast")
    session_factory = get_session_factory()
    async with session_factory() as db:
        result = await db.execute(
            select(User).where(User.role == UserRole.parent, User.email_verified.is_(True))
        )
        parents = result.scalars().all()
        for parent in parents:
            try:
                await send_weekly_summary_for_parent(db, parent)
            except Exception:
                logger.exception("Failed to send to %s", parent.email)


_scheduler: AsyncIOScheduler | None = None


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        run_weekly_blast,
        "cron",
        day_of_week="sun", hour=21, minute=0,
    )
    _scheduler.start()
    logger.info("Weekly email scheduler started")
```

`requirements.txt`'e:
```
apscheduler==3.10.4
```

- [ ] **Step 5.3: `main.py`'da startup'ta scheduler başlat**

```python
@app.on_event("startup")
async def on_startup():
    from chess_api.workers.weekly_email_job import start_scheduler
    start_scheduler()
```

- [ ] **Step 5.4: Manuel test + commit**

```bash
# Lokal test: scheduler 1 dakika sonra çalışsın
# Veya: python -c "from chess_api.workers.weekly_email_job import run_weekly_blast; import asyncio; asyncio.run(run_weekly_blast())"
git commit -am "feat(parent): weekly email summary with APScheduler"
```

---

## Task 6: Parent Dashboard Frontend

**Files:**
- Create: `apps/web/components/ChildSummaryCard.tsx`
- Create: `apps/web/components/WeeklyActivityChart.tsx`
- Create: `apps/web/components/TimeLimitDialog.tsx`
- Create: `apps/web/app/(parent)/dashboard/page.tsx`
- Create: `apps/web/app/(parent)/child/[id]/page.tsx`
- Install: `recharts`

- [ ] **Step 6.1: Bağımlılıkları kur**

```bash
cd apps/web
npm install recharts
```

- [ ] **Step 6.2: `components/ChildSummaryCard.tsx`**

```tsx
import Link from 'next/link';

interface Props {
  childId: number;
  displayName: string;
  avatar: string;
  age: number;
  lessonsCompleted: number;
  badgesEarned: number;
}

export function ChildSummaryCard({
  childId, displayName, avatar, age, lessonsCompleted, badgesEarned,
}: Props) {
  return (
    <Link href={`/child/${childId}`} className="block p-6 bg-white rounded-2xl shadow hover:shadow-lg transition">
      <div className="flex items-center gap-4">
        <img src={`/avatars/${avatar}.png`} alt={displayName} className="w-16 h-16 rounded-full" />
        <div>
          <h3 className="text-xl font-bold">{displayName}</h3>
          <p className="text-sm opacity-75">{age} yaşında</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <p className="text-2xl font-bold">{lessonsCompleted}</p>
          <p className="text-xs opacity-75">Ders</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{badgesEarned}</p>
          <p className="text-xs opacity-75">Rozet</p>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 6.3: `components/WeeklyActivityChart.tsx`**

```tsx
'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DayData { date: string; minutes: number; lessons: number; puzzles: number; }

export function WeeklyActivityChart({ data }: { data: DayData[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="minutes" stroke="#3b82f6" name="Dakika" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 6.4: `app/(parent)/dashboard/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChildSummaryCard } from '@/components/ChildSummaryCard';

interface Child {
  id: number; display_name: string; age: number; avatar: string;
  lessons_completed?: number; badges_earned?: number;
}

export default function ParentDashboardPage() {
  const [children, setChildren] = useState<Child[]>([]);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('chess_app_token');
      const res = await fetch('/api/backend/parent/children', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list: Child[] = await res.json();
      // Fetch summary for each
      const enriched = await Promise.all(list.map(async (c) => {
        const sumRes = await fetch(`/api/backend/parent/children/${c.id}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sum = await sumRes.json();
        return { ...c, lessons_completed: sum.lessons_completed, badges_earned: sum.badges_earned };
      }));
      setChildren(enriched);
    })();
  }, []);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between mb-8">
        <h1 className="text-3xl font-bold">Çocuklarım</h1>
        <Link href="/add-child" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
          + Çocuk Ekle
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map(c => (
          <ChildSummaryCard key={c.id} {...c}
            childId={c.id} displayName={c.display_name}
            lessonsCompleted={c.lessons_completed || 0}
            badgesEarned={c.badges_earned || 0} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 6.5: `app/(parent)/child/[id]/page.tsx`**

Tek çocuk detayı: WeeklyActivityChart + TimeLimitDialog + son rozetler.

(Implementation: detaylı sayfa, weekly chart, time limit slider, recent badges grid.)

- [ ] **Step 6.6: Commit**

```bash
git commit -am "feat(parent): dashboard + child detail pages with charts"
```

---

## Task 7: Survey System

**Files:**
- Create: `apps/api/chess_api/routers/parent.py` (survey endpoint'leri eklenir)
- Create: `apps/web/components/SurveyForm.tsx`
- Create: `apps/web/app/(parent)/survey/[id]/page.tsx`

- [ ] **Step 7.1: Backend endpoint'leri**

```python
# Parent router'a ekle:

@router.get("/surveys")
async def list_pending_surveys(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    # Surveys for parent's children's classes
    # ... implementation
    return []


@router.post("/surveys/{survey_id}/respond")
async def respond_survey(
    survey_id: int,
    payload: dict,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    response = ParentSurveyResponse(
        survey_id=survey_id,
        parent_user_id=current.id,
        answers_json=payload,
    )
    db.add(response)
    await db.commit()
    return {"submitted": True}
```

- [ ] **Step 7.2: Frontend SurveyForm + page**

Standart form: questions_json'dan render, cevapları submit.

- [ ] **Step 7.3: Commit**

```bash
git commit -am "feat(parent): survey list + response endpoints + UI"
```

---

## ACCEPTANCE TESTS — Plan 7 Test Geçidi

### Backend Birim Testler
- [ ] Activity logging: lesson/puzzle/game tamamlamada log artıyor
- [ ] Time limit: limit aşılınca 429 dönüyor
- [ ] Parent dashboard: aggregate response doğru sayıları döner

### Manuel
- [ ] Veli `/dashboard` açar, çocuklarını grid'de görür
- [ ] Bir çocuğa tıklayınca detay açılır, son 7 gün grafiği görünür
- [ ] Time limit slider'ı: 30 dakika set et, çocuk 30 dk dolunca uygulama "Süren doldu" der
- [ ] Lokal dev'de scheduler test → terminal'de "weekly summary for X" log çıkar
- [ ] Survey: bir anket vardı varsayalım, veli açar, cevaplar, submit → DB'ye yazılır

### E2E
- [ ] Veli kayıt → çocuk ekleme → çocuk olarak gir → 1 ders tamamla → çıkış → veli paneli → ilerlemenin göründüğü görülür

**Tümü ✅ ise Plan 8'e geç.**

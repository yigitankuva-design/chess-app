# Plan 4: Puzzle Sistemi + SRS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lichess Puzzle DB'sini içe aktar (~80K problem), çocuk seviyesine uygun puzzle servisi, PuzzleSolver UI, ve SM-2 tabanlı SRS algoritması ile aralıklı tekrar sistemi.

**Architecture:** Offline import script + Puzzle/PuzzleTheme modelleri. Backend `/puzzles/random` endpoint'i Glicko-benzeri rating eşleşmesiyle problem seçer. SM-2 algoritması doğru/yanlışa göre `due_at`'i günceller. Frontend `<PuzzleSolver />` çoklu hamle dizilerini destekler.

**Tech Stack:** pandas (puzzle CSV import), python-chess (validation), SM-2 algoritma (custom).

**Bağımlılık:** Plan 3 tüm Acceptance Tests yeşil.
**Süre tahmini:** 2 hafta

---

## File Structure

```
apps/api/chess_api/
├── models/
│   └── puzzle.py             # Puzzle, PuzzleTheme, ChildPuzzleAttempt, SRSCard
├── schemas/
│   └── puzzle.py
├── routers/
│   ├── puzzles.py            # GET /puzzles/random, POST /puzzles/{id}/attempt
│   └── srs.py                # GET /srs/due, POST /srs/{id}/review
├── services/
│   ├── srs.py                # SM-2 algorithm
│   └── puzzle_selection.py   # Rating-based filtering
└── scripts/
    └── import_puzzles.py     # One-time Lichess CSV import

apps/web/
├── components/
│   ├── PuzzleSolver.tsx
│   └── SRSReview.tsx
└── app/(child)/
    ├── puzzle/page.tsx
    └── srs/page.tsx
```

---

## Task 1: Puzzle + SRS Models

**Files:**
- Create: `apps/api/chess_api/models/puzzle.py`
- Modify: `apps/api/chess_api/models/__init__.py`

- [ ] **Step 1.1: `models/puzzle.py`**

```python
import enum
from datetime import datetime
from sqlalchemy import (
    String, Integer, Boolean, Float, JSON, ForeignKey, DateTime, Index, Table,
    Column, Enum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from chess_api.database import Base


class SRSItemType(str, enum.Enum):
    lesson_step = "lesson_step"
    puzzle = "puzzle"


puzzle_themes_table = Table(
    "puzzle_themes_assoc", Base.metadata,
    Column("puzzle_id", ForeignKey("puzzles.id"), primary_key=True),
    Column("theme_id", ForeignKey("puzzle_themes.id"), primary_key=True),
)


class Puzzle(Base):
    __tablename__ = "puzzles"
    id: Mapped[int] = mapped_column(primary_key=True)
    lichess_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    fen: Mapped[str] = mapped_column(String(120))
    moves_json: Mapped[list] = mapped_column(JSON)  # ["e2e4", "e7e5", ...]
    rating: Mapped[int] = mapped_column(Integer, index=True)
    popularity: Mapped[int] = mapped_column(Integer, default=0)
    module_id: Mapped[int | None] = mapped_column(
        ForeignKey("modules.id"), nullable=True, index=True
    )

    themes: Mapped[list["PuzzleTheme"]] = relationship(
        secondary=puzzle_themes_table, backref="puzzles"
    )

    __table_args__ = (
        Index("ix_puzzles_module_rating", "module_id", "rating"),
    )


class PuzzleTheme(Base):
    __tablename__ = "puzzle_themes"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name_tr: Mapped[str] = mapped_column(String(80))
    description_tr: Mapped[str | None] = mapped_column(String(255), nullable=True)


class ChildPuzzleAttempt(Base):
    __tablename__ = "child_puzzle_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    puzzle_id: Mapped[int] = mapped_column(ForeignKey("puzzles.id"), index=True)
    success: Mapped[bool] = mapped_column(Boolean)
    time_seconds: Mapped[int] = mapped_column(Integer)
    attempted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SRSCard(Base):
    __tablename__ = "srs_cards"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    item_type: Mapped[SRSItemType] = mapped_column(Enum(SRSItemType))
    item_id: Mapped[int] = mapped_column(Integer)  # lesson_step.id veya puzzle.id
    due_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    interval_days: Mapped[float] = mapped_column(Float, default=0.0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    reps_count: Mapped[int] = mapped_column(Integer, default=0)
    last_result: Mapped[str | None] = mapped_column(String(10), nullable=True)
```

- [ ] **Step 1.2: Migration**

```bash
alembic revision --autogenerate -m "create puzzle and srs tables"
alembic upgrade head
```

- [ ] **Step 1.3: Commit**

```bash
git commit -am "feat(puzzle): Puzzle, PuzzleTheme, ChildPuzzleAttempt, SRSCard models"
```

---

## Task 2: Lichess Puzzle CSV İmport Script

**Files:**
- Create: `apps/api/scripts/import_puzzles.py`
- Create: `apps/api/scripts/puzzle-themes-tr.json`

- [ ] **Step 2.1: Lichess puzzle DB indir (manuel)**

```bash
# Lichess'in puzzle DB endpoint'i (CC0)
curl -L https://database.lichess.org/lichess_db_puzzle.csv.zst -o /tmp/puzzles.csv.zst
zstd -d /tmp/puzzles.csv.zst -o /tmp/puzzles.csv
```

(Not: dosya ~1GB. Geliştirme için ilk 100K satırı al: `head -100000 /tmp/puzzles.csv > /tmp/puzzles-sample.csv`)

- [ ] **Step 2.2: `puzzle-themes-tr.json`**

```json
{
  "fork": {"name_tr": "Çatal", "description_tr": "Bir taş aynı anda iki düşman taşı tehdit eder"},
  "pin": {"name_tr": "Çivi", "description_tr": "Bir taşı hareket edemez hale getirme"},
  "skewer": {"name_tr": "Şiş", "description_tr": "İki taşı arka arkaya tehdit etme"},
  "discoveredAttack": {"name_tr": "Açma saldırısı", "description_tr": "Bir taş çekildiğinde arkasındaki başka bir taş saldırır"},
  "doubleCheck": {"name_tr": "Çiftli şah", "description_tr": "Bir hamle ile iki şah çekme"},
  "mateIn1": {"name_tr": "Tek hamlede mat", "description_tr": ""},
  "mateIn2": {"name_tr": "İki hamlede mat", "description_tr": ""},
  "mateIn3": {"name_tr": "Üç hamlede mat", "description_tr": ""},
  "backRankMate": {"name_tr": "Son sıra matı", "description_tr": ""},
  "smotheredMate": {"name_tr": "Boğma matı", "description_tr": ""},
  "hangingPiece": {"name_tr": "Asılı taş", "description_tr": "Korunmasız taş"},
  "sacrifice": {"name_tr": "Fedakarlık", "description_tr": "Taş vererek avantaj kazanma"},
  "defensiveMove": {"name_tr": "Savunma hamlesi", "description_tr": ""},
  "kingsideAttack": {"name_tr": "Şah kanadı hücumu", "description_tr": ""},
  "queensideAttack": {"name_tr": "Vezir kanadı hücumu", "description_tr": ""},
  "attraction": {"name_tr": "Çekme", "description_tr": "Düşman taşı kötü kareye çekme"},
  "interference": {"name_tr": "Engelleme", "description_tr": ""},
  "xRayAttack": {"name_tr": "X-ışını saldırısı", "description_tr": ""},
  "capturingDefender": {"name_tr": "Savunucuyu alma", "description_tr": ""},
  "kingMove": {"name_tr": "Şah hamlesi", "description_tr": ""}
}
```

- [ ] **Step 2.3: `scripts/import_puzzles.py`**

```python
"""Import Lichess CSV puzzles into our DB.

Usage:
  python -m scripts.import_puzzles /path/to/puzzles.csv [--limit 100000]

Filters: rating 400-1400 (8-12 yaş bandı), popularity > 70.
Maps themes to TR. Maps to module via theme-to-module table.
"""
import asyncio
import csv
import json
import sys
from pathlib import Path
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.models import Puzzle, PuzzleTheme, Module


# Theme → Module mapping (from spec section 7)
THEME_TO_MODULE = {
    "fork": 3, "attacking": 3, "attraction": 3, "defensiveMove": 3,
    "capturingDefender": 4, "hangingPiece": 4, "xRayAttack": 4,
    "kingsideAttack": 5, "queensideAttack": 5, "sacrifice": 5,
    "check": 6, "doubleCheck": 6,
    "discoveredAttack": 7,
    "interference": 8, "blocking": 8, "kingMove": 8,
    "mateIn1": 9, "mateIn2": 9, "mateIn3": 9,
    "backRankMate": 9, "smotheredMate": 9,
    "pin": 3, "skewer": 3,
}


async def import_csv(csv_path: str, limit: int = 100_000):
    themes_tr = json.loads(
        (Path(__file__).parent / "puzzle-themes-tr.json").read_text(encoding="utf-8")
    )

    session_factory = get_session_factory()
    async with session_factory() as db:
        # 1. Ensure themes exist
        theme_cache: dict[str, PuzzleTheme] = {}
        for slug, info in themes_tr.items():
            existing = await db.execute(
                select(PuzzleTheme).where(PuzzleTheme.slug == slug)
            )
            theme = existing.scalar_one_or_none()
            if not theme:
                theme = PuzzleTheme(
                    slug=slug, name_tr=info["name_tr"],
                    description_tr=info.get("description_tr") or None,
                )
                db.add(theme)
            theme_cache[slug] = theme
        await db.commit()

        # 2. Process CSV
        inserted = 0
        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            batch = []
            for row in reader:
                rating = int(row.get("Rating", 0))
                popularity = int(row.get("Popularity", 0))
                if rating < 400 or rating > 1400:
                    continue
                if popularity < 70:
                    continue

                themes_in_row = (row.get("Themes") or "").split()
                relevant_themes = [t for t in themes_in_row if t in theme_cache]
                if not relevant_themes:
                    continue

                # Map to first matching module
                module_id = next(
                    (THEME_TO_MODULE[t] for t in relevant_themes if t in THEME_TO_MODULE),
                    None,
                )

                puzzle = Puzzle(
                    lichess_id=row["PuzzleId"],
                    fen=row["FEN"],
                    moves_json=row["Moves"].split(),
                    rating=rating,
                    popularity=popularity,
                    module_id=module_id,
                )
                # Attach themes
                for slug in relevant_themes:
                    puzzle.themes.append(theme_cache[slug])
                batch.append(puzzle)

                if len(batch) >= 1000:
                    db.add_all(batch)
                    await db.commit()
                    inserted += len(batch)
                    batch = []
                    print(f"  Inserted {inserted}...")

                if inserted >= limit:
                    break

            if batch:
                db.add_all(batch)
                await db.commit()
                inserted += len(batch)

        print(f"Total inserted: {inserted}")


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/puzzles.csv"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 100_000
    asyncio.run(import_csv(csv_path, limit))
```

- [ ] **Step 2.4: Lokal çalıştır (örnek 10K)**

```bash
cd apps/api
python -m scripts.import_puzzles /tmp/puzzles-sample.csv 10000
```

Beklenen: "Total inserted: ~5000-10000" (filtreler nedeniyle hepsi geçmez).

- [ ] **Step 2.5: Commit**

```bash
git add apps/api/scripts/import_puzzles.py apps/api/scripts/puzzle-themes-tr.json
git commit -m "feat(puzzle): Lichess CSV import script + TR theme mapping"
```

---

## Task 3: Puzzle Endpoints

**Files:**
- Create: `apps/api/chess_api/schemas/puzzle.py`
- Create: `apps/api/chess_api/services/puzzle_selection.py`
- Create: `apps/api/chess_api/routers/puzzles.py`
- Create: `apps/api/tests/test_puzzles.py`

- [ ] **Step 3.1: `schemas/puzzle.py`**

```python
from pydantic import BaseModel


class PuzzleResponse(BaseModel):
    id: int
    fen: str
    moves: list[str]
    rating: int
    themes: list[str]  # TR names


class PuzzleAttemptRequest(BaseModel):
    success: bool
    time_seconds: int
    moves_attempted: list[str]


class PuzzleAttemptResponse(BaseModel):
    accepted: bool
    new_rating_estimate: int | None
```

- [ ] **Step 3.2: `services/puzzle_selection.py`**

```python
import random
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import Puzzle, ChildPuzzleAttempt


async def select_puzzle_for_child(
    db: AsyncSession,
    child_id: int,
    child_rating: int = 800,
    module_id: int | None = None,
    theme_slug: str | None = None,
) -> Puzzle | None:
    """Pick a puzzle within ±150 of child rating, avoiding recent."""
    rating_low = max(400, child_rating - 150)
    rating_high = min(1400, child_rating + 150)

    # Recent puzzle IDs (last 50 attempts)
    recent_q = (
        select(ChildPuzzleAttempt.puzzle_id)
        .where(ChildPuzzleAttempt.child_id == child_id)
        .order_by(ChildPuzzleAttempt.attempted_at.desc())
        .limit(50)
    )
    recent_ids = (await db.execute(recent_q)).scalars().all()

    filters = [
        Puzzle.rating >= rating_low,
        Puzzle.rating <= rating_high,
    ]
    if module_id:
        filters.append(Puzzle.module_id == module_id)
    if recent_ids:
        filters.append(Puzzle.id.notin_(recent_ids))

    q = select(Puzzle).where(and_(*filters)).order_by(Puzzle.popularity.desc()).limit(30)
    candidates = (await db.execute(q)).scalars().all()
    return random.choice(candidates) if candidates else None
```

- [ ] **Step 3.3: `routers/puzzles.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, Puzzle, ChildPuzzleAttempt
from chess_api.schemas.puzzle import (
    PuzzleResponse, PuzzleAttemptRequest, PuzzleAttemptResponse,
)
from chess_api.services.puzzle_selection import select_puzzle_for_child

router = APIRouter(prefix="/puzzles", tags=["puzzles"])


@router.get("/random", response_model=PuzzleResponse)
async def random_puzzle(
    module_id: int | None = None,
    theme: str | None = None,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    child_id = current.id  # assume child token
    puzzle = await select_puzzle_for_child(db, child_id, module_id=module_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No suitable puzzle found")
    return PuzzleResponse(
        id=puzzle.id, fen=puzzle.fen, moves=puzzle.moves_json,
        rating=puzzle.rating,
        themes=[t.name_tr for t in puzzle.themes],
    )


@router.post("/{puzzle_id}/attempt", response_model=PuzzleAttemptResponse)
async def record_attempt(
    puzzle_id: int,
    payload: PuzzleAttemptRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    puzzle = await db.get(Puzzle, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404)
    attempt = ChildPuzzleAttempt(
        child_id=current.id, puzzle_id=puzzle_id,
        success=payload.success, time_seconds=payload.time_seconds,
    )
    db.add(attempt)
    await db.commit()
    return PuzzleAttemptResponse(accepted=True, new_rating_estimate=None)
```

- [ ] **Step 3.4: Test + commit**

`tests/test_puzzles.py` ile birim test yaz, çalıştır, commit.

```bash
pytest tests/test_puzzles.py -v
git commit -am "feat(puzzle): /puzzles/random + attempt endpoints"
```

---

## Task 4: SRS Algorithm + Endpoints

**Files:**
- Create: `apps/api/chess_api/services/srs.py`
- Create: `apps/api/chess_api/routers/srs.py`
- Create: `apps/api/tests/test_srs.py`

- [ ] **Step 4.1: TDD — `tests/test_srs.py`**

```python
from chess_api.services.srs import update_card, SRSResult

def test_first_correct_review_sets_1_day():
    new_state = update_card(
        interval_days=0, ease_factor=2.5, reps_count=0,
        result=SRSResult.correct,
    )
    assert new_state["interval_days"] == 1.0
    assert new_state["reps_count"] == 1


def test_second_correct_advances_to_3_days():
    new_state = update_card(
        interval_days=1.0, ease_factor=2.5, reps_count=1,
        result=SRSResult.correct,
    )
    assert new_state["interval_days"] == 3.0


def test_correct_after_third_uses_ease_factor():
    new_state = update_card(
        interval_days=7.0, ease_factor=2.5, reps_count=3,
        result=SRSResult.correct,
    )
    assert new_state["interval_days"] == pytest.approx(7.0 * 2.5)


def test_wrong_resets_interval():
    new_state = update_card(
        interval_days=14.0, ease_factor=2.5, reps_count=5,
        result=SRSResult.wrong,
    )
    assert new_state["interval_days"] == 0.0
    assert new_state["reps_count"] == 0
```

- [ ] **Step 4.2: `services/srs.py` — SM-2 varyantı**

```python
"""Simplified SM-2 spaced repetition algorithm.

Reps: 0  → next: 1 day
Reps: 1  → next: 3 days
Reps: 2  → next: 7 days
Reps: 3+ → next: prev_interval * ease_factor (default 2.5)

Wrong answer: reset to 0 reps, interval 0 (re-show within session).
"""
import enum
from datetime import datetime, timedelta


class SRSResult(str, enum.Enum):
    correct = "correct"
    wrong = "wrong"


def update_card(
    interval_days: float,
    ease_factor: float,
    reps_count: int,
    result: SRSResult,
) -> dict:
    if result == SRSResult.wrong:
        return {
            "interval_days": 0.0,
            "ease_factor": max(1.3, ease_factor - 0.2),
            "reps_count": 0,
            "due_at": datetime.utcnow() + timedelta(hours=1),
            "last_result": "wrong",
        }

    # Correct
    new_reps = reps_count + 1
    if new_reps == 1:
        new_interval = 1.0
    elif new_reps == 2:
        new_interval = 3.0
    elif new_reps == 3:
        new_interval = 7.0
    else:
        new_interval = interval_days * ease_factor

    return {
        "interval_days": new_interval,
        "ease_factor": ease_factor,
        "reps_count": new_reps,
        "due_at": datetime.utcnow() + timedelta(days=new_interval),
        "last_result": "correct",
    }
```

- [ ] **Step 4.3: `routers/srs.py`**

```python
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, SRSCard
from chess_api.services.srs import update_card, SRSResult
from pydantic import BaseModel


class SRSCardResponse(BaseModel):
    id: int
    item_type: str
    item_id: int
    due_at: datetime


class ReviewRequest(BaseModel):
    result: SRSResult


router = APIRouter(prefix="/srs", tags=["srs"])


@router.get("/due", response_model=list[SRSCardResponse])
async def due_cards(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(SRSCard).where(
        SRSCard.child_id == current.id,
        SRSCard.due_at <= datetime.utcnow(),
    ).limit(20)
    cards = (await db.execute(q)).scalars().all()
    return [
        SRSCardResponse(id=c.id, item_type=c.item_type.value,
                        item_id=c.item_id, due_at=c.due_at)
        for c in cards
    ]


@router.post("/{card_id}/review")
async def review_card(
    card_id: int,
    payload: ReviewRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await db.get(SRSCard, card_id)
    if not card or card.child_id != current.id:
        return {"updated": False}
    updates = update_card(
        card.interval_days, card.ease_factor, card.reps_count, payload.result,
    )
    for k, v in updates.items():
        setattr(card, k, v)
    await db.commit()
    return {"updated": True, "next_due_at": card.due_at.isoformat()}
```

- [ ] **Step 4.4: Test çalıştır, commit**

```bash
pytest tests/test_srs.py -v
git commit -am "feat(srs): SM-2 algorithm + /srs/due, /srs/{id}/review"
```

---

## Task 5: PuzzleSolver Component

**Files:**
- Create: `apps/web/components/PuzzleSolver.tsx`
- Create: `apps/web/app/(child)/puzzle/page.tsx`

- [ ] **Step 5.1: `components/PuzzleSolver.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { motion, AnimatePresence } from 'framer-motion';
import type { Square } from 'chess.js';

interface Props {
  puzzleId: number;
  fen: string;
  solutionMoves: string[];  // ["e2e4","e7e5",...]
  themes: string[];
  onComplete: (success: boolean) => void;
}

export function PuzzleSolver({ puzzleId, fen, solutionMoves, themes, onComplete }: Props) {
  const [chess] = useState(() => new Chess(fen));
  const [moveIndex, setMoveIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [currentFen, setCurrentFen] = useState(fen);

  function handleDrop(from: Square, to: Square): boolean {
    const expected = solutionMoves[moveIndex];
    const userMove = `${from}${to}`;

    if (userMove === expected || userMove.startsWith(expected.slice(0, 4))) {
      const move = chess.move({ from, to, promotion: 'q' });
      if (!move) return false;
      setCurrentFen(chess.fen());
      const nextIdx = moveIndex + 1;

      if (nextIdx >= solutionMoves.length) {
        setFeedback('correct');
        recordAttempt(true);
        onComplete(true);
        return true;
      }

      // Play opponent's reply
      setTimeout(() => {
        const reply = solutionMoves[nextIdx];
        chess.move({ from: reply.slice(0, 2) as Square, to: reply.slice(2, 4) as Square, promotion: 'q' });
        setCurrentFen(chess.fen());
        setMoveIndex(nextIdx + 1);
      }, 500);
      return true;
    } else {
      setFeedback('wrong');
      return false;
    }
  }

  async function recordAttempt(success: boolean) {
    await fetch(`/api/backend/puzzles/${puzzleId}/attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('chess_app_token')}`,
      },
      body: JSON.stringify({
        success, time_seconds: 30, moves_attempted: [],
      }),
    });
  }

  function retry() {
    chess.load(fen);
    setCurrentFen(fen);
    setMoveIndex(0);
    setFeedback(null);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4">
      <div className="flex gap-2 flex-wrap">
        {themes.map(t => (
          <span key={t} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{t}</span>
        ))}
      </div>
      <p className="text-lg opacity-75">Beyaz oynar, en iyi hamleyi bul!</p>
      <ChessBoard fen={currentFen} interactive={!feedback} onPieceDrop={handleDrop} />
      <AnimatePresence>
        {feedback === 'correct' && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
            className="p-4 bg-green-100 border border-green-400 rounded-lg text-green-800">
            ✓ Süper! Çözdün!
          </motion.div>
        )}
        {feedback === 'wrong' && (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
            className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-800">
            Yanlış, tekrar dene
            <button onClick={retry} className="ml-4 underline">Sıfırla</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 5.2: `app/(child)/puzzle/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { PuzzleSolver } from '@/components/PuzzleSolver';

interface Puzzle {
  id: number; fen: string; moves: string[]; rating: number; themes: string[];
}

export default function PuzzlePage() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPuzzle() {
    setLoading(true);
    const res = await fetch('/api/backend/puzzles/random', {
      headers: { Authorization: `Bearer ${localStorage.getItem('chess_app_token')}` },
    });
    const data = await res.json();
    setPuzzle(data);
    setLoading(false);
  }

  useEffect(() => { loadPuzzle(); }, []);

  if (loading || !puzzle) return <div className="p-8">Yükleniyor...</div>;

  return (
    <PuzzleSolver
      key={puzzle.id}
      puzzleId={puzzle.id}
      fen={puzzle.fen}
      solutionMoves={puzzle.moves}
      themes={puzzle.themes}
      onComplete={() => setTimeout(loadPuzzle, 2000)}
    />
  );
}
```

- [ ] **Step 5.3: Commit**

```bash
git commit -am "feat(web): PuzzleSolver + /puzzle page"
```

---

## Task 6: SRS Review UI

**Files:**
- Create: `apps/web/app/(child)/srs/page.tsx`

- [ ] **Step 6.1: `app/(child)/srs/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { PuzzleSolver } from '@/components/PuzzleSolver';

interface SRSCard {
  id: number; item_type: string; item_id: number; due_at: string;
}

export default function SRSPage() {
  const [cards, setCards] = useState<SRSCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch('/api/backend/srs/due', {
      headers: { Authorization: `Bearer ${localStorage.getItem('chess_app_token')}` },
    })
      .then(r => r.json())
      .then(setCards);
  }, []);

  async function review(result: 'correct' | 'wrong') {
    const card = cards[currentIndex];
    await fetch(`/api/backend/srs/${card.id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('chess_app_token')}`,
      },
      body: JSON.stringify({ result }),
    });
    if (currentIndex + 1 >= cards.length) setDone(true);
    else setCurrentIndex(currentIndex + 1);
  }

  if (done) return <div className="p-8 text-center text-2xl">🎉 Bugünlük tekrar bitti!</div>;
  if (cards.length === 0) return <div className="p-8">Bugün tekrar edilecek bir şey yok.</div>;

  // For puzzle items, render PuzzleSolver; for lesson_step, render mini-quiz
  // (Full implementation: fetch the item via /puzzles/{id} or /lessons/.../step/{id})
  return (
    <div className="p-4">
      <p>{currentIndex + 1}/{cards.length}</p>
      {/* Render appropriate component based on card.item_type */}
      <PuzzleSolver
        puzzleId={cards[currentIndex].item_id}
        fen=""  /* Fetch real */
        solutionMoves={[]}
        themes={[]}
        onComplete={(success) => review(success ? 'correct' : 'wrong')}
      />
    </div>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git commit -am "feat(web): /srs daily review page"
```

---

## ACCEPTANCE TESTS — Plan 4 Test Geçidi

### Backend Birim Testleri
- [ ] `pytest tests/test_puzzles.py -v` → 3+ passed
- [ ] `pytest tests/test_srs.py -v` → 4+ passed

### Manuel Doğrulama
- [ ] Lichess CSV import çalıştı, DB'de ~10K+ puzzle var
- [ ] `/puzzles/random?module_id=3` çatal temalı puzzle döner
- [ ] PuzzleSolver UI'da puzzle çözülebilir, doğru hamlede yeşil feedback
- [ ] Yanlış hamlede "tekrar dene"
- [ ] Puzzle bitince yeni puzzle yüklenir (2 sn sonra)
- [ ] `/srs/due` sıfır kart döner (henüz hiç ders tamamlanmadı)
- [ ] Ders bittikten sonra SRSCard eklenir, ertesi gün due

### E2E
- [ ] E2E: Çocuk modül 3'e girer, puzzle çözer → puzzle attempt DB'de kayıtlı

### Performans
- [ ] `/puzzles/random` < 100ms (index'ler doğru)

**Tümü ✅ ise Plan 5'e geç.**

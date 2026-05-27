# Plan 3: Müfredat + Lesson Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Çocuğun bir dersi başından sonuna kadar oynayabildiği MVP'nin kalbi. 9 modülün veri yapısı + tek bir dersin tam çalışan player'ı + Modül 1'in (Taşlar) tüm 9 dersi gerçek içerikle.

**Architecture:** Backend: Module/Lesson/LessonStep modelleri + seed script. Frontend: `<ChessBoard />` (react-chessboard + chess.js), `<LessonPlayer />` step-by-step state machine. Inline alıştırmalar (Zafer Bey B seçimi) tahtada interaktif. Yanlış cevap = "tekrar dene" (A seçimi).

**Tech Stack:** SQLAlchemy ORM, react-chessboard, chess.js, Framer Motion, Zustand (player state).

**Bağımlılık:** Plan 2 (Auth) tüm Acceptance Tests yeşil.
**Süre tahmini:** 3 hafta
**Test geçidi:** Plan sonundaki Acceptance Tests yeşil olmadan Plan 4'e geçilmez.

---

## File Structure

```
apps/api/chess_api/
├── models/
│   ├── module.py              # Module, Lesson, LessonStep
│   └── progress.py            # ChildLessonProgress, ChildLessonStepResult
├── schemas/
│   └── lesson.py
├── routers/
│   └── lessons.py             # GET /modules, /lessons/*
├── services/
│   └── lesson_progress.py     # Business logic for progress + validation
└── scripts/
    └── seed_curriculum.py     # Modül 1'in 9 dersini ekler

apps/web/
├── components/
│   ├── ChessBoard.tsx
│   ├── LessonPlayer.tsx
│   └── lesson-steps/
│       ├── ExplanationStep.tsx
│       └── InlineExerciseStep.tsx
├── app/(child)/
│   ├── home/page.tsx
│   └── lesson/[id]/page.tsx
├── lib/
│   ├── stores/
│   │   └── lesson-store.ts    # Zustand
│   └── chess/
│       ├── board-helpers.ts
│       └── validate-move.ts
└── public/
    └── lesson-content/        # JSON dosyaları (45 ders'in metni)
        ├── module-1-lesson-1.json
        └── ...
```

---

## Task 1: Curriculum Models + Migration

**Files:**
- Create: `apps/api/chess_api/models/module.py`
- Create: `apps/api/chess_api/models/progress.py`
- Modify: `apps/api/chess_api/models/__init__.py`

- [ ] **Step 1.1: `models/module.py`**

```python
import enum
from datetime import datetime
from sqlalchemy import String, Integer, Text, JSON, ForeignKey, Enum, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class LessonStepType(str, enum.Enum):
    explanation = "explanation"
    inline_exercise = "inline_exercise"
    quiz = "quiz"


class Module(Base):
    __tablename__ = "modules"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_index: Mapped[int] = mapped_column(Integer, unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(40), default="default")


class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=10)


class LessonStep(Base):
    __tablename__ = "lesson_steps"
    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    type: Mapped[LessonStepType] = mapped_column(Enum(LessonStepType))
    content_json: Mapped[dict] = mapped_column(JSON)
    correct_answer_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
```

- [ ] **Step 1.2: `models/progress.py`**

```python
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class LessonStatus(str, enum.Enum):
    locked = "locked"
    in_progress = "in_progress"
    completed = "completed"


class ChildLessonProgress(Base):
    __tablename__ = "child_lesson_progress"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), index=True)
    status: Mapped[LessonStatus] = mapped_column(Enum(LessonStatus), default=LessonStatus.in_progress)
    current_step_index: Mapped[int] = mapped_column(Integer, default=0)
    total_time_seconds: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ChildLessonStepResult(Base):
    __tablename__ = "child_lesson_step_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_step_id: Mapped[int] = mapped_column(ForeignKey("lesson_steps.id"), index=True)
    attempts_count: Mapped[int] = mapped_column(Integer, default=1)
    success_at_attempt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_seconds: Mapped[int] = mapped_column(Integer)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 1.3: `models/__init__.py`'a ekle**

```python
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType
from chess_api.models.progress import (
    ChildLessonProgress, ChildLessonStepResult, LessonStatus,
)

__all__ = [
    "User", "UserRole", "ChildProfile", "Device",
    "Module", "Lesson", "LessonStep", "LessonStepType",
    "ChildLessonProgress", "ChildLessonStepResult", "LessonStatus",
]
```

- [ ] **Step 1.4: Migration**

```bash
cd apps/api
alembic revision --autogenerate -m "create curriculum tables"
alembic upgrade head
```

- [ ] **Step 1.5: Commit**

```bash
git add apps/api/chess_api/models/ apps/api/alembic/versions/
git commit -m "feat(curriculum): Module, Lesson, LessonStep, progress models"
```

---

## Task 2: Seed Script — 9 Modül + Modül 1'in 9 Dersi

**Files:**
- Create: `apps/api/scripts/__init__.py`
- Create: `apps/api/scripts/seed_curriculum.py`
- Create: `apps/api/scripts/curriculum-data.json`

- [ ] **Step 2.1: `scripts/curriculum-data.json` — Modül 1 örneği**

```json
{
  "modules": [
    {
      "order": 1, "name": "Satranç taşları ve hareketleri",
      "description": "Tahtayı, taşları ve özel hareketleri öğreniyoruz.",
      "icon": "pawn"
    },
    {
      "order": 2, "name": "Taşların değerleri",
      "description": "Hangi taş daha kıymetli?", "icon": "balance"
    },
    {
      "order": 3, "name": "Tehdit",
      "description": "Karşı tarafın taşlarını tehdit etmeyi öğreniyoruz.",
      "icon": "target"
    },
    {
      "order": 4, "name": "Taş alma",
      "description": "Vuruş kuralları ve seçimi.", "icon": "capture"
    },
    {
      "order": 5, "name": "Saldırı ve savunma yöntemleri",
      "description": "Hücum ve savunma prensipleri.", "icon": "shield"
    },
    {
      "order": 6, "name": "Şah çekme",
      "description": "Rakibin şahını tehdit etmek.", "icon": "crown"
    },
    {
      "order": 7, "name": "Şah çekme türleri",
      "description": "Açma şah, çiftli şah, vs.", "icon": "double-crown"
    },
    {
      "order": 8, "name": "Şah tehdidinden korunma türleri",
      "description": "Kaç, blokla, al.", "icon": "block"
    },
    {
      "order": 9, "name": "Mat ve temel mat türleri",
      "description": "Oyunu nasıl bitiririz.", "icon": "checkmate"
    }
  ],
  "module_1_lessons": [
    {
      "order": 1, "title": "Satranç tahtası ve koordinatlar",
      "steps": [
        {
          "order": 1, "type": "explanation",
          "content": {
            "title": "Satranç tahtası nedir?",
            "body": "Satranç tahtası 8x8 = 64 kareden oluşur. Yatay sıralara 'sıra', dikey sıralara 'kolon' denir.",
            "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
            "highlight_squares": []
          }
        },
        {
          "order": 2, "type": "explanation",
          "content": {
            "title": "Karelerin isimleri",
            "body": "Kolonlar a-h harfleriyle, sıralar 1-8 sayılarıyla adlandırılır.",
            "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
            "show_coordinates": true
          }
        },
        {
          "order": 3, "type": "inline_exercise",
          "content": {
            "title": "Şimdi sen dene!",
            "body": "e4 karesini bul ve tıkla.",
            "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
            "task_type": "click_square"
          },
          "correct_answer": { "square": "e4" }
        }
      ]
    }
  ]
}
```

(Pratik notu: bu JSON dosyası Modül 1'in 9 dersinin tamamını içerecek — örnek olarak 1 ders ve 3 step gösterildi. Implementasyon sırasında tüm 9 ders detaylandırılır.)

- [ ] **Step 2.2: `scripts/seed_curriculum.py`**

```python
"""Seed all 9 modules and Module 1's 9 lessons. Idempotent.

Run with: python -m scripts.seed_curriculum
"""
import asyncio
import json
from pathlib import Path
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.models import Module, Lesson, LessonStep, LessonStepType


async def seed():
    data = json.loads(
        (Path(__file__).parent / "curriculum-data.json").read_text(encoding="utf-8")
    )
    session_factory = get_session_factory()
    async with session_factory() as db:
        # Modules
        for mod_data in data["modules"]:
            existing = await db.execute(
                select(Module).where(Module.order_index == mod_data["order"])
            )
            if existing.scalar_one_or_none():
                continue
            db.add(Module(
                order_index=mod_data["order"],
                name=mod_data["name"],
                description=mod_data["description"],
                icon=mod_data.get("icon", "default"),
            ))
        await db.commit()

        # Module 1 lessons
        m1 = await db.execute(select(Module).where(Module.order_index == 1))
        module_1 = m1.scalar_one()
        for lesson_data in data["module_1_lessons"]:
            existing = await db.execute(
                select(Lesson).where(
                    Lesson.module_id == module_1.id,
                    Lesson.order_index == lesson_data["order"],
                )
            )
            if existing.scalar_one_or_none():
                continue
            lesson = Lesson(
                module_id=module_1.id,
                order_index=lesson_data["order"],
                title=lesson_data["title"],
                estimated_minutes=lesson_data.get("estimated_minutes", 10),
            )
            db.add(lesson)
            await db.flush()
            for step_data in lesson_data["steps"]:
                db.add(LessonStep(
                    lesson_id=lesson.id,
                    order_index=step_data["order"],
                    type=LessonStepType(step_data["type"]),
                    content_json=step_data["content"],
                    correct_answer_json=step_data.get("correct_answer"),
                ))
        await db.commit()
        print("Seed completed.")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2.3: Çalıştır**

```bash
cd apps/api
python -m scripts.seed_curriculum
```

Beklenen: `Seed completed.` — DB'de 9 module + Modül 1'in 9 lesson'ı + step'leri olmalı.

- [ ] **Step 2.4: Commit**

```bash
git add apps/api/scripts/
git commit -m "feat(curriculum): seed script for 9 modules + Module 1 lessons"
```

---

## Task 3: Lesson API Endpoint'leri

**Files:**
- Create: `apps/api/chess_api/schemas/lesson.py`
- Create: `apps/api/chess_api/routers/lessons.py`
- Modify: `apps/api/chess_api/main.py`
- Create: `apps/api/tests/test_lessons.py`

- [ ] **Step 3.1: `schemas/lesson.py`**

```python
from pydantic import BaseModel
from chess_api.models.module import LessonStepType


class ModuleResponse(BaseModel):
    id: int
    order_index: int
    name: str
    description: str
    icon: str
    lessons_count: int


class LessonSummary(BaseModel):
    id: int
    order_index: int
    title: str
    estimated_minutes: int
    status: str  # "locked" | "in_progress" | "completed" | "available"


class LessonStepResponse(BaseModel):
    id: int
    order_index: int
    type: LessonStepType
    content_json: dict
    # correct_answer_json deliberately omitted — only server validates


class LessonDetailResponse(BaseModel):
    id: int
    module_id: int
    title: str
    estimated_minutes: int
    steps: list[LessonStepResponse]


class StepAnswerRequest(BaseModel):
    answer_json: dict
    time_seconds: int


class StepAnswerResponse(BaseModel):
    correct: bool
    next_step_index: int | None
    lesson_completed: bool
```

- [ ] **Step 3.2: TDD — `tests/test_lessons.py`**

```python
async def test_list_modules(client, db, seed_curriculum):
    response = await client.get("/modules")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 9
    assert data[0]["name"] == "Satranç taşları ve hareketleri"


async def test_get_lesson_detail(client, seed_curriculum):
    response = await client.get("/lessons/1")
    assert response.status_code == 200
    data = response.json()
    assert "steps" in data
    assert all("correct_answer_json" not in s for s in data["steps"])


async def test_submit_step_answer_correct(client, seed_curriculum, parent_with_child):
    parent_token, child_token, child_id = parent_with_child
    # Submit correct answer for step expecting click on "e4"
    response = await client.post(
        "/lessons/1/step/3/answer",
        headers={"Authorization": f"Bearer {child_token}"},
        json={"answer_json": {"square": "e4"}, "time_seconds": 5},
    )
    assert response.status_code == 200
    assert response.json()["correct"] is True


async def test_submit_step_answer_wrong(client, seed_curriculum, parent_with_child):
    _, child_token, _ = parent_with_child
    response = await client.post(
        "/lessons/1/step/3/answer",
        headers={"Authorization": f"Bearer {child_token}"},
        json={"answer_json": {"square": "d5"}, "time_seconds": 5},
    )
    assert response.status_code == 200
    assert response.json()["correct"] is False
```

`conftest.py`'ye seed fixture ekle (test DB'sini Modül 1 ile doldur).

- [ ] **Step 3.3: `routers/lessons.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import (
    Module, Lesson, LessonStep, ChildLessonProgress, ChildLessonStepResult,
    LessonStatus, User,
)
from chess_api.schemas.lesson import (
    ModuleResponse, LessonDetailResponse, LessonStepResponse,
    StepAnswerRequest, StepAnswerResponse,
)

router = APIRouter(tags=["lessons"])


@router.get("/modules", response_model=list[ModuleResponse])
async def list_modules(db: AsyncSession = Depends(get_db)):
    modules = (await db.execute(select(Module).order_by(Module.order_index))).scalars().all()
    result = []
    for m in modules:
        count = await db.scalar(
            select(func.count(Lesson.id)).where(Lesson.module_id == m.id)
        )
        result.append(ModuleResponse(
            id=m.id, order_index=m.order_index, name=m.name,
            description=m.description, icon=m.icon, lessons_count=count or 0,
        ))
    return result


@router.get("/lessons/{lesson_id}", response_model=LessonDetailResponse)
async def get_lesson(lesson_id: int, db: AsyncSession = Depends(get_db)):
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    steps = (await db.execute(
        select(LessonStep)
        .where(LessonStep.lesson_id == lesson_id)
        .order_by(LessonStep.order_index)
    )).scalars().all()
    return LessonDetailResponse(
        id=lesson.id, module_id=lesson.module_id, title=lesson.title,
        estimated_minutes=lesson.estimated_minutes,
        steps=[
            LessonStepResponse(
                id=s.id, order_index=s.order_index, type=s.type,
                content_json=s.content_json,
            ) for s in steps
        ],
    )


@router.post("/lessons/{lesson_id}/step/{step_id}/answer",
             response_model=StepAnswerResponse)
async def submit_step_answer(
    lesson_id: int,
    step_id: int,
    payload: StepAnswerRequest,
    current: User = Depends(get_current_user),  # child token also valid
    db: AsyncSession = Depends(get_db),
):
    step = await db.get(LessonStep, step_id)
    if not step or step.lesson_id != lesson_id:
        raise HTTPException(status_code=404, detail="Step not found")

    # Compare answer with correct_answer_json
    expected = step.correct_answer_json or {}
    is_correct = (
        all(payload.answer_json.get(k) == v for k, v in expected.items())
        if expected else True  # Pure explanation steps always "correct"
    )

    # Get child_id from token
    # (helper: get_current_child returns the ChildProfile)
    # For brevity assume current.id is child profile id when role==child
    child_id = getattr(current, "id", None)

    # Record result if it's an exercise
    if step.type.value != "explanation" and child_id:
        db.add(ChildLessonStepResult(
            child_id=child_id, lesson_step_id=step.id,
            attempts_count=1,
            success_at_attempt=1 if is_correct else None,
            time_seconds=payload.time_seconds,
        ))
        await db.commit()

    # Next step?
    next_step = await db.execute(
        select(LessonStep)
        .where(LessonStep.lesson_id == lesson_id, LessonStep.order_index > step.order_index)
        .order_by(LessonStep.order_index)
        .limit(1)
    )
    next_obj = next_step.scalar_one_or_none()
    return StepAnswerResponse(
        correct=is_correct,
        next_step_index=next_obj.order_index if next_obj else None,
        lesson_completed=next_obj is None and is_correct,
    )
```

- [ ] **Step 3.4: `main.py`'a router ekle**

```python
from chess_api.routers import health, auth as auth_router, children as children_router, lessons as lessons_router
# ...
app.include_router(lessons_router.router)
```

- [ ] **Step 3.5: Test çalıştır**

```bash
pytest tests/test_lessons.py -v
```

Beklenen: 4 passed.

- [ ] **Step 3.6: Commit**

```bash
git add apps/api/
git commit -m "feat(curriculum): /modules, /lessons/{id}, step answer endpoints"
```

---

## Task 4: ChessBoard React Component

**Files:**
- Install: `react-chessboard`, `chess.js`
- Create: `apps/web/components/ChessBoard.tsx`
- Create: `apps/web/lib/chess/board-helpers.ts`
- Create: `apps/web/tests/chess-board.test.tsx`

- [ ] **Step 4.1: Bağımlılıkları kur**

```bash
cd apps/web
npm install react-chessboard@^4.7.0 chess.js@^1.0.0
```

- [ ] **Step 4.2: `lib/chess/board-helpers.ts`**

```typescript
import { Chess, Square } from 'chess.js';

export type ChessSquare = Square;

export function isValidMove(fen: string, from: ChessSquare, to: ChessSquare): boolean {
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from, to, promotion: 'q' });
    return move !== null;
  } catch {
    return false;
  }
}

export function getLegalSquares(fen: string, from: ChessSquare): ChessSquare[] {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ square: from, verbose: true });
    return moves.map(m => m.to as ChessSquare);
  } catch {
    return [];
  }
}

export function makeMove(fen: string, from: ChessSquare, to: ChessSquare): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from, to, promotion: 'q' });
    return move ? chess.fen() : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4.3: `components/ChessBoard.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';

interface ChessBoardProps {
  fen: string;
  interactive?: boolean;
  highlightSquares?: Square[];
  onSquareClick?: (square: Square) => void;
  onPieceDrop?: (from: Square, to: Square) => boolean;
  boardOrientation?: 'white' | 'black';
}

export function ChessBoard({
  fen,
  interactive = false,
  highlightSquares = [],
  onSquareClick,
  onPieceDrop,
  boardOrientation = 'white',
}: ChessBoardProps) {
  const [clickedSquare, setClickedSquare] = useState<Square | null>(null);

  const customSquareStyles: Record<string, React.CSSProperties> = {};
  highlightSquares.forEach(sq => {
    customSquareStyles[sq] = { backgroundColor: 'rgba(255, 217, 102, 0.5)' };
  });
  if (clickedSquare) {
    customSquareStyles[clickedSquare] = {
      ...customSquareStyles[clickedSquare],
      backgroundColor: 'rgba(72, 187, 120, 0.4)',
    };
  }

  return (
    <div className="aspect-square w-full max-w-[600px] mx-auto">
      <Chessboard
        position={fen}
        boardOrientation={boardOrientation}
        arePiecesDraggable={interactive}
        onPieceDrop={onPieceDrop ? (from, to) => onPieceDrop(from as Square, to as Square) : undefined}
        onSquareClick={(sq) => {
          setClickedSquare(sq as Square);
          onSquareClick?.(sq as Square);
        }}
        customSquareStyles={customSquareStyles}
      />
    </div>
  );
}
```

- [ ] **Step 4.4: TDD — `tests/chess-board.test.tsx`**

```typescript
import { render } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

describe('ChessBoard', () => {
  it('renders with initial position', () => {
    const { container } = render(
      <ChessBoard fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders empty board with custom FEN', () => {
    const { container } = render(<ChessBoard fen="8/8/8/8/8/8/8/8 w - - 0 1" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.5: Test ve commit**

```bash
npm test
git add apps/web/components/ChessBoard.tsx apps/web/lib/chess/ apps/web/tests/chess-board.test.tsx
git commit -m "feat(web): ChessBoard component with react-chessboard"
```

---

## Task 5: LessonPlayer Component

**Files:**
- Create: `apps/web/lib/stores/lesson-store.ts`
- Create: `apps/web/components/LessonPlayer.tsx`
- Create: `apps/web/components/lesson-steps/ExplanationStep.tsx`
- Create: `apps/web/components/lesson-steps/InlineExerciseStep.tsx`
- Install: `zustand`, `framer-motion`

- [ ] **Step 5.1: Bağımlılıkları kur**

```bash
npm install zustand framer-motion
```

- [ ] **Step 5.2: `lib/stores/lesson-store.ts`**

```typescript
import { create } from 'zustand';

export interface LessonStep {
  id: number;
  order_index: number;
  type: 'explanation' | 'inline_exercise' | 'quiz';
  content_json: Record<string, unknown>;
}

interface LessonState {
  lessonId: number | null;
  steps: LessonStep[];
  currentStepIndex: number;
  startedAt: number;
  attempts: Record<number, number>;
  setLesson: (id: number, steps: LessonStep[]) => void;
  advance: () => void;
  retry: () => void;
  reset: () => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  lessonId: null,
  steps: [],
  currentStepIndex: 0,
  startedAt: 0,
  attempts: {},
  setLesson: (id, steps) => set({
    lessonId: id, steps, currentStepIndex: 0,
    startedAt: Date.now(), attempts: {},
  }),
  advance: () => set((s) => ({ currentStepIndex: s.currentStepIndex + 1 })),
  retry: () => set((s) => ({
    attempts: {
      ...s.attempts,
      [s.currentStepIndex]: (s.attempts[s.currentStepIndex] || 0) + 1,
    },
  })),
  reset: () => set({
    lessonId: null, steps: [], currentStepIndex: 0,
    startedAt: 0, attempts: {},
  }),
}));
```

- [ ] **Step 5.3: `components/lesson-steps/ExplanationStep.tsx`**

```tsx
'use client';
import { motion } from 'framer-motion';
import { ChessBoard } from '@/components/ChessBoard';

interface Props {
  content: {
    title?: string;
    body?: string;
    fen?: string;
    highlight_squares?: string[];
  };
  onContinue: () => void;
}

export function ExplanationStep({ content, onContinue }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-6">
      {content.title && <h2 className="text-2xl font-bold">{content.title}</h2>}
      {content.body && <p className="text-lg">{content.body}</p>}
      {content.fen && (
        <ChessBoard
          fen={content.fen}
          highlightSquares={(content.highlight_squares || []) as never}
        />
      )}
      <button
        onClick={onContinue}
        className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg"
      >
        Devam ⟶
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 5.4: `components/lesson-steps/InlineExerciseStep.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChessBoard } from '@/components/ChessBoard';
import type { Square } from 'chess.js';

interface Props {
  stepId: number;
  lessonId: number;
  content: {
    title?: string;
    body?: string;
    fen?: string;
    task_type?: 'click_square' | 'make_move';
  };
  onResult: (correct: boolean) => void;
  onContinue: () => void;
}

export function InlineExerciseStep({
  stepId, lessonId, content, onResult, onContinue,
}: Props) {
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitAnswer(answer: Record<string, unknown>) {
    setSubmitting(true);
    const res = await fetch(`/api/backend/lessons/${lessonId}/step/${stepId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('chess_app_token')}`,
      },
      body: JSON.stringify({ answer_json: answer, time_seconds: 5 }),
    });
    const data = await res.json();
    setSubmitting(false);
    setFeedback(data.correct ? 'correct' : 'wrong');
    onResult(data.correct);
  }

  function handleSquareClick(sq: Square) {
    if (content.task_type === 'click_square' && !feedback) {
      submitAnswer({ square: sq });
    }
  }

  function handlePieceDrop(from: Square, to: Square): boolean {
    if (content.task_type === 'make_move' && !feedback) {
      submitAnswer({ from, to });
      return true;
    }
    return false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{content.title || 'Şimdi sen dene!'}</h2>
        {content.body && <p className="text-lg">{content.body}</p>}
      </div>

      {content.fen && (
        <ChessBoard
          fen={content.fen}
          interactive={!feedback}
          onSquareClick={handleSquareClick}
          onPieceDrop={handlePieceDrop}
        />
      )}

      <AnimatePresence>
        {feedback === 'correct' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-4 bg-green-100 border border-green-400 rounded-lg text-green-800 text-lg"
          >
            ✓ Doğru! Harika!
          </motion.div>
        )}
        {feedback === 'wrong' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-800 text-lg"
          >
            Yanlış, tekrar dene
            <button
              onClick={() => setFeedback(null)}
              className="ml-4 underline text-red-900"
            >Tekrar dene</button>
          </motion.div>
        )}
      </AnimatePresence>

      {feedback === 'correct' && (
        <button
          onClick={onContinue}
          className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg"
        >Devam ⟶</button>
      )}
    </div>
  );
}
```

- [ ] **Step 5.5: `components/LessonPlayer.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useLessonStore, LessonStep } from '@/lib/stores/lesson-store';
import { ExplanationStep } from './lesson-steps/ExplanationStep';
import { InlineExerciseStep } from './lesson-steps/InlineExerciseStep';

interface Props {
  lessonId: number;
  initialSteps: LessonStep[];
  onComplete: () => void;
}

export function LessonPlayer({ lessonId, initialSteps, onComplete }: Props) {
  const { steps, currentStepIndex, setLesson, advance } = useLessonStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setLesson(lessonId, initialSteps);
    setInitialized(true);
  }, [lessonId, initialSteps, setLesson]);

  if (!initialized || steps.length === 0) return <div>Yükleniyor...</div>;

  if (currentStepIndex >= steps.length) {
    onComplete();
    return <div className="text-center text-2xl">🎉 Dersi tamamladın!</div>;
  }

  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-4 bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm opacity-75 mb-6">
        Adım {currentStepIndex + 1} / {steps.length}
      </p>

      {currentStep.type === 'explanation' && (
        <ExplanationStep
          content={currentStep.content_json as never}
          onContinue={advance}
        />
      )}
      {currentStep.type === 'inline_exercise' && (
        <InlineExerciseStep
          stepId={currentStep.id}
          lessonId={lessonId}
          content={currentStep.content_json as never}
          onResult={() => { /* feedback handled internally */ }}
          onContinue={advance}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5.6: Commit**

```bash
git add apps/web/
git commit -m "feat(web): LessonPlayer + Explanation/InlineExercise step components"
```

---

## Task 6: Çocuk Anasayfa + Ders Sayfası

**Files:**
- Create: `apps/web/app/(child)/layout.tsx`
- Create: `apps/web/app/(child)/home/page.tsx`
- Create: `apps/web/app/(child)/lesson/[id]/page.tsx`

- [ ] **Step 6.1: `app/(child)/layout.tsx`**

```tsx
import { ReactNode } from 'react';

export default function ChildLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {children}
    </div>
  );
}
```

- [ ] **Step 6.2: `app/(child)/home/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface Module {
  id: number; order_index: number; name: string;
  description: string; icon: string; lessons_count: number;
}

export default function ChildHomePage() {
  const [modules, setModules] = useState<Module[]>([]);

  useEffect(() => {
    fetch('/api/backend/modules')
      .then(r => r.json())
      .then(setModules);
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-8">Hadi Öğrenelim! 🎯</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={`/lesson/${m.id}`}
            className="block p-6 bg-white rounded-2xl shadow hover:shadow-lg transition"
          >
            <h2 className="text-xl font-bold">{m.order_index}. {m.name}</h2>
            <p className="opacity-75 mt-2">{m.description}</p>
            <p className="text-sm opacity-50 mt-3">{m.lessons_count} ders</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 6.3: `app/(child)/lesson/[id]/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LessonPlayer } from '@/components/LessonPlayer';
import type { LessonStep } from '@/lib/stores/lesson-store';

interface LessonDetail {
  id: number; module_id: number; title: string;
  estimated_minutes: number; steps: LessonStep[];
}

export default function LessonPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);

  useEffect(() => {
    fetch(`/api/backend/lessons/${params.id}`)
      .then(r => r.json())
      .then(setLesson);
  }, [params.id]);

  if (!lesson) return <div className="p-8">Yükleniyor...</div>;

  return (
    <main>
      <h1 className="text-2xl font-bold p-4">{lesson.title}</h1>
      <LessonPlayer
        lessonId={lesson.id}
        initialSteps={lesson.steps}
        onComplete={() => router.push('/home')}
      />
    </main>
  );
}
```

- [ ] **Step 6.4: Manuel test**

Backend + Frontend dev sunucularını başlat. `/parent-signup` ile hesap aç, çocuk profili oluştur, PIN ile gir, `/home`'a git. Modülleri gör. Modül 1'e tıkla, dersi başlat, step'leri ilerlet.

- [ ] **Step 6.5: Commit**

```bash
git add apps/web/app/\(child\)/
git commit -m "feat(web): child home + lesson page wired to LessonPlayer"
```

---

## Task 7: Modül 1'in Geri Kalan 8 Dersi (İçerik)

Bu task içerik üretim taskı — kod değil. JSON formatında 8 ders daha hazırlanır.

- [ ] **Step 7.1: `curriculum-data.json`'ı genişlet**

Modül 1'in tüm 9 dersi:
1. Satranç tahtası ve koordinatlar (Task 2'de örnek olarak yazıldı)
2. Piyon — nasıl hareket eder, kuralları
3. Kale — hareket
4. Fil — hareket
5. At — özel L-şekli hareket
6. Vezir — en güçlü taş
7. Şah — özel hareketler, rok
8. En passant ve piyon terfi
9. Tüm taşları tanı (modül sınavı)

Her ders 6-8 step'e bölünür (explanation + inline_exercise dağıtımı). FEN'ler boş tahta + ilgili taş ile yapılır.

- [ ] **Step 7.2: Seed'i yeniden çalıştır**

```bash
python -m scripts.seed_curriculum
```

- [ ] **Step 7.3: Manuel test — tüm 9 dersi gez**

Her dersi başından sonuna oyna, inline alıştırmalar doğru çalışıyor mu, "tekrar dene" akışı çalışıyor mu kontrol et.

- [ ] **Step 7.4: Commit**

```bash
git add apps/api/scripts/curriculum-data.json
git commit -m "content(curriculum): all 9 lessons for Module 1 (taşlar)"
```

---

## ACCEPTANCE TESTS — Plan 3 Test Geçidi

### Birim Testler
- [ ] `pytest tests/test_lessons.py -v` → 4 passed
- [ ] `npm test` (apps/web) → ChessBoard test + önceki testler → tümü yeşil

### E2E Testler
Create: `e2e/tests/lesson-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('child completes Module 1 Lesson 1', async ({ page }) => {
  // Login as child (setup helper)
  // ... auth flow
  await page.goto('/lesson/1');
  await expect(page.getByText('Adım 1')).toBeVisible();
  // Click through explanation steps
  // For inline exercise, click correct square
  // Verify completion message
});
```

- [ ] E2E: çocuk bir dersi başından sonuna oynayabiliyor → passed
- [ ] E2E: yanlış cevapta "Yanlış, tekrar dene" çıkıyor → passed
- [ ] E2E: doğru cevap sonrası "Devam ⟶" butonu çalışıyor → passed

### Manuel Doğrulama
- [ ] Çocuk anasayfada 9 modül kart olarak görünür
- [ ] Modül 1'e tıklayınca ilk ders açılır
- [ ] Açıklama step'lerinde "Devam" butonu var
- [ ] Inline alıştırmada tahta interaktif, doğru kareye tıklayınca "✓ Doğru!" yeşil çıkıyor
- [ ] Yanlış kareye tıklayınca "Yanlış, tekrar dene" + retry butonu
- [ ] Ders bittiğinde "🎉 Dersi tamamladın!" + home'a yönlendirir
- [ ] Modül 1'in 9 dersinin tümü baştan sona oynanabiliyor

### Performans
- [ ] Lesson API endpoint < 200ms
- [ ] Tahta render < 100ms

### CI Testleri
- [ ] Push → tüm Actions yeşil

**Tümü ✅ ise Plan 4'e geç.**

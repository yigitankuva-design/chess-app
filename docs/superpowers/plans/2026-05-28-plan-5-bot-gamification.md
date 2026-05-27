# Plan 5: Bot Oyunu + Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Çocuk Stockfish.js ile bot karşı oynar. Rozet/rütbe/avatar sistemi ve günlük challenge.

**Architecture:** Backend `Game`, `GameMove`, `Badge`, `ChildBadge`, `Rank`, `ChildRank` modelleri + badge criteria engine (event-based). Frontend Stockfish WebWorker, BotGame UI, BadgeToast, XPBar, avatar seçimi.

**Tech Stack:** Stockfish.js (npm: `stockfish` veya CDN), python-chess (sunucu doğrulama), event-driven badge unlocking.

**Bağımlılık:** Plan 4 yeşil.
**Süre tahmini:** 2 hafta

---

## File Structure

```
apps/api/chess_api/
├── models/
│   ├── game.py             # Game, GameMove
│   └── gamification.py     # Badge, ChildBadge, Rank, ChildRank
├── schemas/
│   ├── game.py
│   └── gamification.py
├── routers/
│   ├── games.py
│   └── gamification.py
├── services/
│   ├── badge_engine.py     # Event-based criteria evaluation
│   ├── rank_engine.py      # XP accumulation
│   └── game_validation.py  # python-chess move validation
└── scripts/
    ├── seed_badges.py      # 25-30 badge tanımları
    └── seed_ranks.py       # 6 rank (Piyon → Şah)

apps/web/
├── components/
│   ├── BotGame.tsx
│   ├── BadgeToast.tsx
│   ├── XPBar.tsx
│   ├── AvatarSelector.tsx
│   └── DailyChallenge.tsx
├── lib/
│   ├── stockfish-worker.ts
│   └── chess/stockfish.ts
├── app/(child)/
│   ├── play/page.tsx
│   ├── badges/page.tsx
│   ├── profile/page.tsx
│   └── daily/page.tsx
└── public/
    └── stockfish/          # Stockfish.wasm + worker
```

---

## Task 1: Game + Gamification Models

**Files:**
- Create: `apps/api/chess_api/models/game.py`
- Create: `apps/api/chess_api/models/gamification.py`

- [ ] **Step 1.1: `models/game.py`**

```python
import enum
from datetime import datetime
from sqlalchemy import String, Integer, Enum, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class GameType(str, enum.Enum):
    bot = "bot"
    human = "human"


class GameStatus(str, enum.Enum):
    active = "active"
    finished = "finished"
    aborted = "aborted"


class GameResult(str, enum.Enum):
    white_wins = "1-0"
    black_wins = "0-1"
    draw = "1/2-1/2"


class Game(Base):
    __tablename__ = "games"
    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[GameType] = mapped_column(Enum(GameType))
    status: Mapped[GameStatus] = mapped_column(Enum(GameStatus), default=GameStatus.active)
    result: Mapped[GameResult | None] = mapped_column(Enum(GameResult), nullable=True)
    white_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True, index=True)
    black_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True, index=True)
    black_bot_level: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-20 Stockfish skill
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    pgn: Mapped[str | None] = mapped_column(Text, nullable=True)


class GameMove(Base):
    __tablename__ = "game_moves"
    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int] = mapped_column(Integer)
    san: Mapped[str] = mapped_column(String(10))
    fen_after: Mapped[str] = mapped_column(String(120))
    time_left_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    by_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True)
```

- [ ] **Step 1.2: `models/gamification.py`**

```python
from datetime import datetime
from sqlalchemy import String, Integer, JSON, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name_tr: Mapped[str] = mapped_column(String(80))
    description_tr: Mapped[str] = mapped_column(String(255))
    icon: Mapped[str] = mapped_column(String(40))
    criteria_json: Mapped[dict] = mapped_column(JSON)
    # Example: {"type": "lessons_completed", "count": 1}
    #          {"type": "puzzle_streak", "count": 7}
    #          {"type": "first_mate", "count": 1}


class ChildBadge(Base):
    __tablename__ = "child_badges"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id"), index=True)
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Rank(Base):
    __tablename__ = "ranks"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_index: Mapped[int] = mapped_column(Integer, unique=True)
    name_tr: Mapped[str] = mapped_column(String(40))
    xp_required: Mapped[int] = mapped_column(Integer)
    icon: Mapped[str] = mapped_column(String(40))


class ChildRank(Base):
    __tablename__ = "child_ranks"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), unique=True, index=True)
    current_rank_id: Mapped[int] = mapped_column(ForeignKey("ranks.id"))
    xp_total: Mapped[int] = mapped_column(Integer, default=0)
```

- [ ] **Step 1.3: Migration + commit**

```bash
alembic revision --autogenerate -m "create game and gamification tables"
alembic upgrade head
git commit -am "feat(gamification): Game, Badge, Rank models"
```

---

## Task 2: Seed Badges + Ranks

**Files:**
- Create: `apps/api/scripts/seed_badges.py`
- Create: `apps/api/scripts/seed_ranks.py`
- Create: `apps/api/scripts/badges-data.json`
- Create: `apps/api/scripts/ranks-data.json`

- [ ] **Step 2.1: `badges-data.json` (~25 rozet)**

```json
[
  {"slug": "first_lesson", "name_tr": "İlk Adım", "description_tr": "İlk dersi tamamla", "icon": "star", "criteria": {"type": "lessons_completed", "count": 1}},
  {"slug": "module_1_done", "name_tr": "Taşları Tanıdım", "description_tr": "Modül 1'i bitir", "icon": "trophy-bronze", "criteria": {"type": "module_completed", "module_id": 1}},
  {"slug": "first_puzzle", "name_tr": "İlk Bulmaca", "description_tr": "İlk puzzle'ı çöz", "icon": "puzzle", "criteria": {"type": "puzzles_solved", "count": 1}},
  {"slug": "puzzle_10", "name_tr": "10 Puzzle", "description_tr": "10 puzzle çöz", "icon": "puzzle-bronze", "criteria": {"type": "puzzles_solved", "count": 10}},
  {"slug": "puzzle_50", "name_tr": "Bulmaca Ustası", "description_tr": "50 puzzle çöz", "icon": "puzzle-silver", "criteria": {"type": "puzzles_solved", "count": 50}},
  {"slug": "puzzle_100", "name_tr": "Bulmaca Şampiyonu", "description_tr": "100 puzzle çöz", "icon": "puzzle-gold", "criteria": {"type": "puzzles_solved", "count": 100}},
  {"slug": "streak_3", "name_tr": "3 Günlük Seri", "description_tr": "3 gün üst üste pratik yap", "icon": "fire", "criteria": {"type": "daily_streak", "count": 3}},
  {"slug": "streak_7", "name_tr": "Haftalık Sertifika", "description_tr": "7 gün üst üste pratik", "icon": "fire-blue", "criteria": {"type": "daily_streak", "count": 7}},
  {"slug": "streak_30", "name_tr": "Ay Şampiyonu", "description_tr": "30 gün üst üste pratik", "icon": "fire-gold", "criteria": {"type": "daily_streak", "count": 30}},
  {"slug": "first_bot_win", "name_tr": "Bot Yendim!", "description_tr": "Bota karşı ilk zaferi al", "icon": "robot-defeated", "criteria": {"type": "bot_wins", "count": 1}},
  {"slug": "bot_master_easy", "name_tr": "Kolay Ustası", "description_tr": "Kolay botu 10 kez yen", "icon": "trophy-bronze", "criteria": {"type": "bot_wins", "count": 10, "bot_level_max": 5}},
  {"slug": "first_mate", "name_tr": "İlk Mat", "description_tr": "İlk mat hamleni yap", "icon": "checkmate", "criteria": {"type": "first_mate", "count": 1}},
  {"slug": "first_human_game", "name_tr": "Arkadaşla Oyun", "description_tr": "İlk insan oyunu", "icon": "handshake", "criteria": {"type": "human_games", "count": 1}},
  {"slug": "first_human_win", "name_tr": "İlk Arkadaş Zaferi", "description_tr": "İlk insan rakibe karşı kazanç", "icon": "winner", "criteria": {"type": "human_wins", "count": 1}},
  {"slug": "perfect_lesson", "name_tr": "Kusursuz!", "description_tr": "Bir dersi hiç yanlış yapmadan bitir", "icon": "diamond", "criteria": {"type": "perfect_lesson", "count": 1}},
  {"slug": "speed_demon", "name_tr": "Hız Şeytanı", "description_tr": "Puzzle'ı 10sn'de çöz", "icon": "lightning", "criteria": {"type": "fast_solve", "max_seconds": 10}},
  {"slug": "modul_2_done", "name_tr": "Değerleri Öğrendim", "description_tr": "Modül 2'yi bitir", "icon": "balance-bronze", "criteria": {"type": "module_completed", "module_id": 2}},
  {"slug": "modul_3_done", "name_tr": "Tehditleri Görüyorum", "description_tr": "Modül 3'ü bitir", "icon": "target-bronze", "criteria": {"type": "module_completed", "module_id": 3}},
  {"slug": "modul_9_done", "name_tr": "Mat Ustası", "description_tr": "Modül 9'u bitir", "icon": "crown-gold", "criteria": {"type": "module_completed", "module_id": 9}},
  {"slug": "all_modules_done", "name_tr": "Satranç Yolcusu", "description_tr": "Tüm 9 modülü tamamla", "icon": "trophy-gold", "criteria": {"type": "all_modules_completed", "count": 9}},
  {"slug": "daily_challenge_5", "name_tr": "Günün Avcısı", "description_tr": "5 günlük challenge çöz", "icon": "calendar-star", "criteria": {"type": "daily_challenges", "count": 5}},
  {"slug": "rank_at", "name_tr": "At Rütbesi", "description_tr": "At rütbesine ulaş", "icon": "rank-knight", "criteria": {"type": "rank_reached", "rank": "knight"}},
  {"slug": "rank_vezir", "name_tr": "Vezir Rütbesi", "description_tr": "Vezir rütbesine ulaş", "icon": "rank-queen", "criteria": {"type": "rank_reached", "rank": "queen"}},
  {"slug": "rank_sah", "name_tr": "Şah Rütbesi", "description_tr": "En yüksek rütbeye ulaş", "icon": "rank-king", "criteria": {"type": "rank_reached", "rank": "king"}},
  {"slug": "explorer", "name_tr": "Kaşif", "description_tr": "Tüm avatar/ek seçeneklerini gör", "icon": "compass", "criteria": {"type": "explorer", "count": 1}}
]
```

- [ ] **Step 2.2: `ranks-data.json`**

```json
[
  {"order": 1, "name_tr": "Piyon", "xp_required": 0, "icon": "rank-pawn"},
  {"order": 2, "name_tr": "At", "xp_required": 200, "icon": "rank-knight"},
  {"order": 3, "name_tr": "Fil", "xp_required": 500, "icon": "rank-bishop"},
  {"order": 4, "name_tr": "Kale", "xp_required": 1000, "icon": "rank-rook"},
  {"order": 5, "name_tr": "Vezir", "xp_required": 2000, "icon": "rank-queen"},
  {"order": 6, "name_tr": "Şah", "xp_required": 4000, "icon": "rank-king"}
]
```

- [ ] **Step 2.3: Seed scriptleri yaz**

`scripts/seed_badges.py` ve `scripts/seed_ranks.py` — JSON dosyalarını okuyup DB'ye yazan basit script'ler (Plan 3'teki `seed_curriculum.py` ile aynı pattern).

- [ ] **Step 2.4: Çalıştır + commit**

```bash
python -m scripts.seed_badges
python -m scripts.seed_ranks
git commit -am "feat(gamification): seed 25 badges + 6 ranks"
```

---

## Task 3: Badge Engine + Rank Engine

**Files:**
- Create: `apps/api/chess_api/services/badge_engine.py`
- Create: `apps/api/chess_api/services/rank_engine.py`
- Create: `apps/api/tests/test_badge_engine.py`

- [ ] **Step 3.1: TDD — `tests/test_badge_engine.py`**

```python
from chess_api.services.badge_engine import evaluate_event, BadgeEvent


async def test_first_lesson_unlocks_badge(db, child):
    new_badges = await evaluate_event(
        db, child.id, BadgeEvent(type="lesson_completed", lesson_id=1)
    )
    assert any(b.slug == "first_lesson" for b in new_badges)


async def test_idempotent_badge_unlock(db, child):
    # First completion
    await evaluate_event(db, child.id, BadgeEvent(type="lesson_completed", lesson_id=1))
    # Second completion (different lesson)
    new = await evaluate_event(db, child.id, BadgeEvent(type="lesson_completed", lesson_id=2))
    # Should NOT re-award first_lesson
    assert not any(b.slug == "first_lesson" for b in new)
```

- [ ] **Step 3.2: `services/badge_engine.py`**

```python
"""Event-based badge evaluation.

When something happens (lesson completed, puzzle solved, game won, etc.),
call evaluate_event with the event. Engine queries DB for cumulative state
and checks each badge's criteria.
"""
from dataclasses import dataclass
from typing import Literal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import (
    Badge, ChildBadge, ChildLessonProgress, ChildPuzzleAttempt,
    Game, GameType, GameResult, LessonStatus,
)


@dataclass
class BadgeEvent:
    type: str
    lesson_id: int | None = None
    module_id: int | None = None
    puzzle_id: int | None = None
    game_id: int | None = None
    time_seconds: int | None = None
    bot_level: int | None = None


async def evaluate_event(
    db: AsyncSession, child_id: int, event: BadgeEvent,
) -> list[Badge]:
    """Returns list of newly awarded badges (empty if nothing new)."""
    # Get child's existing badges
    existing_q = await db.execute(
        select(ChildBadge.badge_id).where(ChildBadge.child_id == child_id)
    )
    existing_ids = set(existing_q.scalars().all())

    # Get all badges
    all_badges = (await db.execute(select(Badge))).scalars().all()
    new_badges: list[Badge] = []

    for badge in all_badges:
        if badge.id in existing_ids:
            continue
        if await _check_criteria(db, child_id, badge.criteria_json, event):
            db.add(ChildBadge(child_id=child_id, badge_id=badge.id))
            new_badges.append(badge)

    if new_badges:
        await db.commit()
    return new_badges


async def _check_criteria(db, child_id, criteria, event) -> bool:
    ctype = criteria.get("type")

    if ctype == "lessons_completed":
        count = await db.scalar(
            select(func.count(ChildLessonProgress.id))
            .where(ChildLessonProgress.child_id == child_id,
                   ChildLessonProgress.status == LessonStatus.completed)
        )
        return (count or 0) >= criteria.get("count", 1)

    if ctype == "puzzles_solved":
        count = await db.scalar(
            select(func.count(ChildPuzzleAttempt.id))
            .where(ChildPuzzleAttempt.child_id == child_id,
                   ChildPuzzleAttempt.success.is_(True))
        )
        return (count or 0) >= criteria.get("count", 1)

    if ctype == "bot_wins":
        max_level = criteria.get("bot_level_max", 99)
        # Count games where this child won against bot
        q = select(func.count(Game.id)).where(
            Game.type == GameType.bot,
            Game.white_child_id == child_id,
            Game.result == GameResult.white_wins,
            Game.black_bot_level <= max_level,
        )
        count = await db.scalar(q)
        return (count or 0) >= criteria.get("count", 1)

    if ctype == "module_completed" and event.type == "module_completed":
        return event.module_id == criteria.get("module_id")

    if ctype == "fast_solve":
        return (event.time_seconds or 999) <= criteria.get("max_seconds", 999)

    # TODO: daily_streak, perfect_lesson, etc. (event-triggered or computed)
    return False
```

- [ ] **Step 3.3: `services/rank_engine.py`**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import Rank, ChildRank


XP_EVENTS = {
    "lesson_completed": 30,
    "puzzle_solved": 10,
    "bot_win": 20,
    "human_win": 50,
    "daily_challenge_solved": 25,
    "module_completed": 100,
}


async def add_xp(db: AsyncSession, child_id: int, event_type: str) -> dict:
    xp = XP_EVENTS.get(event_type, 0)
    if xp == 0:
        return {"awarded": 0}

    # Get or create ChildRank
    existing = await db.execute(
        select(ChildRank).where(ChildRank.child_id == child_id)
    )
    cr = existing.scalar_one_or_none()
    if not cr:
        first_rank = (await db.execute(
            select(Rank).order_by(Rank.order_index).limit(1)
        )).scalar_one()
        cr = ChildRank(child_id=child_id, current_rank_id=first_rank.id, xp_total=0)
        db.add(cr)

    cr.xp_total += xp

    # Check rank up
    new_rank = (await db.execute(
        select(Rank).where(Rank.xp_required <= cr.xp_total).order_by(Rank.order_index.desc()).limit(1)
    )).scalar_one()
    leveled_up = new_rank.id != cr.current_rank_id
    cr.current_rank_id = new_rank.id

    await db.commit()
    return {"awarded": xp, "new_xp": cr.xp_total, "rank": new_rank.name_tr, "leveled_up": leveled_up}
```

- [ ] **Step 3.4: Test + commit**

```bash
pytest tests/test_badge_engine.py -v
git commit -am "feat(gamification): badge + rank engines"
```

---

## Task 4: Game Endpoints (Bot Oyunu)

**Files:**
- Create: `apps/api/chess_api/services/game_validation.py`
- Create: `apps/api/chess_api/schemas/game.py`
- Create: `apps/api/chess_api/routers/games.py`
- Create: `apps/api/tests/test_games.py`

- [ ] **Step 4.1: `services/game_validation.py`**

```python
import chess


def validate_move(fen: str, move_uci: str) -> dict | None:
    """Validate move on given FEN. Returns new FEN + legal status."""
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(move_uci)
        if move not in board.legal_moves:
            return None
        san = board.san(move)
        board.push(move)
        return {
            "fen_after": board.fen(),
            "san": san,
            "is_check": board.is_check(),
            "is_checkmate": board.is_checkmate(),
            "is_stalemate": board.is_stalemate(),
            "is_game_over": board.is_game_over(),
        }
    except Exception:
        return None
```

- [ ] **Step 4.2: `schemas/game.py`**

```python
from pydantic import BaseModel
from chess_api.models.game import GameType, GameStatus, GameResult


class StartBotGameRequest(BaseModel):
    skill_level: int  # 0-20


class StartBotGameResponse(BaseModel):
    game_id: int
    fen: str
    your_color: str  # "white"


class MakeMoveRequest(BaseModel):
    move_uci: str


class MoveResponse(BaseModel):
    accepted: bool
    fen_after: str | None = None
    is_checkmate: bool = False
    is_stalemate: bool = False
    game_status: GameStatus
    result: GameResult | None = None
```

- [ ] **Step 4.3: `routers/games.py`**

```python
import chess
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, Game, GameMove, GameType, GameStatus, GameResult
from chess_api.schemas.game import (
    StartBotGameRequest, StartBotGameResponse, MakeMoveRequest, MoveResponse,
)
from chess_api.services.game_validation import validate_move
from chess_api.services.badge_engine import evaluate_event, BadgeEvent
from chess_api.services.rank_engine import add_xp

router = APIRouter(prefix="/games", tags=["games"])

INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@router.post("/bot/start", response_model=StartBotGameResponse)
async def start_bot_game(
    payload: StartBotGameRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.skill_level < 0 or payload.skill_level > 20:
        raise HTTPException(status_code=422, detail="Skill must be 0-20")
    game = Game(
        type=GameType.bot,
        white_child_id=current.id,
        black_bot_level=payload.skill_level,
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return StartBotGameResponse(game_id=game.id, fen=INITIAL_FEN, your_color="white")


@router.post("/{game_id}/move", response_model=MoveResponse)
async def make_move(
    game_id: int,
    payload: MakeMoveRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    game = await db.get(Game, game_id)
    if not game or game.status != GameStatus.active:
        raise HTTPException(status_code=400, detail="Game not active")

    # Reconstruct FEN from last move
    last_move = (await db.execute(
        # MoveMove sorted by ply desc, limit 1
        # ... (implementation detail)
    )).scalar_one_or_none()
    current_fen = last_move.fen_after if last_move else INITIAL_FEN

    result = validate_move(current_fen, payload.move_uci)
    if not result:
        return MoveResponse(accepted=False, game_status=GameStatus.active)

    ply = (last_move.ply + 1) if last_move else 1
    move_row = GameMove(
        game_id=game_id, ply=ply,
        san=result["san"], fen_after=result["fen_after"],
        by_child_id=current.id,
    )
    db.add(move_row)

    if result["is_game_over"]:
        game.status = GameStatus.finished
        if result["is_checkmate"]:
            game.result = GameResult.white_wins  # White (child) wins
            await evaluate_event(db, current.id, BadgeEvent(type="first_mate"))
            await add_xp(db, current.id, "bot_win")
        else:
            game.result = GameResult.draw

    await db.commit()
    return MoveResponse(
        accepted=True,
        fen_after=result["fen_after"],
        is_checkmate=result["is_checkmate"],
        is_stalemate=result["is_stalemate"],
        game_status=game.status,
        result=game.result,
    )
```

- [ ] **Step 4.4: Test + commit**

```bash
pytest tests/test_games.py -v
git commit -am "feat(games): bot game start + move endpoints"
```

---

## Task 5: Frontend Stockfish Integration

**Files:**
- Create: `apps/web/lib/chess/stockfish.ts`
- Create: `apps/web/public/stockfish/stockfish.js` (CDN'den indir)
- Create: `apps/web/components/BotGame.tsx`
- Create: `apps/web/app/(child)/play/page.tsx`
- Install: `stockfish`

- [ ] **Step 5.1: Stockfish.js'i temin et**

```bash
cd apps/web
npm install stockfish
# Veya CDN'den indir: https://github.com/lichess-org/stockfish.js
# stockfish.js + stockfish.wasm dosyalarını public/stockfish/'a koy
```

- [ ] **Step 5.2: `lib/chess/stockfish.ts`**

```typescript
type StockfishMessage = (line: string) => void;

export class StockfishEngine {
  private worker: Worker | null = null;
  private listeners: StockfishMessage[] = [];

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    this.worker = new Worker('/stockfish/stockfish.js');
    this.worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : '';
      this.listeners.forEach(l => l(line));
    };
    this.send('uci');
    this.send('isready');
  }

  send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  on(listener: StockfishMessage): void {
    this.listeners.push(listener);
  }

  setSkill(level: number): void {
    this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, level))}`);
  }

  async bestMove(fen: string, depth: number = 8): Promise<string> {
    return new Promise((resolve) => {
      const listener = (line: string) => {
        if (line.startsWith('bestmove ')) {
          const move = line.split(' ')[1];
          this.listeners = this.listeners.filter(l => l !== listener);
          resolve(move);
        }
      };
      this.listeners.push(listener);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
```

- [ ] **Step 5.3: `components/BotGame.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { StockfishEngine } from '@/lib/chess/stockfish';
import type { Square } from 'chess.js';

interface Props {
  skillLevel: number; // 0-20
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
}

export function BotGame({ skillLevel, onGameEnd }: Props) {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [thinking, setThinking] = useState(false);
  const [gameId, setGameId] = useState<number | null>(null);
  const engineRef = useRef<StockfishEngine | null>(null);

  useEffect(() => {
    (async () => {
      const eng = new StockfishEngine();
      await eng.init();
      eng.setSkill(skillLevel);
      engineRef.current = eng;

      // Start game on backend
      const res = await fetch('/api/backend/games/bot/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('chess_app_token')}`,
        },
        body: JSON.stringify({ skill_level: skillLevel }),
      });
      const data = await res.json();
      setGameId(data.game_id);
    })();
    return () => engineRef.current?.destroy();
  }, [skillLevel]);

  async function handleDrop(from: Square, to: Square): Promise<boolean> {
    if (thinking || chess.isGameOver()) return false;
    const move = chess.move({ from, to, promotion: 'q' });
    if (!move) return false;
    setFen(chess.fen());

    // Persist user move to backend
    if (gameId) {
      await fetch(`/api/backend/games/${gameId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('chess_app_token')}`,
        },
        body: JSON.stringify({ move_uci: `${from}${to}` }),
      });
    }

    if (chess.isGameOver()) {
      handleGameEnd();
      return true;
    }

    setThinking(true);
    const botMove = await engineRef.current!.bestMove(chess.fen());
    chess.move({ from: botMove.slice(0,2) as Square, to: botMove.slice(2,4) as Square, promotion: 'q' });
    setFen(chess.fen());
    setThinking(false);

    if (chess.isGameOver()) {
      handleGameEnd();
    }
    return true;
  }

  function handleGameEnd() {
    if (chess.isCheckmate()) {
      onGameEnd(chess.turn() === 'b' ? 'win' : 'loss');
    } else {
      onGameEnd('draw');
    }
  }

  return (
    <div className="space-y-4">
      {thinking && <p className="text-blue-600">Bot düşünüyor... 🤔</p>}
      <ChessBoard fen={fen} interactive={!thinking} onPieceDrop={handleDrop} />
    </div>
  );
}
```

- [ ] **Step 5.4: `app/(child)/play/page.tsx`** — bot zorluk seçim ekranı ve BotGame entegrasyonu

(Implementation: 5 buton "Çok Kolay (0)", "Kolay (3)", "Orta (8)", "Zor (13)", "Çok Zor (20)" → seçilince BotGame render.)

- [ ] **Step 5.5: Manuel test + commit**

```bash
git commit -am "feat(games): Stockfish.js bot game"
```

---

## Task 6: Badge + Rank UI (Toast, XPBar, Profil)

**Files:**
- Create: `apps/web/components/BadgeToast.tsx`
- Create: `apps/web/components/XPBar.tsx`
- Create: `apps/web/app/(child)/badges/page.tsx`
- Create: `apps/web/app/(child)/profile/page.tsx`

- [ ] **Step 6.1: `components/BadgeToast.tsx`**

```tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';

interface Badge { slug: string; name_tr: string; description_tr: string; icon: string; }

export function BadgeToast({ badge, onClose }: { badge: Badge | null; onClose: () => void; }) {
  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={onClose}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-yellow-100 border-2 border-yellow-400 rounded-2xl p-4 shadow-2xl flex items-center gap-3 z-50 cursor-pointer"
        >
          <span className="text-4xl">🏆</span>
          <div>
            <p className="font-bold">{badge.name_tr}</p>
            <p className="text-sm opacity-75">{badge.description_tr}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 6.2: `components/XPBar.tsx`**

```tsx
interface Props {
  currentXP: number;
  rankName: string;
  nextRankXP: number;
}

export function XPBar({ currentXP, rankName, nextRankXP }: Props) {
  const progress = Math.min(100, (currentXP / nextRankXP) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-bold">{rankName}</span>
        <span className="opacity-75">{currentXP} / {nextRankXP} XP</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6.3: `app/(child)/badges/page.tsx` (vitrin)**

`/api/backend/gamification/badges` endpoint'inden çocuğun kazandığı + kazanmadığı tüm rozetleri getirip grid'de gösterir. Kazanılanlar parlak, kazanılmayanlar gri.

- [ ] **Step 6.4: `app/(child)/profile/page.tsx`**

Çocuğun adı, avatarı, rütbesi, XP barı, kazanılan rozetler.

- [ ] **Step 6.5: Commit**

```bash
git commit -am "feat(gamification): BadgeToast + XPBar + badges + profile pages"
```

---

## Task 7: Avatar Seçimi

**Files:**
- Create: `apps/web/components/AvatarSelector.tsx`
- Modify: `apps/web/app/(parent)/add-child/page.tsx` (avatar seçim eklenir)
- Add: `apps/web/public/avatars/` (4-5 PNG dosyası, açık kaynak veya custom)

- [ ] **Step 7.1: 4-5 avatar görseli temin et**

Kaynaklar:
- OpenChess CC0 avatar set
- Notion Avatar Maker (CC0 export)
- veya kendi çizimler

`apps/web/public/avatars/`'a koy: `avatar-1.png`, `avatar-2.png`, ..., `avatar-5.png`.

- [ ] **Step 7.2: `components/AvatarSelector.tsx`**

```tsx
'use client';
import { useState } from 'react';

const AVATARS = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5'];

export function AvatarSelector({
  value, onChange,
}: { value: string; onChange: (v: string) => void; }) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {AVATARS.map((a) => (
        <button
          key={a}
          onClick={() => onChange(a)}
          className={`rounded-full p-1 ${value === a ? 'ring-4 ring-blue-500' : 'ring-1 ring-gray-300'}`}
        >
          <img src={`/avatars/${a}.png`} alt={a} className="w-20 h-20 rounded-full" />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7.3: Add-child page'e entegre et + commit**

---

## Task 8: Daily Challenge

**Files:**
- Create: `apps/api/chess_api/routers/daily.py`
- Create: `apps/api/chess_api/services/daily_challenge.py`
- Create: `apps/web/app/(child)/daily/page.tsx`

- [ ] **Step 8.1: Backend daily challenge service**

```python
# services/daily_challenge.py
from datetime import date
import hashlib
from sqlalchemy import select
from chess_api.models import Puzzle

async def todays_puzzle(db) -> Puzzle | None:
    today_str = date.today().isoformat()
    h = int(hashlib.md5(today_str.encode()).hexdigest()[:8], 16)
    # Filter: rating 700-1000 (8-12 yaş ortalama)
    candidates_q = await db.execute(
        select(Puzzle).where(Puzzle.rating.between(700, 1000)).order_by(Puzzle.id)
    )
    candidates = candidates_q.scalars().all()
    if not candidates:
        return None
    return candidates[h % len(candidates)]
```

- [ ] **Step 8.2: `routers/daily.py`**

```python
from fastapi import APIRouter, Depends
from chess_api.database import get_db
from chess_api.services.daily_challenge import todays_puzzle

router = APIRouter(prefix="/daily", tags=["daily"])

@router.get("/puzzle")
async def get_daily(db = Depends(get_db)):
    p = await todays_puzzle(db)
    if not p:
        return {"available": False}
    return {
        "available": True,
        "puzzle_id": p.id, "fen": p.fen, "moves": p.moves_json,
        "themes": [t.name_tr for t in p.themes],
    }
```

- [ ] **Step 8.3: Frontend `/daily/page.tsx` — PuzzleSolver kullanır, "Bugünün Bulmacası" başlıklı**

- [ ] **Step 8.4: Commit**

```bash
git commit -am "feat(gamification): daily challenge"
```

---

## ACCEPTANCE TESTS — Plan 5 Test Geçidi

### Backend Birim Testler
- [ ] Badge engine: en az 5 test yeşil (lessons_completed, puzzles_solved, idempotent, bot_wins, fast_solve)
- [ ] Rank engine: XP toplama + rank up testleri yeşil
- [ ] Game endpoint: bot oyun başlatma + hamle doğrulama testleri yeşil

### Manuel Doğrulama
- [ ] Çocuk `/play` ekranında zorluk seçer, BotGame başlar
- [ ] İlk hamleyi yapar, Bot 1-2 saniye sonra hamle yapar
- [ ] Mat verirse: BadgeToast "İlk Mat" + XP +20 + bot_win rozet
- [ ] `/badges` ekranında kazanılmış rozetler parlak, kalanlar gri
- [ ] `/profile` ekranında avatar + rütbe + XP barı görünür
- [ ] `/daily` ekranında günün puzzle'ı, ertesi gün farklı puzzle gelir
- [ ] Avatar seçici add-child sayfasında çalışıyor

### E2E
- [ ] Çocuk profili oluşturulduğunda rastgele/seçilen avatar atanır
- [ ] Ders bittiğinde rozet popup + XP artışı

### Performans
- [ ] Stockfish.js yüklenmesi < 3sn
- [ ] Bot hamle yanıt süresi (skill 5'te) < 2sn

**Tümü ✅ ise Plan 6'ya geç.**

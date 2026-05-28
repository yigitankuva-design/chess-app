from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user, get_current_child
from chess_api.models import User, ChildProfile, Puzzle, ChildPuzzleAttempt, SRSCard, SRSItemType
from chess_api.schemas.puzzle import (
    PuzzleResponse, PuzzleAttemptRequest, PuzzleAttemptResponse,
)
from chess_api.services.puzzle_selection import select_puzzle_for_child

router = APIRouter(prefix="/puzzles", tags=["puzzles"])


@router.get("/random", response_model=PuzzleResponse)
async def random_puzzle(
    module_id: int | None = None,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    puzzle = await select_puzzle_for_child(db, child.id, module_id=module_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No suitable puzzle found")
    return PuzzleResponse(
        id=puzzle.id, fen=puzzle.fen, moves=puzzle.moves_json,
        rating=puzzle.rating, themes=[t.name_tr for t in puzzle.themes],
    )


@router.get("/{puzzle_id}", response_model=PuzzleResponse)
async def get_puzzle(
    puzzle_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Puzzle).where(Puzzle.id == puzzle_id).options(selectinload(Puzzle.themes))
    )
    puzzle = result.scalar_one_or_none()
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return PuzzleResponse(
        id=puzzle.id, fen=puzzle.fen, moves=puzzle.moves_json,
        rating=puzzle.rating, themes=[t.name_tr for t in puzzle.themes],
    )


@router.post("/{puzzle_id}/attempt", response_model=PuzzleAttemptResponse)
async def record_attempt(
    puzzle_id: int,
    payload: PuzzleAttemptRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    puzzle = await db.get(Puzzle, puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    attempt = ChildPuzzleAttempt(
        child_id=child.id, puzzle_id=puzzle_id,
        success=payload.success, time_seconds=payload.time_seconds,
    )
    db.add(attempt)

    # Create SRS card on successful solve (idempotent)
    if payload.success:
        existing_card = await db.execute(
            select(SRSCard).where(
                SRSCard.child_id == child.id,
                SRSCard.item_type == SRSItemType.puzzle,
                SRSCard.item_id == puzzle_id,
            )
        )
        if existing_card.scalar_one_or_none() is None:
            db.add(SRSCard(
                child_id=child.id,
                item_type=SRSItemType.puzzle,
                item_id=puzzle_id,
                due_at=datetime.utcnow() + timedelta(days=1),
                interval_days=1.0,
                ease_factor=2.5,
                reps_count=1,
                last_result="correct",
            ))

    await db.commit()
    return PuzzleAttemptResponse(accepted=True)

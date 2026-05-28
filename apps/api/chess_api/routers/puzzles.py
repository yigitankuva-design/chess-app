from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, Puzzle, ChildPuzzleAttempt
from chess_api.schemas.puzzle import (
    PuzzleResponse, PuzzleAttemptRequest, PuzzleAttemptResponse,
)
from chess_api.services.puzzle_selection import select_puzzle_for_child

router = APIRouter(prefix="/puzzles", tags=["puzzles"])


def _child_id_from(current: User) -> int:
    # current is resolved by get_current_user; for child tokens this is the
    # ChildProfile id encoded as user_id... but our get_current_user loads a User.
    # For puzzles we accept any authenticated principal and use .id.
    return current.id


@router.get("/random", response_model=PuzzleResponse)
async def random_puzzle(
    module_id: int | None = None,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    puzzle = await select_puzzle_for_child(db, _child_id_from(current), module_id=module_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="No suitable puzzle found")
    return PuzzleResponse(
        id=puzzle.id, fen=puzzle.fen, moves=puzzle.moves_json,
        rating=puzzle.rating, themes=[t.name_tr for t in puzzle.themes],
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
        raise HTTPException(status_code=404, detail="Puzzle not found")
    attempt = ChildPuzzleAttempt(
        child_id=_child_id_from(current), puzzle_id=puzzle_id,
        success=payload.success, time_seconds=payload.time_seconds,
    )
    db.add(attempt)
    await db.commit()
    return PuzzleAttemptResponse(accepted=True)

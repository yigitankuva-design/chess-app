from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, LessonStep
from chess_api.models.practice import ChildPracticeResult

VALID_MODES = {"suresiz", "sureli", "test"}

router = APIRouter(prefix="/practice", tags=["practice"])


class SubmitRequest(BaseModel):
    mode: str
    correct: int = Field(ge=0)
    total: int = Field(gt=0)


class SubmitResponse(BaseModel):
    score: int
    best_score: int
    improved: bool


class DetailResponse(BaseModel):
    best_score: int
    best_correct: int
    best_total: int
    attempts_count: int


async def _get_row(db: AsyncSession, child_id: int, step_id: int, mode: str):
    q = select(ChildPracticeResult).where(
        ChildPracticeResult.child_id == child_id,
        ChildPracticeResult.lesson_step_id == step_id,
        ChildPracticeResult.mode == mode,
    )
    return (await db.execute(q)).scalar_one_or_none()


@router.post("/steps/{step_id}/submit", response_model=SubmitResponse)
async def submit_practice(
    step_id: int,
    payload: SubmitRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bir pratik oturumunun sonucunu kaydeder ve en iyi skoru günceller.

    Puan İSTEMCİDEN ALINMAZ, burada hesaplanır — istemciye güvenilmez.
    """
    if payload.mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
    if payload.correct > payload.total:
        raise HTTPException(status_code=400, detail="correct cannot exceed total")

    step = await db.get(LessonStep, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Lesson step not found")

    score = round(payload.correct / payload.total * 100)
    row = await _get_row(db, child.id, step_id, payload.mode)

    if row is None:
        row = ChildPracticeResult(
            child_id=child.id, lesson_step_id=step_id, mode=payload.mode,
            best_score=score, best_correct=payload.correct, best_total=payload.total,
            attempts_count=1, last_played_at=datetime.utcnow(),
        )
        db.add(row)
        improved = True
    else:
        row.attempts_count += 1
        row.last_played_at = datetime.utcnow()
        improved = score > row.best_score
        if improved:
            row.best_score = score
            row.best_correct = payload.correct
            row.best_total = payload.total

    await db.commit()
    return SubmitResponse(score=score, best_score=row.best_score, improved=improved)


@router.get("/steps/{step_id}/detail", response_model=DetailResponse)
async def practice_detail(
    step_id: int,
    mode: str = "suresiz",
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Tek bir alt konu+mod için en iyi sonuç. Kayıt yoksa sıfırlarla döner."""
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
    row = await _get_row(db, child.id, step_id, mode)
    if row is None:
        return DetailResponse(best_score=0, best_correct=0, best_total=0, attempts_count=0)
    return DetailResponse(
        best_score=row.best_score, best_correct=row.best_correct,
        best_total=row.best_total, attempts_count=row.attempts_count,
    )

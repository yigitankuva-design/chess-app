from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import (
    User, ChildProfile, UserRole,
    ChildLessonProgress, ChildLessonStepResult,
    ChildPuzzleAttempt, SRSCard, ChildBadge, ChildRank,
    ParentTimeLimit, ChildActivityLog, ParentSurveyResponse,
    Game, GameMove, Device,
)
from chess_api.schemas.auth import ChildProfileCreate, ChildProfileResponse
from chess_api.services.password import hash_pin

router = APIRouter(prefix="/children", tags=["children"])


@router.post("", response_model=ChildProfileResponse, status_code=201)
async def create_child(
    payload: ChildProfileCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Only parents can create children")
    child = ChildProfile(
        parent_user_id=current.id,
        display_name=payload.display_name,
        age=payload.age,
        avatar=payload.avatar,
        pin_hash=hash_pin(payload.pin),
    )
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return ChildProfileResponse(
        id=child.id,
        display_name=child.display_name,
        age=child.age,
        avatar=child.avatar,
        teacher_user_id=child.teacher_user_id,
    )


@router.get("", response_model=list[ChildProfileResponse])
async def list_children(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Only parents can list children")
    result = await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == current.id)
    )
    return [
        ChildProfileResponse(
            id=c.id,
            display_name=c.display_name,
            age=c.age,
            avatar=c.avatar,
            teacher_user_id=c.teacher_user_id,
        )
        for c in result.scalars().all()
    ]


@router.delete("/{child_id}", status_code=204)
async def delete_child(
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Only parents can delete children")
    child = await db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != current.id:
        raise HTTPException(status_code=404, detail="Child not found")

    # Games involving this child (always white for bot games, either side for human)
    game_ids = (await db.execute(
        select(Game.id).where(
            (Game.white_child_id == child_id) | (Game.black_child_id == child_id)
        )
    )).scalars().all()

    # Delete dependent rows in FK-safe order
    if game_ids:
        await db.execute(delete(GameMove).where(GameMove.game_id.in_(game_ids)))
    await db.execute(delete(GameMove).where(GameMove.by_child_id == child_id))
    if game_ids:
        await db.execute(delete(Game).where(Game.id.in_(game_ids)))

    await db.execute(delete(ChildLessonStepResult).where(ChildLessonStepResult.child_id == child_id))
    await db.execute(delete(ChildLessonProgress).where(ChildLessonProgress.child_id == child_id))
    await db.execute(delete(ChildPuzzleAttempt).where(ChildPuzzleAttempt.child_id == child_id))
    await db.execute(delete(SRSCard).where(SRSCard.child_id == child_id))
    await db.execute(delete(ChildBadge).where(ChildBadge.child_id == child_id))
    await db.execute(delete(ChildRank).where(ChildRank.child_id == child_id))
    await db.execute(delete(ParentTimeLimit).where(ParentTimeLimit.child_id == child_id))
    await db.execute(delete(ChildActivityLog).where(ChildActivityLog.child_id == child_id))

    # Nullable FKs — keep the parent-side record, just detach the child
    await db.execute(
        update(ParentSurveyResponse)
        .where(ParentSurveyResponse.child_id == child_id)
        .values(child_id=None)
    )
    await db.execute(
        update(Device)
        .where(Device.active_child_profile_id == child_id)
        .values(active_child_profile_id=None)
    )

    await db.delete(child)
    await db.commit()
    return None

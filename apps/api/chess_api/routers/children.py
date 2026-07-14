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
from chess_api.services.child_deletion import delete_child_cascade

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

    await delete_child_cascade(db, child)
    await db.commit()
    return None

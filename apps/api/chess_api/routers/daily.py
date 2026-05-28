from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.services.daily_challenge import todays_puzzle

router = APIRouter(prefix="/daily", tags=["daily"])


@router.get("/puzzle")
async def daily_puzzle(db: AsyncSession = Depends(get_db)):
    """Get today's daily challenge puzzle.

    Returns a deterministic puzzle based on the current UTC date.
    Available for all users, no authentication required.

    Returns:
        {
            "available": bool,
            "puzzle_id": int (if available),
            "fen": str (if available),
            "moves": list[str] (if available),
            "themes": list[str] (if available)
        }
    """
    p = await todays_puzzle(db)
    if not p:
        return {"available": False}
    return {
        "available": True,
        "puzzle_id": p.id,
        "fen": p.fen,
        "moves": p.moves_json,
        "themes": [t.name_tr for t in p.themes],
    }

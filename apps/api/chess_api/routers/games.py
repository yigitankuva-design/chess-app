from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, Game, GameMove, GameType, GameStatus, GameResult
from chess_api.schemas.game import (
    StartBotGameRequest, StartBotGameResponse, MakeMoveRequest, MoveResponse,
)
from chess_api.services.game_validation import validate_move
from chess_api.services.badge_engine import evaluate_event, BadgeEvent
from chess_api.services.rank_engine import add_xp
from chess_api.services.activity_logger import log_activity
from chess_api.services.time_limit_check import check_time_limit

router = APIRouter(prefix="/games", tags=["games"])

INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@router.post("/bot/start", response_model=StartBotGameResponse)
async def start_bot_game(
    payload: StartBotGameRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    if payload.skill_level < 0 or payload.skill_level > 20:
        raise HTTPException(status_code=422, detail="Skill must be 0-20")

    status = await check_time_limit(db, child.id)
    if not status["allowed"]:
        raise HTTPException(status_code=429, detail=f"Günlük süre doldu ({status['used_minutes']}/{status['limit_minutes']} dk)")

    # base_ms>0 varsa saatli mac; yoksa suresiz (mevcut insan-insan akisiyla
    # AYNI donusum deseni, bkz. live_game.py::_handle_challenge_accept).
    base_ms = (payload.tc_base_seconds * 1000
               if payload.tc_base_seconds and payload.tc_base_seconds > 0 else None)

    # white_child_id/black_bot_level BILEREK degismiyor (rozet uyumlulugu,
    # bkz. docs/superpowers/specs/2026-08-02-bot-mac-baslangic-bilgisi-kaydi-design.md).
    game = Game(
        type=GameType.bot,
        white_child_id=child.id,
        black_bot_level=payload.skill_level,
        student_color=payload.student_color,
        start_fen=payload.start_fen,
        base_ms=base_ms,
        increment_ms=payload.tc_increment_seconds * 1000 if base_ms is not None else 0,
        white_ms=base_ms,
        black_ms=base_ms,
        last_clock_at=datetime.utcnow() if base_ms is not None else None,
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return StartBotGameResponse(
        game_id=game.id,
        fen=payload.start_fen or INITIAL_FEN,
        your_color="white" if payload.student_color == "w" else "black",
    )


async def _current_fen(db: AsyncSession, game_id: int) -> str:
    last = (await db.execute(
        select(GameMove).where(GameMove.game_id == game_id)
        .order_by(GameMove.ply.desc()).limit(1)
    )).scalar_one_or_none()
    if last:
        return last.fen_after
    # Hamle yoksa macin KENDI baslangic konumu (acilis pratigi); yoksa
    # standart. AYNI mantik live_game.py::_current_fen_and_ply'de kullanilir.
    game = await db.get(Game, game_id)
    return game.start_fen if game and game.start_fen else INITIAL_FEN


async def _next_ply(db: AsyncSession, game_id: int) -> int:
    last = (await db.execute(
        select(GameMove).where(GameMove.game_id == game_id)
        .order_by(GameMove.ply.desc()).limit(1)
    )).scalar_one_or_none()
    return (last.ply + 1) if last else 1


@router.post("/{game_id}/move", response_model=MoveResponse)
async def make_move(
    game_id: int,
    payload: MakeMoveRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    game = await db.get(Game, game_id)
    if not game or game.status != GameStatus.active:
        raise HTTPException(status_code=400, detail="Game not active")

    # YETKI: yalnizca oyunun katilimcisi hamle yazabilir. Yoksa herhangi bir
    # cocuk game_id tahmin ederek baskasinin oyununa hamle ekleyebilir (IDOR).
    if child.id not in (game.white_child_id, game.black_child_id):
        raise HTTPException(status_code=403, detail="Not your game")

    current_fen = await _current_fen(db, game_id)
    result = validate_move(current_fen, payload.move_uci)
    if not result:
        return MoveResponse(accepted=False, game_status=game.status, result=game.result)

    ply = await _next_ply(db, game_id)
    db.add(GameMove(
        game_id=game_id, ply=ply, san=result["san"],
        fen_after=result["fen_after"], by_child_id=child.id,
    ))

    # Determine if it was white's move (child) by checking the FEN we moved FROM
    was_white_move = current_fen.split()[1] == "w"

    if result["is_game_over"]:
        game.status = GameStatus.finished
        if result["is_checkmate"]:
            # Whoever just moved wins
            game.result = GameResult.white_wins if was_white_move else GameResult.black_wins
            # Award badges/XP only if the CHILD (white) delivered mate
            if was_white_move and child.id == game.white_child_id:
                await evaluate_event(db, child.id, BadgeEvent(type="first_mate"))
                await add_xp(db, child.id, "bot_win")
                await evaluate_event(db, child.id, BadgeEvent(type="bot_win"))
        else:
            game.result = GameResult.draw

    await db.commit()

    if result["is_game_over"]:
        await log_activity(db, child.id, games=1)

    return MoveResponse(
        accepted=True,
        fen_after=result["fen_after"],
        is_checkmate=result["is_checkmate"],
        is_stalemate=result["is_stalemate"],
        game_status=game.status,
        result=game.result,
    )


@router.get("/{game_id}")
async def game_detail(
    game_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404)
    # YETKI: yalnizca oyunun katilimcisi detayini gorebilir. Auth'suz erisim
    # cocuk ID'lerini sirayla sizdiriyordu.
    if child.id not in (game.white_child_id, game.black_child_id):
        raise HTTPException(status_code=403, detail="Not your game")
    return {
        "id": game.id, "type": game.type.value, "status": game.status.value,
        "white_child_id": game.white_child_id, "black_child_id": game.black_child_id,
        "result": game.result.value if game.result else None,
    }

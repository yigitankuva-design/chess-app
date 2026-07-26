import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.services.jwt import decode_token, TokenInvalid
from chess_api.services.matchmaking import find_match, leave_queue
from chess_api.services.game_room import get_room, remove_room
from chess_api.services.game_validation import validate_move
from chess_api.services.badge_engine import evaluate_event, BadgeEvent
from chess_api.services.rank_engine import add_xp
from chess_api.models import (
    Game, GameMove, GameType, GameStatus, GameResult, ChildProfile,
)

logger = logging.getLogger(__name__)
router = APIRouter()

INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def _child_id_from_token(token: str) -> int | None:
    try:
        payload = decode_token(token)
    except TokenInvalid:
        return None
    return payload.get("child_profile_id")


async def _create_human_game(white_child_id: int, black_child_id: int) -> int:
    async with get_session_factory()() as db:
        game = Game(
            type=GameType.human,
            white_child_id=white_child_id,
            black_child_id=black_child_id,
            status=GameStatus.active,
        )
        db.add(game)
        await db.commit()
        await db.refresh(game)
        return game.id


@router.websocket("/ws/queue")
async def queue_ws(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    child_id = _child_id_from_token(token)
    if not child_id:
        await websocket.send_json({"type": "error", "message": "auth"})
        await websocket.close(code=4401)
        return

    # Tell client we're searching
    await websocket.send_json({"type": "waiting"})

    rating = 800  # TODO: read from ChildRank in a later iteration
    try:
        ticket = await find_match(child_id, rating, _create_human_game, wait_timeout=60.0)
        if ticket.game_id is not None:
            await websocket.send_json({
                "type": "matched",
                "game_id": ticket.game_id,
                "color": ticket.color,
                "opponent_id": ticket.opponent_id,
            })
        else:
            await websocket.send_json({"type": "timeout"})
    except WebSocketDisconnect:
        await leave_queue(child_id)
    except Exception:
        logger.exception("queue_ws error")
        await leave_queue(child_id)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


async def _current_fen_and_ply(db, game_id: int) -> tuple[str, int]:
    last = (await db.execute(
        select(GameMove).where(GameMove.game_id == game_id)
        .order_by(GameMove.ply.desc()).limit(1)
    )).scalar_one_or_none()
    if last:
        return last.fen_after, last.ply + 1
    return INITIAL_FEN, 1


@router.websocket("/ws/game/{game_id}")
async def game_ws(websocket: WebSocket, game_id: int, token: str = Query(...)):
    await websocket.accept()
    child_id = _child_id_from_token(token)
    if not child_id:
        await websocket.close(code=4403)
        return

    # Verify the child is a participant
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or child_id not in (game.white_child_id, game.black_child_id):
            await websocket.close(code=4403)
            return
        white_id = game.white_child_id
        black_id = game.black_child_id

    room = get_room(game_id)
    room.join(child_id, websocket)
    await room.broadcast({"type": "player_joined", "child_id": child_id})

    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            if mtype == "move":
                await _handle_move(game_id, child_id, white_id, black_id, msg, room)
            elif mtype == "resign":
                await _handle_resign(game_id, child_id, white_id, black_id, room)
            elif mtype == "offer_draw":
                await _handle_offer_draw(game_id, child_id, white_id, room)
            elif mtype == "decline_draw":
                await _handle_decline_draw(game_id, child_id, room)
            elif mtype == "accept_draw":
                await _handle_draw(game_id, room)
    except WebSocketDisconnect:
        room.leave(child_id)
        await room.broadcast({"type": "opponent_disconnected", "child_id": child_id})
    except Exception:
        logger.exception("game_ws error")
        room.leave(child_id)


async def _handle_move(game_id, child_id, white_id, black_id, msg, room):
    uci = msg.get("uci", "")
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        current_fen, ply = await _current_fen_and_ply(db, game_id)

        # Turn check
        whites_turn = current_fen.split()[1] == "w"
        if whites_turn and child_id != white_id:
            await room.send_to(child_id, {"type": "error", "message": "not_your_turn"})
            return
        if not whites_turn and child_id != black_id:
            await room.send_to(child_id, {"type": "error", "message": "not_your_turn"})
            return

        result = validate_move(current_fen, uci)
        if not result:
            await room.send_to(child_id, {"type": "invalid_move"})
            return

        db.add(GameMove(
            game_id=game_id, ply=ply, san=result["san"],
            fen_after=result["fen_after"], by_child_id=child_id,
        ))

        winner_id = None
        if result["is_checkmate"]:
            game.status = GameStatus.finished
            game.result = GameResult.white_wins if whites_turn else GameResult.black_wins
            winner_id = child_id
        elif result["is_stalemate"]:
            game.status = GameStatus.finished
            game.result = GameResult.draw

        await db.commit()

        # Award XP/badges to the human winner
        if winner_id is not None:
            try:
                await add_xp(db, winner_id, "human_win")
                await evaluate_event(db, winner_id, BadgeEvent(type="human_win"))
            except Exception:
                logger.exception("award after human win failed")

    await room.broadcast({
        "type": "move_made",
        "uci": uci,
        "san": result["san"],
        "fen_after": result["fen_after"],
        "is_checkmate": result["is_checkmate"],
        "is_stalemate": result["is_stalemate"],
        "by_child_id": child_id,
    })

    # Mat/pat da bir SONUCtur — frontend'in sonuc bildirimi (1-0 / 0-1 /
    # 1/2-1/2) game_over mesajina bagli, bu yuzden burada da yayinlanir.
    if result["is_checkmate"] or result["is_stalemate"]:
        async with get_session_factory()() as db:
            finished = await db.get(Game, game_id)
            final = finished.result.value if finished and finished.result else None
        if final:
            await room.broadcast({"type": "game_over", "result": final, "by_resign": False})


async def _handle_resign(game_id, child_id, white_id, black_id, room):
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        game.status = GameStatus.finished
        game.result = GameResult.black_wins if child_id == white_id else GameResult.white_wins
        await db.commit()
    await room.broadcast({"type": "game_over", "result": game.result.value, "by_resign": True})


async def _handle_draw(game_id, room):
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        game.status = GameStatus.finished
        game.result = GameResult.draw
        await db.commit()
    await room.broadcast({"type": "game_over", "result": "1/2-1/2"})


MAX_DRAW_OFFERS = 3


async def _handle_offer_draw(game_id, child_id, white_id, room):
    """Beraberlik teklifi (madde d). Oyuncu basina en fazla 3 teklif."""
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        is_white = child_id == white_id
        used = game.white_draw_offers if is_white else game.black_draw_offers
        if used >= MAX_DRAW_OFFERS:
            await room.send_to(child_id, {
                "type": "draw_offer_rejected", "reason": "limit",
                "max_offers": MAX_DRAW_OFFERS,
            })
            return
        if is_white:
            game.white_draw_offers = used + 1
        else:
            game.black_draw_offers = used + 1
        offers_used = used + 1
        await db.commit()

    await room.send_to(child_id, {"type": "draw_offer_sent", "offers_used": offers_used})
    await room.broadcast({"type": "draw_offered", "by_child_id": child_id}, exclude=child_id)


async def _handle_decline_draw(game_id, child_id, room):
    """Beraberlik teklifini reddetme (madde d). Oyun DEVAM EDER."""
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
    await room.broadcast({"type": "draw_declined", "by_child_id": child_id}, exclude=child_id)

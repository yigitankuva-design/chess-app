import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.services.arena_matchmaking import find_arena_opponent, leave_arena_queue
from chess_api.services.tournaments import sync_tournament_status
from chess_api.routers.live_game import _child_id_from_token, _create_human_game
from chess_api.models import Tournament, TournamentStatus, TournamentParticipant, TournamentPairing

logger = logging.getLogger(__name__)
router = APIRouter()


async def _create_pairing_game(tournament_id: int, white_child_id: int, black_child_id: int) -> int:
    """Iki sporcu eslesince cagrilir: gercek Game'i (mevcut insan-insan mac
    akisiyla AYNI, bkz. live_game._create_human_game) ve ona bagli
    TournamentPairing satirini AYNI anda olusturur."""
    async with get_session_factory()() as db:
        t = await db.get(Tournament, tournament_id)
        game_id = await _create_human_game(
            white_child_id, black_child_id,
            base_ms=t.base_ms if t else None,
            increment_ms=t.increment_ms if t and t.increment_ms else 0,
            rated=t.rated if t else False,
            # "Başlangıç Konumu" (2026-09-06): tum eslesmeler AYNI FEN'den
            # baslar — hoca/sporcu belirli bir acilis/varyanti tema secebilsin.
            start_fen=t.start_fen if t else None,
        )
        db.add(TournamentPairing(
            tournament_id=tournament_id,
            white_child_id=white_child_id, black_child_id=black_child_id,
            game_id=game_id,
        ))
        await db.commit()
        return game_id


@router.websocket("/ws/tournament/{tournament_id}/queue")
async def tournament_queue_ws(websocket: WebSocket, tournament_id: int, token: str = Query(...)):
    """Sporcu turnuva sayfasini actigi surece bu baglanti uzerinden 'bosum'
    sinyali verir; ANINDA turnuva puanina en yakin rakiple eslesir (Lichess
    Arena modeli — bkz. services/arena_matchmaking.py). Mac bitip sayfaya
    donunce frontend YENIDEN baglanir (basit reconnect, bkz. /ws/queue)."""
    await websocket.accept()
    child_id = _child_id_from_token(token)
    if not child_id:
        await websocket.send_json({"type": "error", "message": "auth"})
        await websocket.close(code=4401)
        return

    async with get_session_factory()() as db:
        t = await db.get(Tournament, tournament_id)
        if not t:
            await websocket.send_json({"type": "error", "message": "not_active"})
            await websocket.close(code=4404)
            return
        # Lazy senkron: DB'de hâlâ "active" görünse bile süresi gerçekte
        # dolmuş olabilir (madde 2026-09-09 (6)) — burada da tetiklenir,
        # yoksa süresi dolmuş turnuvaya kuyruğa girilebilirdi.
        await sync_tournament_status(db, t)
        if t.status == TournamentStatus.finished:
            await websocket.send_json({"type": "error", "message": "not_active"})
            await websocket.close(code=4404)
            return
        participant = (await db.execute(
            select(TournamentParticipant).where(
                TournamentParticipant.tournament_id == tournament_id,
                TournamentParticipant.child_id == child_id,
                TournamentParticipant.left_at.is_(None),
            )
        )).scalar_one_or_none()
        if participant is None:
            await websocket.send_json({"type": "error", "message": "not_joined"})
            await websocket.close(code=4403)
            return
        score = participant.score

    await websocket.send_json({"type": "waiting"})

    async def _create_game(white_id: int, black_id: int) -> int:
        return await _create_pairing_game(tournament_id, white_id, black_id)

    try:
        ticket = await find_arena_opponent(
            tournament_id, child_id, score, _create_game, wait_timeout=55.0,
        )
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
        await leave_arena_queue(tournament_id, child_id)
    except Exception:
        logger.exception("tournament_queue_ws error")
        await leave_arena_queue(tournament_id, child_id)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

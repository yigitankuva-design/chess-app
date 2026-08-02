import logging
import random
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.services.jwt import decode_token, TokenInvalid
from chess_api.services.matchmaking import find_match, leave_queue
from chess_api.services.game_room import get_room, remove_room
from chess_api.services.game_validation import validate_move
from chess_api.services.badge_engine import evaluate_event, BadgeEvent
from chess_api.services.rank_engine import add_xp
from chess_api.services.lobby import (
    join_lobby, leave_lobby, online_players, send_to_player, connected_ids,
)
from chess_api.services.offers import (
    create_offer, cancel_offer, list_offers, take_offer, my_offer,
)
from chess_api.services.offer_sides import resolve_sides
from chess_api.services.clock import ClockState, apply_move, is_flagged
from chess_api.dependencies.auth import get_current_child
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


async def _create_human_game(white_child_id: int, black_child_id: int,
                             base_ms: int | None = None,
                             increment_ms: int | None = None,
                             start_fen: str | None = None) -> int:
    """Insan-insan mac kaydi.

    base_ms verilirse saat de kurulur. Varsayilanlar None oldugu icin mevcut
    cagiranlar (kuyruk akisi) aynen calisir — saatsiz mac acilir.
    """
    async with get_session_factory()() as db:
        game = Game(
            type=GameType.human,
            white_child_id=white_child_id,
            black_child_id=black_child_id,
            status=GameStatus.active,
            base_ms=base_ms,
            increment_ms=increment_ms,
            white_ms=base_ms,
            black_ms=base_ms,
            last_clock_at=datetime.utcnow() if base_ms is not None else None,
            start_fen=start_fen,
        )
        db.add(game)
        await db.commit()
        await db.refresh(game)
        return game.id


def _epoch(dt: datetime) -> float:
    """Naive UTC datetime -> epoch saniye. Veritabanina datetime.utcnow() ile
    yaziliyor (naive), bu yuzden UTC oldugu ACIKCA soylenir."""
    return dt.replace(tzinfo=timezone.utc).timestamp()


def _clock_state(game: Game) -> ClockState | None:
    """Macin saat durumu; saatsiz macta None."""
    if game.base_ms is None or game.last_clock_at is None:
        return None
    return ClockState(
        white_ms=game.white_ms or 0,
        black_ms=game.black_ms or 0,
        last_at=_epoch(game.last_clock_at),
        increment_ms=game.increment_ms or 0,
    )


async def _apply_clock_on_move(db, game: Game, white_to_move: bool) -> bool:
    """Hamlede saati isler. Sure bittiyse True doner (hamle islenmemeli).

    Saatsiz macta hicbir sey yapmaz ve False doner.
    """
    st = _clock_state(game)
    if st is None:
        return False
    now = datetime.utcnow()
    if is_flagged(st, white_to_move, _epoch(now)):
        return True
    new = apply_move(st, white_to_move, _epoch(now))
    game.white_ms = new.white_ms
    game.black_ms = new.black_ms
    game.last_clock_at = now
    await db.commit()
    return False


def _clock_payload(game: Game, white_to_move: bool) -> dict:
    return {
        "type": "clock",
        "white_ms": game.white_ms,
        "black_ms": game.black_ms,
        "white_to_move": white_to_move,
    }


@router.websocket("/ws/queue")
async def queue_ws(websocket: WebSocket, token: str = Query(...),
                   tc_base: int | None = Query(None),
                   tc_increment: int = Query(0)):
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
        ticket = await find_match(
            child_id, rating, _create_human_game, wait_timeout=60.0,
            tc_base=tc_base if tc_base and tc_base > 0 else None,
            tc_increment=tc_increment if tc_increment > 0 else 0,
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
    # Hamle yoksa macin KENDI baslangic konumu (acilis pratigi); yoksa standart.
    game = await db.get(Game, game_id)
    return (game.start_fen if game and game.start_fen else INITIAL_FEN), 1


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
    conn_id = room.join(child_id, websocket)
    await room.broadcast({"type": "player_joined", "child_id": child_id})

    # Katilana macin kimlik ve saat bilgisi — isimler burada gider.
    async with get_session_factory()() as db:
        g = await db.get(Game, game_id)
        w = await db.get(ChildProfile, g.white_child_id) if g.white_child_id else None
        b = await db.get(ChildProfile, g.black_child_id) if g.black_child_id else None
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        # Yeniden baglanan sporcu notasyon listesini bastan gorur.
        past = (await db.execute(
            select(GameMove).where(GameMove.game_id == game_id)
            .order_by(GameMove.ply.asc())
        )).scalars().all()
        await websocket.send_json({
            "type": "game_info",
            "white_name": w.display_name if w else "Sporcu",
            "black_name": b.display_name if b else "Sporcu",
            "white_ms": g.white_ms,
            "black_ms": g.black_ms,
            "increment_ms": g.increment_ms,
            "white_to_move": current_fen.split()[1] == "w",
            "start_fen": g.start_fen,
            "moves": [m.san for m in past],
            "current_fen": current_fen,
            # Bitmis maca yeniden baglanan sporcu bunu GORMELI; yoksa ekran
            # canli mac gibi durur ve hamle denemesi sessizce bosa gider.
            "status": g.status.value,
            "result": g.result.value if g.result else None,
        })

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
            elif mtype == "flag":
                await _handle_flag(game_id, room)
    except WebSocketDisconnect:
        room.leave(child_id, conn_id)
        await room.broadcast({"type": "opponent_disconnected", "child_id": child_id})
    except Exception:
        logger.exception("game_ws error")
        room.leave(child_id, conn_id)


async def _handle_move(game_id, child_id, white_id, black_id, msg, room):
    uci = msg.get("uci", "")
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        current_fen, ply = await _current_fen_and_ply(db, game_id)

        # Turn check
        whites_turn = current_fen.split()[1] == "w"
        # Reddedilen hamlede istemci kendi tahtasini GERI ALABILSIN diye
        # otorite konum mesaja eklenir; yoksa istemci sunucudan kopar ve
        # sporcu bir daha hamle yapamaz.
        if whites_turn and child_id != white_id:
            await room.send_to(child_id, {
                "type": "error", "message": "not_your_turn", "fen": current_fen,
            })
            return
        if not whites_turn and child_id != black_id:
            await room.send_to(child_id, {
                "type": "error", "message": "not_your_turn", "fen": current_fen,
            })
            return

        # (1) Sure bittiyse hamle HIC islenmez, mac kapanir.
        _st = _clock_state(game)
        if _st is not None and is_flagged(_st, whites_turn, _epoch(datetime.utcnow())):
            game.status = GameStatus.finished
            game.result = GameResult.black_wins if whites_turn else GameResult.white_wins
            game.finished_at = datetime.utcnow()
            await db.commit()
            await room.broadcast({
                "type": "game_over",
                "result": game.result.value,
                "by_resign": False,
                "by_flag": True,
            })
            return

        result = validate_move(current_fen, uci)
        if not result:
            await room.send_to(child_id, {"type": "invalid_move", "fen": current_fen})
            return

        # (2) Hamle GECERLI — saati simdi islet. Artirim yalnizca gercek
        # hamleye verilir; gecersiz hamle denemeleri sure kazandirmaz.
        await _apply_clock_on_move(db, game, whites_turn)

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

    # Hamle sonrasi guncel saat (saatsiz macta bu blok atlanir).
    async with get_session_factory()() as db2:
        fresh = await db2.get(Game, game_id)
        if fresh and fresh.base_ms is not None:
            await room.broadcast(
                _clock_payload(fresh, result["fen_after"].split()[1] == "w")
            )

    # Mat/pat da bir SONUCtur — frontend'in sonuc bildirimi (1-0 / 0-1 /
    # 1/2-1/2) game_over mesajina bagli, bu yuzden burada da yayinlanir.
    if result["is_checkmate"] or result["is_stalemate"]:
        async with get_session_factory()() as db:
            finished = await db.get(Game, game_id)
            final = finished.result.value if finished and finished.result else None
        if final:
            await room.broadcast({"type": "game_over", "result": final, "by_resign": False})


async def _handle_flag(game_id: int, room) -> None:
    """'Rakibimin suresi bitti' iddiasi. SUNUCU KENDI HESABIYLA DOGRULAR;
    tutmazsa hicbir sey yapilmaz (sessiz). Istemciye asla guvenilmez."""
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        st = _clock_state(game)
        if st is None:
            return
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        white_to_move = current_fen.split()[1] == "w"
        if not is_flagged(st, white_to_move, _epoch(datetime.utcnow())):
            return  # sahte iddia
        game.status = GameStatus.finished
        game.result = GameResult.black_wins if white_to_move else GameResult.white_wins
        game.finished_at = datetime.utcnow()
        await db.commit()
        final = game.result.value
    await room.broadcast({
        "type": "game_over", "result": final, "by_resign": False, "by_flag": True,
    })


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


@router.get("/lobby/online")
async def lobby_online(child: ChildProfile = Depends(get_current_child)):
    """Ilk yuklemede aktif sporcu listesi; canli guncelleme WS uzerinden gelir."""
    return {"players": online_players(exclude=child.id)}


async def _resolve_display_name(child_id: int) -> str:
    async with get_session_factory()() as db:
        child = await db.get(ChildProfile, child_id)
        return child.display_name if child else "Sporcu"


async def _handle_challenge(child_id: int, msg: dict) -> None:
    """Belirli bir sporcuya mac daveti (madde b)."""
    target = msg.get("target_child_id")
    if not isinstance(target, int):
        return
    name = await _resolve_display_name(child_id)
    await send_to_player(target, {
        "type": "challenge_received",
        "from_child_id": child_id,
        "from_name": name,
        "criteria": msg.get("criteria") or {},
    })


async def _handle_challenge_accept(child_id: int, msg: dict) -> None:
    """Daveti kabul et: oyunu olustur ve iki tarafa da bildir.

    RENGI DAVET EDEN (challenger) belirler; kabul eden sadece onu alir.
    criteria.color: 'w' => challenger beyaz, 'b' => challenger siyah.
    """
    challenger = msg.get("from_child_id")
    if not isinstance(challenger, int):
        return
    criteria = msg.get("criteria") or {}
    challenger_is_white = criteria.get("color", "w") == "w"
    white_id = challenger if challenger_is_white else child_id
    black_id = child_id if challenger_is_white else challenger

    base_s = criteria.get("tc_base")
    inc_s = criteria.get("tc_increment")
    # Acilis pratiginden gelen davetlerde tahta o acilisin konumundan baslar.
    start_fen = criteria.get("start_fen")
    game_id = await _create_human_game(
        white_id, black_id,
        base_ms=int(base_s) * 1000 if isinstance(base_s, int) and base_s > 0 else None,
        increment_ms=int(inc_s) * 1000 if isinstance(inc_s, int) else 0,
        start_fen=start_fen if isinstance(start_fen, str) and start_fen else None,
    )

    await send_to_player(challenger, {
        "type": "matched", "game_id": game_id,
        "color": "white" if challenger_is_white else "black",
        "opponent_id": child_id,
    })
    await send_to_player(child_id, {
        "type": "matched", "game_id": game_id,
        "color": "black" if challenger_is_white else "white",
        "opponent_id": challenger,
    })


async def _handle_challenge_decline(child_id: int, msg: dict) -> None:
    challenger = msg.get("from_child_id")
    if isinstance(challenger, int):
        await send_to_player(challenger, {
            "type": "challenge_declined", "by_child_id": child_id,
        })


async def _broadcast_offers() -> None:
    """Panoyu lobideki HERKESE gonderir.

    Her sporcu KENDI teklifi HARIC listeyi gorur (offers) + varsa KENDI
    teklifini ayri alanda gorur (my_offer) — "Teklifin panoda" satiri icin.

    send_to_player kopmus sokette sessizce False dondurdugu icin ayri hata
    yonetimi gerekmez (mevcut davranis).
    """
    for cid in connected_ids():
        await send_to_player(cid, {
            "type": "offers",
            "offers": list_offers(exclude=cid),
            "my_offer": my_offer(cid),
        })


async def _handle_offer_create(child_id: int, msg: dict) -> None:
    name = await _resolve_display_name(child_id)
    try:
        create_offer(
            child_id=child_id,
            display_name=name,
            tempo=str(msg.get("tempo") or ""),
            tc_label=str(msg.get("tc_label") or ""),
            tc_base=int(msg.get("tc_base") or 0),
            tc_increment=int(msg.get("tc_increment") or 0),
            color=str(msg.get("color") or "random"),
        )
    except (ValueError, TypeError):
        return  # gecersiz teklif sessizce yok sayilir; pano degismez
    await _broadcast_offers()


async def _handle_offer_cancel(child_id: int) -> None:
    cancel_offer(child_id)
    await _broadcast_offers()


async def _handle_offer_take(child_id: int, msg: dict) -> None:
    """Panodan teklif alma. Teklif cekilemezse basana offer_gone doner."""
    owner = msg.get("child_id")
    if not isinstance(owner, int) or owner == child_id:
        await send_to_player(child_id, {"type": "offer_gone"})
        return

    offer = take_offer(owner)
    if offer is None:
        await send_to_player(child_id, {"type": "offer_gone"})
        return
    if owner not in connected_ids():
        # Teklif sahibi tam bu sirada koptu; teklif zaten cekildi.
        await send_to_player(child_id, {"type": "offer_gone"})
        await _broadcast_offers()
        return

    white_id, black_id = resolve_sides(
        offer["color"], owner, child_id, coin=random.random() < 0.5,
    )
    # Teklifteki tempo saniye cinsinden; saat ms ile calisir.
    # tc_base = 0 => saatsiz mac (or None). tc_increment 0 GECERLI bir degerdir.
    _base = int(offer.get("tc_base") or 0)
    game_id = await _create_human_game(
        white_id, black_id,
        base_ms=_base * 1000 if _base > 0 else None,
        increment_ms=int(offer.get("tc_increment") or 0) * 1000,
    )

    await send_to_player(owner, {
        "type": "matched", "game_id": game_id,
        "color": "white" if white_id == owner else "black",
        "opponent_id": child_id,
    })
    await send_to_player(child_id, {
        "type": "matched", "game_id": game_id,
        "color": "white" if white_id == child_id else "black",
        "opponent_id": owner,
    })
    await _broadcast_offers()


@router.websocket("/ws/lobby")
async def lobby_ws(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    child_id = _child_id_from_token(token)
    if not child_id:
        await websocket.send_json({"type": "error", "message": "auth"})
        await websocket.close(code=4401)
        return

    name = await _resolve_display_name(child_id)
    join_lobby(child_id, name, websocket)
    await websocket.send_json({
        "type": "lobby_joined",
        "players": online_players(exclude=child_id),
        "offers": list_offers(exclude=child_id),
        "my_offer": my_offer(child_id),
    })

    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            if mtype == "challenge":
                await _handle_challenge(child_id, msg)
            elif mtype == "challenge_accept":
                await _handle_challenge_accept(child_id, msg)
            elif mtype == "challenge_decline":
                await _handle_challenge_decline(child_id, msg)
            elif mtype == "offer_create":
                await _handle_offer_create(child_id, msg)
            elif mtype == "offer_cancel":
                await _handle_offer_cancel(child_id)
            elif mtype == "offer_take":
                await _handle_offer_take(child_id, msg)
    except WebSocketDisconnect:
        leave_lobby(child_id)
        cancel_offer(child_id)
        await _broadcast_offers()
    except Exception:
        logger.exception("lobby_ws error")
        leave_lobby(child_id)
        cancel_offer(child_id)
        await _broadcast_offers()

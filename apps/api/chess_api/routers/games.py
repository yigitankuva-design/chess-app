from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import (
    ChildProfile, Game, GameMove, GameType, GameStatus, GameResult, OpeningVariant, Opening, GameAnalysis,
)
from chess_api.schemas.game import (
    StartBotGameRequest, StartBotGameResponse, MakeMoveRequest, MoveResponse,
)
from chess_api.services.game_validation import validate_move
from chess_api.services.badge_engine import evaluate_event, BadgeEvent
from chess_api.services.rank_engine import add_xp
from chess_api.services.activity_logger import log_activity
from chess_api.services.time_limit_check import check_time_limit
from chess_api.services.tempo import tempo_category

router = APIRouter(prefix="/games", tags=["games"])

INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def _tempo_label(base_ms: int | None, increment_ms: int | None) -> str | None:
    """Madde 2026-09-06 (8): "Maçlarımın Analizi" kartındaki "5+3(Yıldırım)"
    biçimi — süresiz maçta None döner."""
    if base_ms is None:
        return None
    base_min = round(base_ms / 60_000)
    inc_s = round((increment_ms or 0) / 1_000)
    category = tempo_category(base_ms, increment_ms)
    return f"{base_min}+{inc_s}({category})" if category else f"{base_min}+{inc_s}"


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
        # Madde 2026-09-11 (Madde 11): bot maçında sporcunun KENDİ adı da
        # nickname olsun (BotGame bunu cihazdaki gerçek isim yerine kullanır).
        player_name=child.public_name,
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


@router.get("")
async def list_my_games(
    limit: int = Query(default=20, ge=1, le=50),
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde: Analiz Et sekmesi — sporcunun BITMIS maclarini (en yeniden eskiye)
    listeler. Devam eden/iptal edilen maclar analiz icin anlamli degil, listelenmez."""
    games = (await db.execute(
        select(Game).where(
            Game.status == GameStatus.finished,
            or_(Game.white_child_id == child.id, Game.black_child_id == child.id),
        ).order_by(Game.started_at.desc()).limit(limit)
    )).scalars().all()

    out = []
    for game in games:
        if game.type == GameType.bot:
            opponent = {"type": "bot", "level": game.black_bot_level}
            # Madde 2026-09-11 (Madde 11): maçlarda nickname (yoksa gerçek isim).
            white_name = (await db.get(ChildProfile, game.white_child_id)).public_name if game.white_child_id else None
            black_name = f"Bot · Düzey {game.black_bot_level}" if game.black_bot_level is not None else "Bot"
        else:
            other_id = (
                game.black_child_id if game.white_child_id == child.id else game.white_child_id
            )
            other = await db.get(ChildProfile, other_id) if other_id else None
            opponent = {"type": "human", "name": other.public_name if other else None}
            white = await db.get(ChildProfile, game.white_child_id) if game.white_child_id else None
            black = await db.get(ChildProfile, game.black_child_id) if game.black_child_id else None
            white_name = white.public_name if white else None
            black_name = black.public_name if black else None

        # Madde 2026-09-06 (8): Açılış Pratiği'nden başlayan maçlarda (start_fen
        # bilinen bir OpeningVariant'a eşleşiyorsa) açılış/varyant ismi —
        # serbest/sıfırdan başlayan maçlarda İKİSİ DE null kalır (kapsam
        # dışı bırakıldı, Zafer'e onaylatıldı).
        opening_name = None
        variant_name = None
        if game.start_fen:
            variant = (await db.execute(
                select(OpeningVariant).where(OpeningVariant.start_fen == game.start_fen)
            )).scalar_one_or_none()
            if variant:
                variant_name = variant.name
                opening = await db.get(Opening, variant.opening_id)
                opening_name = opening.name if opening else None

        out.append({
            "id": game.id, "type": game.type.value,
            "result": game.result.value if game.result else None,
            "student_color": game.student_color,
            "started_at": game.started_at.isoformat(),
            "finished_at": game.finished_at.isoformat() if game.finished_at else None,
            "opponent": opponent,
            # Acilis pratiginden baslayan maclarda ilk konum (ply 0) standart
            # baslangic DEGILDIR — Analiz Et ekraninin dogru gostermesi icin.
            "start_fen": game.start_fen,
            # Madde 2026-09-06 (8): "Maçlarımın Analizi" tam maç kartı.
            "white_name": white_name,
            "black_name": black_name,
            "rated": game.rated,
            # Madde 2026-09-06 (8): görseldeki "2095+6" biçimi — maç SONRASI
            # güncel puan + o maçtan kazanılan/kaybedilen fark.
            "white_rating_after": game.white_rating_after,
            "black_rating_after": game.black_rating_after,
            "white_rating_delta": (
                game.white_rating_after - game.white_rating_before
                if game.white_rating_after is not None and game.white_rating_before is not None else None
            ),
            "black_rating_delta": (
                game.black_rating_after - game.black_rating_before
                if game.black_rating_after is not None and game.black_rating_before is not None else None
            ),
            "tempo_label": _tempo_label(game.base_ms, game.increment_ms),
            "opening_name": opening_name,
            "variant_name": variant_name,
        })
    return out


@router.get("/{game_id}/moves")
async def game_moves(
    game_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde: Analiz Et sekmesi — bir macin tam hamle listesi (ply sirasina gore),
    sporcunun hamle hamle geri/ileri gidip motor analizi gorebilmesi icin."""
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404)
    # YETKI: game_detail ile AYNI desen — yalnizca katilimci gorebilir.
    if child.id not in (game.white_child_id, game.black_child_id):
        raise HTTPException(status_code=403, detail="Not your game")

    moves = (await db.execute(
        select(GameMove).where(GameMove.game_id == game_id).order_by(GameMove.ply.asc())
    )).scalars().all()
    return [{"ply": m.ply, "san": m.san, "fen_after": m.fen_after} for m in moves]


class MistakeMove(BaseModel):
    """Madde 2026-09-14 (3c): tek bir kusurlu/hata/vahim-hata hamle —
    'Hatalarını Gözden Geçir'in ürettiği MovePieceSolver egzersizinin
    girdisi (fen_before + best_move)."""
    ply: int
    fen_before: str
    played_san: str
    best_move: str
    cp_loss: int
    severity: str  # 'inaccuracy' | 'mistake' | 'blunder'


class SaveGameAnalysisRequest(BaseModel):
    """Madde 2026-09-14 (3b): apps/web/lib/chess/gameSummary.ts::GameSummary
    ile BİREBİR aynı alanlar — istemci motoru çalıştırıp hesapladıktan SONRA
    burayı çağırır, backend'de stockfish YOK."""
    inaccuracies: int
    mistakes: int
    blunders: int
    acpl: int | None = None
    accuracy: float | None = None
    phase_accuracy_opening: float | None = None
    phase_accuracy_middlegame: float | None = None
    phase_accuracy_endgame: float | None = None
    mistake_moves: list[MistakeMove] = []


async def _get_own_game(game_id: int, child: ChildProfile, db: AsyncSession) -> Game:
    """game_detail/game_moves ile AYNI sahiplik deseni — analiz uçlarının
    ikisi de bunu kullanır."""
    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404)
    if child.id not in (game.white_child_id, game.black_child_id):
        raise HTTPException(status_code=403, detail="Not your game")
    return game


@router.post("/{game_id}/analysis", status_code=200)
async def save_game_analysis(
    game_id: int,
    payload: SaveGameAnalysisRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-14 (3b/4): 'Analiz Et' özetini kaydeder (upsert) — aynı
    maç ikinci kez açıldığında (Maçlarımın Analizi) motor baştan çalışmasın
    diye. mistake_moves 3c'nin pratik egzersizleri için ayrıca saklanır."""
    await _get_own_game(game_id, child, db)
    existing = (await db.execute(
        select(GameAnalysis).where(GameAnalysis.game_id == game_id)
    )).scalar_one_or_none()
    mistake_moves_json = [m.model_dump() for m in payload.mistake_moves]
    if existing is None:
        existing = GameAnalysis(game_id=game_id, inaccuracies=0, mistakes=0, blunders=0)
        db.add(existing)
    existing.inaccuracies = payload.inaccuracies
    existing.mistakes = payload.mistakes
    existing.blunders = payload.blunders
    existing.acpl = payload.acpl
    existing.accuracy = payload.accuracy
    existing.phase_accuracy_opening = payload.phase_accuracy_opening
    existing.phase_accuracy_middlegame = payload.phase_accuracy_middlegame
    existing.phase_accuracy_endgame = payload.phase_accuracy_endgame
    existing.mistake_moves_json = mistake_moves_json
    await db.commit()
    return {"ok": True}


@router.get("/{game_id}/analysis")
async def get_game_analysis(
    game_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-14 (3b/4): daha önce kaydedilmiş özet varsa döner —
    motor ÇALIŞTIRMAZ. Yoksa 404 (frontend bu durumda İSTEMCİDE hesaplayıp
    sonra POST /analysis ile kaydeder — geriye dönük uyum)."""
    await _get_own_game(game_id, child, db)
    analysis = (await db.execute(
        select(GameAnalysis).where(GameAnalysis.game_id == game_id)
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not computed yet")
    return {
        "inaccuracies": analysis.inaccuracies,
        "mistakes": analysis.mistakes,
        "blunders": analysis.blunders,
        "acpl": analysis.acpl,
        "accuracy": analysis.accuracy,
        "phase_accuracy": {
            "opening": analysis.phase_accuracy_opening,
            "middlegame": analysis.phase_accuracy_middlegame,
            "endgame": analysis.phase_accuracy_endgame,
        },
        "mistake_moves": analysis.mistake_moves_json,
    }

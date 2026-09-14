"""Sunucu tarafında tam maç analizi — native Stockfish.

Madde 2026-09-14 (sunucu analiz motoru): "Analiz Et" / "Maçlarımın
Analizi" / "Hatalarını Gözden Geçir" için gereken TÜM hesaplama artık
burada, backend'de native (WASM DEĞİL) bir Stockfish süreciyle yapılıyor
— istemci motoru cihaza bağımlıydı (zayıf tablet/telefon = yavaş VE sığ
analiz), bu modül hem hızı hem doğruluğu Railway'in tutarlı CPU'suyla
garanti eder. Mimari: maç başına TEK bir motor süreci açılır
(`bot_engine.py`'nin her hamlede ayrı süreç açan deseninin AKSİNE — burada
N pozisyon için N kere süreç başlatmak gereksiz maliyet olurdu), ply 0..N
sırayla `engine.analyse()` ile değerlendirilir, süreç kapatılır.

Hesaplama mantığı `apps/web/lib/chess/gameSummary.ts::computeGameSummary`
ile BİREBİR aynı olacak şekilde buraya taşındı (sabitler dahil) — biri
değişirse İKİSİ de güncellenmeli. `apps/web/lib/chess/moveQuality.ts`
DEĞİŞMEDİ; bu modül sadece onun ihtiyaç duyduğu ham {cp, mate} verisini
(HER ply için, sadece sporcunun değil) üretip saklıyor.
"""
import asyncio
import logging
import math

import chess
import chess.engine
from sqlalchemy import select

from chess_api.database import get_session_factory
from chess_api.models import Game, GameAnalysis, GameMove
from chess_api.settings import settings

logger = logging.getLogger(__name__)

INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

# --- apps/web/lib/chess/gameSummary.ts ile BİREBİR aynı sabitler ---
INACCURACY_CP = 50
MISTAKE_CP = 100
BLUNDER_CP = 300
ACPL_CAP_CP = 1000
OPENING_PLY_LIMIT = 20
ENDGAME_MATERIAL_THRESHOLD = 13
PIECE_VALUE = {"n": 3, "b": 3, "r": 5, "q": 9}
MATE_BASE_CP = 100_000

# Aynı maç için ikinci bir arka plan işi başlatılmasını önler (asyncio tek
# thread'li olduğu için await'siz kontrol+ekleme atomiktir — bkz.
# services/matchmaking.py'deki AYNI modül-seviyesi singleton deseni).
_in_flight: set[int] = set()
# asyncio.create_task()'ın kendi dokümantasyonundaki bilinen tuzak: task'a
# GÜÇLÜ bir referans tutulmazsa, henüz bitmeden çöp toplayıcı tarafından
# yok edilebilir (sessizce, hata bile vermeden). Bu set o referansı tutar.
_background_tasks: set[asyncio.Task] = set()
# Sunucu genelinde aynı anda çalışabilecek analiz sayısını sınırlar —
# Railway kaynakları paylaşımlı, sınırsız eşzamanlı motor süreci CPU'yu
# boğar.
_engine_semaphore = asyncio.Semaphore(settings().ANALYSIS_CONCURRENCY)


def _non_pawn_material(fen: str) -> int:
    board_field = fen.strip().split()[0]
    return sum(PIECE_VALUE.get(ch.lower(), 0) for ch in board_field)


def _game_phase(ply: int, fen_after: str) -> str:
    if ply <= OPENING_PLY_LIMIT:
        return "opening"
    if _non_pawn_material(fen_after) <= ENDGAME_MATERIAL_THRESHOLD:
        return "endgame"
    return "middlegame"


def _mate_to_cp(mate: int) -> int:
    sign = (mate > 0) - (mate < 0)
    return sign * (MATE_BASE_CP - abs(mate) * 100)


def _effective_cp(cp: int | None, mate: int | None) -> int | None:
    if mate is not None:
        return _mate_to_cp(mate)
    return cp


def _for_side(cp_white: int, side: str) -> int:
    return cp_white if side == "w" else -cp_white


def _win_percent(cp: float) -> float:
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def _move_accuracy_from_win_drop(win_pct_drop: float) -> float:
    drop = max(0.0, win_pct_drop)
    acc = 103.1668 * math.exp(-0.04354 * drop) - 3.1669
    return min(100.0, max(0.0, acc))


def _classify_delta(cp_loss: int) -> str | None:
    if cp_loss >= BLUNDER_CP:
        return "blunder"
    if cp_loss >= MISTAKE_CP:
        return "mistake"
    if cp_loss >= INACCURACY_CP:
        return "inaccuracy"
    return None


async def _run_full_analysis(fens: list[str]) -> tuple[list[dict], dict[int, str]]:
    """`fens[i]` = i. ply'ın pozisyonu (fens[0] = başlangıç). Testlerde bu
    fonksiyon doğrudan monkeypatch'lenir (bkz. `test_bot_engine.py`'deki
    `get_bot_move` deseni) — gerçek `stockfish` binary'si gerekmeden."""
    limit = chess.engine.Limit(
        depth=settings().ANALYSIS_DEPTH,
        time=settings().ANALYSIS_MOVETIME_MS / 1000,
    )
    _, engine = await chess.engine.popen_uci(settings().STOCKFISH_PATH)
    eval_by_ply: list[dict] = []
    best_move_by_ply: dict[int, str] = {}
    try:
        await engine.configure({
            "Threads": settings().ANALYSIS_THREADS,
            "Hash": settings().ANALYSIS_HASH_MB,
        })
        for ply, fen in enumerate(fens):
            board = chess.Board(fen)
            # Son ply mat/pat ise (oyun bitmiş bir pozisyon) oynanacak hamle
            # yok — motor sorulmaz, bu ply'ın eval'i boş kalır (computeGameSummary
            # ile AYNI "eksik ply sessizce atlanır" sözleşmesi, gameSummary.ts'teki
            # yorumla tutarlı).
            if board.is_game_over():
                eval_by_ply.append({"ply": ply, "cp": None, "mate": None})
                continue
            info = await engine.analyse(board, limit)
            score = info["score"].white()
            if score.is_mate():
                cp, mate = None, score.mate()
            else:
                cp, mate = score.score(), None
            eval_by_ply.append({"ply": ply, "cp": cp, "mate": mate})
            pv = info.get("pv")
            if pv:
                best_move_by_ply[ply] = pv[0].uci()
    finally:
        await engine.quit()
    return eval_by_ply, best_move_by_ply


def _compute_summary(
    eval_by_ply: list[dict],
    fens: list[str],
    student_color: str,
    san_history: list[str],
    best_move_by_ply: dict[int, str],
) -> dict:
    """`apps/web/lib/chess/gameSummary.ts::computeGameSummary` ile BİREBİR
    aynı mantık — bkz. o dosyadaki yorumlar için kaynak formüllerin
    referansları (Lichess'in kamuya açık kazanma-yüzdesi eğrisi vb.)."""
    eval_map = {e["ply"]: e for e in eval_by_ply}
    start_turn = "b" if fens[0].split()[1] == "b" else "w"

    inaccuracies = mistakes = blunders = 0
    cp_losses: list[int] = []
    move_accs: list[float] = []
    by_phase: dict[str, list[float]] = {"opening": [], "middlegame": [], "endgame": []}
    mistake_moves: list[dict] = []

    for ply in range(1, len(fens)):
        mover = start_turn if ply % 2 == 1 else ("b" if start_turn == "w" else "w")
        if mover != student_color:
            continue

        before = eval_map.get(ply - 1)
        after = eval_map.get(ply)
        if not before or not after:
            continue

        before_cp = _effective_cp(before["cp"], before["mate"])
        after_cp = _effective_cp(after["cp"], after["mate"])
        if before_cp is None or after_cp is None:
            continue

        before_for_student = _for_side(before_cp, student_color)
        after_for_student = _for_side(after_cp, student_color)
        cp_loss = max(0, before_for_student - after_for_student)
        cp_losses.append(min(cp_loss, ACPL_CAP_CP))

        kind = _classify_delta(cp_loss)
        if kind == "inaccuracy":
            inaccuracies += 1
        elif kind == "mistake":
            mistakes += 1
        elif kind == "blunder":
            blunders += 1

        if kind:
            fen_before = fens[ply - 1]
            played_san = san_history[ply - 1] if ply - 1 < len(san_history) else None
            best_move = best_move_by_ply.get(ply - 1)
            if fen_before and played_san and best_move:
                mistake_moves.append({
                    "ply": ply, "fen_before": fen_before, "played_san": played_san,
                    "best_move": best_move, "cp_loss": cp_loss, "severity": kind,
                })

        win_before = _win_percent(before_for_student)
        win_after = _win_percent(after_for_student)
        acc = _move_accuracy_from_win_drop(win_before - win_after)
        move_accs.append(acc)

        fen_after = fens[ply]
        if fen_after:
            by_phase[_game_phase(ply, fen_after)].append(acc)

    def _avg(values: list[float]) -> float | None:
        return sum(values) / len(values) if values else None

    acpl_avg = _avg(cp_losses)
    return {
        "inaccuracies": inaccuracies,
        "mistakes": mistakes,
        "blunders": blunders,
        "acpl": round(acpl_avg) if acpl_avg is not None else None,
        "accuracy": _avg(move_accs),
        "phase_accuracy_opening": _avg(by_phase["opening"]),
        "phase_accuracy_middlegame": _avg(by_phase["middlegame"]),
        "phase_accuracy_endgame": _avg(by_phase["endgame"]),
        "mistake_moves": mistake_moves,
    }


def is_in_flight(game_id: int) -> bool:
    return game_id in _in_flight


def launch_analysis(game_id: int) -> None:
    """Arka planda `compute_game_analysis`'i başlatır — zaten çalışıyorsa
    NO-OP (asyncio tek thread'li olduğu için bu kontrol+ekleme güvenli)."""
    if game_id in _in_flight:
        return
    _in_flight.add(game_id)
    task = asyncio.create_task(compute_game_analysis(game_id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def compute_game_analysis(game_id: int) -> None:
    """Arka planda çalışır — KENDİ DB session'ını açar (isteği başlatan
    request'in session'ı yanıt dönünce kapanmış olur). Hata durumunda
    sessizce loglar, sporcunun gördüğü akışı BOZMAZ (GET 404 dönmeye
    devam eder, frontend poll etmeye devam eder — bkz. hatalarim
    sayfasının zaten var olan "birkaç deneme" toleransı)."""
    try:
        async with _engine_semaphore:
            async with get_session_factory()() as db:
                game = await db.get(Game, game_id)
                if game is None:
                    return

                moves = (await db.execute(
                    select(GameMove).where(GameMove.game_id == game_id).order_by(GameMove.ply.asc())
                )).scalars().all()
                fens = [game.start_fen or INITIAL_FEN] + [m.fen_after for m in moves]
                san_history = [m.san for m in moves]
                student_color = game.student_color or "w"

                eval_by_ply, best_move_by_ply = await _run_full_analysis(fens)
                summary = _compute_summary(eval_by_ply, fens, student_color, san_history, best_move_by_ply)

                existing = (await db.execute(
                    select(GameAnalysis).where(GameAnalysis.game_id == game_id)
                )).scalar_one_or_none()
                if existing is None:
                    existing = GameAnalysis(game_id=game_id, inaccuracies=0, mistakes=0, blunders=0)
                    db.add(existing)
                existing.inaccuracies = summary["inaccuracies"]
                existing.mistakes = summary["mistakes"]
                existing.blunders = summary["blunders"]
                existing.acpl = summary["acpl"]
                existing.accuracy = summary["accuracy"]
                existing.phase_accuracy_opening = summary["phase_accuracy_opening"]
                existing.phase_accuracy_middlegame = summary["phase_accuracy_middlegame"]
                existing.phase_accuracy_endgame = summary["phase_accuracy_endgame"]
                existing.mistake_moves_json = summary["mistake_moves"]
                existing.eval_by_ply_json = eval_by_ply
                await db.commit()
    except Exception:
        logger.exception("Mac analizi basarisiz oldu (game_id=%s)", game_id)
    finally:
        _in_flight.discard(game_id)

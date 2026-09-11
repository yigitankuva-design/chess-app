"""Profil sayfasının 3 istatistik kartı — Madde 2026-09-11 (Görsel Turu
Aşama C / Madde 4, 5, 8): Performans Puanı, Genel Maç İstatistikleri,
Turnuva Geçmişi. Tempo (Yıldırım/Hızlı/Klasik) BAŞINA ayrı hesaplanır.

KAYNAK KURALI (Zafer, S1/S2): sadece "Maç Yap"taki İNSAN maçları —
puanlı arkadaş maçları + turnuva maçları. Bot maçları ve puansız arkadaş
maçları HİÇBİR istatistiğe girmez. 9 sabit tempodan birine eşleşmeyen
maçlar (tempo_category None) da dışarıda kalır — Performans Puanı
zaten öyle çalışıyor (services/rating.py).

Veri yoksa sıfır/None döner; frontend "henüz maç yok" gösterir.
Salt-okunur — DB'ye yazmaz. Antrenörün sporcu görünümü (teacher.py) ve
sporcunun kendi ucu (gamification.py) AYNI fonksiyonu çağırır.
"""
from datetime import datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.models import (
    ChildTempoRating, Game, GameStatus, GameType, Tournament, TournamentPairing,
    TournamentParticipant, TournamentStatus,
)
from chess_api.services.rating import PROVISIONAL_GAMES, STARTING_RATING
from chess_api.services.tempo import TEMPO_CATEGORIES, tempo_category
from chess_api.services.tournaments import podium_order

WEEKLY_WINDOW = timedelta(days=7)
HISTORY_POINTS = 10


def _empty_tempo() -> dict:
    return {
        "rating": {
            "value": STARTING_RATING, "games_played": 0, "provisional_games": PROVISIONAL_GAMES,
            "weekly_delta": 0, "history": [],
        },
        "stats": {
            "total": 0, "wins": 0, "draws": 0, "losses": 0, "win_rate": None,
            "longest_win_streak": 0, "best_win_rating": None,
        },
        "tournaments": {
            "total": 0, "games": 0, "wins": 0, "draws": 0, "losses": 0,
            "win_rate": None, "draw_rate": None, "loss_rate": None,
            "first": 0, "second": 0, "third": 0,
        },
    }


def _pct(part: int, whole: int) -> int | None:
    return round(part / whole * 100) if whole > 0 else None


def _my_result(game: Game, child_id: int) -> str:
    """'win' | 'draw' | 'loss' — sporcunun rengine göre."""
    if game.result is None:
        return "draw"
    if game.result.value == "1/2-1/2":
        return "draw"
    white_won = game.result.value == "1-0"
    i_am_white = game.white_child_id == child_id
    return "win" if white_won == i_am_white else "loss"


async def compute_match_stats(db: AsyncSession, child_id: int, now: datetime | None = None) -> dict[str, dict]:
    now = now or datetime.utcnow()
    out: dict[str, dict] = {t: _empty_tempo() for t in TEMPO_CATEGORIES}

    # --- 1) Puan satırları (tempo başına güncel puan + oynanan puanlı maç) ---
    rating_rows = (await db.execute(
        select(ChildTempoRating).where(ChildTempoRating.child_id == child_id)
    )).scalars().all()
    for row in rating_rows:
        if row.tempo in out:
            out[row.tempo]["rating"]["value"] = row.rating
            out[row.tempo]["rating"]["games_played"] = row.games_played

    # --- 2) Bitmiş insan maçları (kronolojik) ---
    games = (await db.execute(
        select(Game).where(
            Game.type == GameType.human,
            Game.status == GameStatus.finished,
            Game.result.isnot(None),
            or_(Game.white_child_id == child_id, Game.black_child_id == child_id),
        ).order_by(Game.finished_at.asc().nulls_last(), Game.id.asc())
    )).scalars().all()

    game_ids = [g.id for g in games]
    tournament_game_ids: set[int] = set()
    if game_ids:
        tournament_game_ids = set((await db.execute(
            select(TournamentPairing.game_id).where(TournamentPairing.game_id.in_(game_ids))
        )).scalars().all())

    streak: dict[str, int] = {t: 0 for t in TEMPO_CATEGORIES}
    weekly_base: dict[str, int | None] = {t: None for t in TEMPO_CATEGORIES}
    history: dict[str, list[int]] = {t: [] for t in TEMPO_CATEGORIES}
    week_start = now - WEEKLY_WINDOW

    for g in games:
        tempo = tempo_category(g.base_ms, g.increment_ms)
        if tempo is None or tempo not in out:
            continue
        if not g.rated and g.id not in tournament_game_ids:
            continue  # puansız arkadaş maçı — hiçbir istatistiğe girmez (S2)

        i_am_white = g.white_child_id == child_id
        res = _my_result(g, child_id)
        st = out[tempo]["stats"]
        st["total"] += 1
        if res == "win":
            st["wins"] += 1
            streak[tempo] += 1
            st["longest_win_streak"] = max(st["longest_win_streak"], streak[tempo])
            opp_before = g.black_rating_before if i_am_white else g.white_rating_before
            if opp_before is not None and (st["best_win_rating"] is None or opp_before > st["best_win_rating"]):
                st["best_win_rating"] = opp_before
        elif res == "draw":
            st["draws"] += 1
            streak[tempo] = 0
        else:
            st["losses"] += 1
            streak[tempo] = 0

        # Puan geçmişi: sadece puan anlık görüntüsü yazılmış (rated) maçlar.
        my_before = g.white_rating_before if i_am_white else g.black_rating_before
        my_after = g.white_rating_after if i_am_white else g.black_rating_after
        if my_after is not None:
            history[tempo].append(my_after)
            finished = g.finished_at or g.started_at
            if my_before is not None and finished is not None and finished >= week_start and weekly_base[tempo] is None:
                weekly_base[tempo] = my_before

    for tempo in TEMPO_CATEGORIES:
        st = out[tempo]["stats"]
        st["win_rate"] = _pct(st["wins"], st["total"])
        r = out[tempo]["rating"]
        r["history"] = history[tempo][-HISTORY_POINTS:]
        base = weekly_base[tempo]
        r["weekly_delta"] = (r["value"] - base) if base is not None else 0

    # --- 3) Turnuva geçmişi: bitmiş turnuvalar (katılımcı satırı olanlar) ---
    rows = (await db.execute(
        select(TournamentParticipant, Tournament)
        .join(Tournament, Tournament.id == TournamentParticipant.tournament_id)
        .where(
            TournamentParticipant.child_id == child_id,
            Tournament.status == TournamentStatus.finished,
        )
    )).all()
    for participant, t in rows:
        tempo = tempo_category(t.base_ms, t.increment_ms)
        if tempo is None or tempo not in out:
            continue
        tr = out[tempo]["tournaments"]
        tr["total"] += 1

        all_participants = (await db.execute(
            select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
        )).scalars().all()
        pairings = (await db.execute(
            select(TournamentPairing).where(TournamentPairing.tournament_id == t.id)
        )).scalars().all()

        # G/B/Y: sadece sonucu olan eşleşmeler — bay (eşleşme satırı yok) ve
        # "void" (iptal) sayılmaz.
        for p in pairings:
            if p.result not in ("1-0", "0-1", "1/2-1/2"):
                continue
            if child_id not in (p.white_child_id, p.black_child_id):
                continue
            tr["games"] += 1
            if p.result == "1/2-1/2":
                tr["draws"] += 1
            elif (p.result == "1-0") == (p.white_child_id == child_id):
                tr["wins"] += 1
            else:
                tr["losses"] += 1

        # Podyum: turnuva sıralamasıyla AYNI sıra (puan → Sonneborn-Berger);
        # çekilen (left_at dolu) sporcu podyuma giremez.
        if participant.left_at is None:
            order = podium_order(all_participants, pairings)
            if child_id in order[:3]:
                key = ("first", "second", "third")[order.index(child_id)]
                tr[key] += 1

    for tempo in TEMPO_CATEGORIES:
        tr = out[tempo]["tournaments"]
        tr["win_rate"] = _pct(tr["wins"], tr["games"])
        tr["draw_rate"] = _pct(tr["draws"], tr["games"])
        tr["loss_rate"] = _pct(tr["losses"], tr["games"])

    return out

"""In-memory Arena eslesmesi — services/matchmaking.py'nin AYNI deseni,
turnuva basina anahtarlanmis (tournament_id -> bekleyen kuyruk).

Rating toleransi YOK: bekleyen biri varsa, turnuva puanina EN YAKIN olan
her zaman eslestirilir (Lichess: kimse bosta kalmasin). Kimse yoksa kuyruga
girip asyncio.Event ile beklenir.

For multi-instance scale-out, replace with Redis pub/sub (see spec) —
matchmaking.py ile ayni bilinen sinir.
"""
import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable

DEFAULT_WAIT_TIMEOUT = 60.0


@dataclass
class ArenaTicket:
    tournament_id: int
    child_id: int
    score: float
    event: asyncio.Event = field(default_factory=asyncio.Event)
    game_id: int | None = None
    color: str | None = None          # 'white' | 'black'
    opponent_id: int | None = None


# module-level state — turnuva basina ayri kuyruk
_waiting: dict[int, list[ArenaTicket]] = {}
_lock = asyncio.Lock()


def _reset_for_tests() -> None:
    """Test helper: tum kuyruklari temizler."""
    _waiting.clear()


async def find_arena_opponent(
    tournament_id: int,
    child_id: int,
    score: float,
    create_game: Callable[..., Awaitable[int]],
    wait_timeout: float = DEFAULT_WAIT_TIMEOUT,
) -> ArenaTicket:
    """Turnuva puanina EN YAKIN bekleyen rakiple eslestirir (tolerans yok —
    bekleyen varsa MUTLAKA eslesir). Kimse yoksa kuyruga girip bekler.

    create_game(white_child_id, black_child_id) -> game_id (async).
    Returns a resolved ArenaTicket (game_id/color/opponent set) on match,
    or an unresolved ticket (game_id is None) on timeout.
    """
    async with _lock:
        queue = _waiting.setdefault(tournament_id, [])
        best: ArenaTicket | None = None
        best_diff: float | None = None
        for w in queue:
            if w.child_id == child_id or w.event.is_set():
                continue
            diff = abs(w.score - score)
            if best is None or diff < best_diff:
                best, best_diff = w, diff

        if best is not None:
            # Eslestir. Bekleyen (once giren) beyaz, yeni gelen siyah.
            game_id = await create_game(best.child_id, child_id)
            best.game_id = game_id
            best.color = "white"
            best.opponent_id = child_id
            if best in queue:
                queue.remove(best)
            best.event.set()

            mine = ArenaTicket(tournament_id=tournament_id, child_id=child_id, score=score)
            mine.game_id = game_id
            mine.color = "black"
            mine.opponent_id = best.child_id
            mine.event.set()
            return mine

        # Kimse yok — kuyruga gir
        mine = ArenaTicket(tournament_id=tournament_id, child_id=child_id, score=score)
        queue.append(mine)

    # Kilit disinda bekle
    try:
        await asyncio.wait_for(mine.event.wait(), timeout=wait_timeout)
    except asyncio.TimeoutError:
        async with _lock:
            q = _waiting.get(tournament_id)
            if q and mine in q:
                q.remove(mine)
    return mine


async def leave_arena_queue(tournament_id: int, child_id: int) -> None:
    async with _lock:
        q = _waiting.get(tournament_id)
        if not q:
            return
        for w in list(q):
            if w.child_id == child_id and not w.event.is_set():
                q.remove(w)

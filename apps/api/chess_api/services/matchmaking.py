"""In-memory matchmaking for single-instance deploy.

A child requests a match. If a compatible waiting opponent exists, pair them
immediately (creating a game via the provided async callback) and signal the
waiting opponent. Otherwise enqueue and wait on an asyncio.Event.

For multi-instance scale-out, replace with Redis pub/sub (see spec).
"""
import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable

RATING_TOLERANCE = 200
DEFAULT_WAIT_TIMEOUT = 60.0  # seconds


@dataclass
class MatchTicket:
    child_id: int
    rating: int
    # Secilen tempo (saniye). None => saatsiz. Farkli tempolar ESLESMEZ:
    # 3+2 isteyen sporcu 30+0'a dusmemeli.
    tc_base: int | None = None
    tc_increment: int = 0
    event: asyncio.Event = field(default_factory=asyncio.Event)
    game_id: int | None = None
    color: str | None = None          # 'white' | 'black'
    opponent_id: int | None = None


# module-level state
_waiting: list[MatchTicket] = []
_lock = asyncio.Lock()


def _reset_for_tests() -> None:
    """Test helper: clear the queue."""
    _waiting.clear()


async def find_match(
    child_id: int,
    rating: int,
    create_game: Callable[..., Awaitable[int]],
    wait_timeout: float = DEFAULT_WAIT_TIMEOUT,
    tc_base: int | None = None,
    tc_increment: int = 0,
) -> MatchTicket:
    """Find an opponent or wait.

    create_game(white_child_id, black_child_id, base_ms=..., increment_ms=...)
    -> game_id (async). Saat degerleri secilen tempodan hesaplanir.
    Returns a resolved MatchTicket (game_id/color/opponent set) on match,
    or an unresolved ticket (game_id is None) on timeout.
    """
    async with _lock:
        # Look for a compatible waiter (not self, within tolerance, not already matched)
        for w in list(_waiting):
            if w.child_id == child_id:
                continue
            if w.event.is_set():
                continue
            if w.tc_base != tc_base or w.tc_increment != tc_increment:
                continue
            if abs(w.rating - rating) <= RATING_TOLERANCE:
                # Pair them. Waiter is white (joined first), newcomer is black.
                game_id = await create_game(
                    w.child_id, child_id,
                    base_ms=tc_base * 1000 if tc_base else None,
                    increment_ms=tc_increment * 1000,
                )
                w.game_id = game_id
                w.color = "white"
                w.opponent_id = child_id
                if w in _waiting:
                    _waiting.remove(w)
                w.event.set()

                mine = MatchTicket(child_id=child_id, rating=rating,
                                   tc_base=tc_base, tc_increment=tc_increment)
                mine.game_id = game_id
                mine.color = "black"
                mine.opponent_id = w.child_id
                mine.event.set()
                return mine

        # No match — enqueue self
        mine = MatchTicket(child_id=child_id, rating=rating,
                           tc_base=tc_base, tc_increment=tc_increment)
        _waiting.append(mine)

    # Wait outside the lock
    try:
        await asyncio.wait_for(mine.event.wait(), timeout=wait_timeout)
    except asyncio.TimeoutError:
        async with _lock:
            if mine in _waiting:
                _waiting.remove(mine)
    return mine


async def leave_queue(child_id: int) -> None:
    async with _lock:
        for w in list(_waiting):
            if w.child_id == child_id and not w.event.is_set():
                _waiting.remove(w)

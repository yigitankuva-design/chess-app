import asyncio
import pytest
from chess_api.services.matchmaking import find_match, leave_queue, _reset_for_tests, MatchTicket
from chess_api.services.game_room import GameRoom, get_room, remove_room, _reset_for_tests as reset_rooms


@pytest.fixture(autouse=True)
def _clean():
    _reset_for_tests()
    reset_rooms()
    yield
    _reset_for_tests()
    reset_rooms()


async def _fake_create_game(white_id, black_id):
    return 12345  # fake game id


async def test_first_player_waits_then_times_out():
    """Single player, short timeout -> unresolved ticket"""
    ticket = await find_match(child_id=1, rating=800, create_game=_fake_create_game, wait_timeout=0.2)
    assert ticket.game_id is None  # timed out, no opponent


async def test_two_compatible_players_match():
    """Player 1 waits; player 2 joins and matches."""
    async def player1():
        return await find_match(1, 800, _fake_create_game, wait_timeout=2.0)

    async def player2():
        await asyncio.sleep(0.1)  # ensure p1 is waiting first
        return await find_match(2, 820, _fake_create_game, wait_timeout=2.0)

    t1, t2 = await asyncio.gather(player1(), player2())
    assert t1.game_id == 12345
    assert t2.game_id == 12345
    assert {t1.color, t2.color} == {"white", "black"}
    assert t1.opponent_id == 2
    assert t2.opponent_id == 1


async def test_rating_too_far_no_match():
    """Players outside rating tolerance don't match."""
    async def player1():
        return await find_match(1, 400, _fake_create_game, wait_timeout=0.4)
    async def player2():
        await asyncio.sleep(0.1)
        return await find_match(2, 1400, _fake_create_game, wait_timeout=0.4)
    t1, t2 = await asyncio.gather(player1(), player2())
    assert t1.game_id is None
    assert t2.game_id is None


async def test_leave_queue():
    """Player can leave queue before match."""
    async def player1():
        return await find_match(1, 800, _fake_create_game, wait_timeout=1.0)
    task = asyncio.create_task(player1())
    await asyncio.sleep(0.1)
    await leave_queue(1)
    t1 = await task
    assert t1.game_id is None


# --- GameRoom tests ---

class FakeWS:
    def __init__(self):
        self.sent = []
    async def send_json(self, data):
        self.sent.append(data)


async def test_game_room_broadcast():
    """All players receive broadcast."""
    room = get_room(1)
    a, b = FakeWS(), FakeWS()
    room.join(10, a)
    room.join(20, b)
    await room.broadcast({"type": "move", "x": 1})
    assert a.sent == [{"type": "move", "x": 1}]
    assert b.sent == [{"type": "move", "x": 1}]


async def test_game_room_broadcast_exclude():
    """Broadcast can exclude a player."""
    room = get_room(2)
    a, b = FakeWS(), FakeWS()
    room.join(10, a)
    room.join(20, b)
    await room.broadcast({"type": "x"}, exclude=10)
    assert a.sent == []
    assert b.sent == [{"type": "x"}]


async def test_game_room_send_to():
    """Send message to specific player."""
    room = get_room(3)
    a = FakeWS()
    room.join(10, a)
    await room.send_to(10, {"hi": True})
    await room.send_to(999, {"nope": True})  # no such player, no error
    assert a.sent == [{"hi": True}]

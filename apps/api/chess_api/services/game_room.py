"""In-memory game rooms: track connected players per game for broadcast.

Players are objects exposing `async send_json(dict)` (e.g., a Starlette WebSocket).
"""
from typing import Any, Protocol


class Sender(Protocol):
    async def send_json(self, data: dict) -> None: ...


class GameRoom:
    def __init__(self, game_id: int):
        self.game_id = game_id
        self.players: dict[int, Sender] = {}  # child_id -> sender

    def join(self, child_id: int, sender: Sender) -> None:
        self.players[child_id] = sender

    def leave(self, child_id: int) -> None:
        self.players.pop(child_id, None)

    async def broadcast(self, message: dict, exclude: int | None = None) -> None:
        for cid, sender in list(self.players.items()):
            if cid == exclude:
                continue
            try:
                await sender.send_json(message)
            except Exception:
                pass

    async def send_to(self, child_id: int, message: dict) -> None:
        sender = self.players.get(child_id)
        if sender:
            try:
                await sender.send_json(message)
            except Exception:
                pass


_rooms: dict[int, GameRoom] = {}


def get_room(game_id: int) -> GameRoom:
    if game_id not in _rooms:
        _rooms[game_id] = GameRoom(game_id)
    return _rooms[game_id]


def remove_room(game_id: int) -> None:
    _rooms.pop(game_id, None)


def _reset_for_tests() -> None:
    _rooms.clear()

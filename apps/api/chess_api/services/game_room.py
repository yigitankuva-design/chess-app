"""In-memory game rooms: track connected players per game for broadcast.

Players are objects exposing `async send_json(dict)` (e.g., a Starlette WebSocket).

Bir sporcu AYNI maca birden fazla cihazdan (baglantidan) baglanabilir — ornegin
telefon ve bilgisayar ayni anda acik. Bu yuzden child_id -> TEK baglanti degil,
child_id -> {baglanti_id: baglanti} tutulur. join() cagirana bir baglanti kimligi
(conn_id) doner; leave() bu kimlikle CAGRILMALIDIR, aksi halde sunucu HANGI
cihazin koptugunu bilemez ve digerini de yanlislikla silebilir (bkz.
docs/superpowers/specs/2026-08-02-bot-maci-cihazlar-arasi-canli-senkron-design.md,
"Gozden gecirmede bulunan engeller - madde 1").
"""
from typing import Protocol


class Sender(Protocol):
    async def send_json(self, data: dict) -> None: ...


class GameRoom:
    def __init__(self, game_id: int):
        self.game_id = game_id
        self.players: dict[int, dict[int, Sender]] = {}  # child_id -> {conn_id: sender}
        self._next_conn_id = 0

    def join(self, child_id: int, sender: Sender) -> int:
        """Baglantiyi odaya ekler. Donen conn_id, leave() icin SAKLANMALIDIR."""
        conn_id = self._next_conn_id
        self._next_conn_id += 1
        self.players.setdefault(child_id, {})[conn_id] = sender
        return conn_id

    def leave(self, child_id: int, conn_id: int) -> None:
        """Yalnizca BELIRTILEN baglantiyi cikarir; ayni sporcunun BASKA acik
        baglantisi varsa (or. diger cihazi) etkilenmez."""
        conns = self.players.get(child_id)
        if conns is None:
            return
        conns.pop(conn_id, None)
        if not conns:
            self.players.pop(child_id, None)

    async def broadcast(self, message: dict, exclude: int | None = None) -> None:
        """Odadaki HERKESE (exclude edilen sporcu haric) — bir sporcunun
        birden fazla acik baglantisi varsa HEPSINE gonderilir."""
        for cid, conns in list(self.players.items()):
            if cid == exclude:
                continue
            for sender in list(conns.values()):
                try:
                    await sender.send_json(message)
                except Exception:
                    pass

    async def send_to(self, child_id: int, message: dict) -> None:
        """Belirli bir sporcunun TUM acik baglantilarina gonderir."""
        for sender in list(self.players.get(child_id, {}).values()):
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

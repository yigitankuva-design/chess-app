"""In-memory canlı ders odaları — `game_room.py`'deki AYNI desen (madde
2026-09-15). Video/ses LiveKit'te taşınır; burası SADECE uygulama
durumunu (paylaşılan tahta, taş oynatma yetkisi, sohbet) taşıyan hafif bir
JSON broadcast kanalıdır — `/ws/live-lesson/{id}` bunu kullanır.

Antrenör (host) ve öğrenciler AYRI sözlüklerde tutulur çünkü host'un
child_id'si yok (coach_user_id var) — game_room.py'nin `child_id ->
{conn_id: sender}` desenini host için `conn_id -> sender`'a indirgedik,
öğrenciler için AYNEN korunuyor (bir öğrenci birden fazla cihazdan
bağlanabilir — telefon + bilgisayar)."""
from typing import Protocol


class Sender(Protocol):
    async def send_json(self, data: dict) -> None: ...


class LiveLessonRoom:
    def __init__(self, lesson_id: int, start_fen: str):
        self.lesson_id = lesson_id
        self.host_conns: dict[int, Sender] = {}
        self.participants: dict[int, dict[int, Sender]] = {}
        self._next_conn_id = 0
        # Ders durumu — sunucu tarafında tutulur, yeni katılan/yeniden
        # bağlanan anında görür (bkz. routers/live_lessons.py'deki
        # "lesson_state" karşılama mesajı).
        self.fen = start_fen
        self.san_history: list[str] = []
        self.controller_child_id: int | None = None
        # Madde 2026-09-16 (Antrenör Ekranı, Faz A): host tarafında hangi
        # öğrencinin şu an susturulmuş olduğunu tutan durum — önceden YOKTU,
        # susturma tek yönlü ("hep True") olduğu için gerek duyulmamıştı.
        self.muted_child_ids: set[int] = set()
        # Madde 2026-09-17 (self_mute düzeltmesi): `muted_child_ids` hem
        # antrenörün SUSTURMASINDAN hem sporcunun KENDİ tercihinden
        # (self_mute) güncelleniyor — host ekranı için TEK bir görünen
        # durum olarak doğru, ama "antrenör bunu ZATEN susturmuş, sporcu
        # kendi kendine açamaz" kuralını uygulamak için HANGİ öğrencinin
        # antrenör TARAFINDAN susturulduğunu AYRICA bilmek gerekiyor —
        # sadece bu alt-küme self_mute'un "aç" isteğini yoksaymak için
        # kontrol edilir.
        self.coach_muted_child_ids: set[int] = set()
        # Madde 2026-09-17 (Sporcu Ekranı, "Söz Hakkı İstiyor" v2): turuncu↔
        # mavi durumdaki öğrenciler (istek YAPMIŞ ya da şu an konuşuyor —
        # ikisi de aynı mavi renk, ayrım aşağıdaki iki alanla tutuluyor).
        self.hand_raised_ids: set[int] = set()
        # Şu an "söz hakkı verilmiş" (mikrofon kademesi aktif) öğrenci —
        # None ise kimseye verilmemiş.
        self.floor_child_id: int | None = None
        # floor_child_id verilirken DİĞER öğrencilerin o ANKİ susturma
        # durumunun anlık görüntüsü — tur bitince buna göre geri yüklenir.
        self.pre_floor_muted_ids: set[int] | None = None

    def join_host(self, sender: Sender) -> int:
        conn_id = self._next_conn_id
        self._next_conn_id += 1
        self.host_conns[conn_id] = sender
        return conn_id

    def leave_host(self, conn_id: int) -> None:
        self.host_conns.pop(conn_id, None)

    def join_participant(self, child_id: int, sender: Sender) -> int:
        conn_id = self._next_conn_id
        self._next_conn_id += 1
        self.participants.setdefault(child_id, {})[conn_id] = sender
        return conn_id

    def leave_participant(self, child_id: int, conn_id: int) -> None:
        conns = self.participants.get(child_id)
        if conns is None:
            return
        conns.pop(conn_id, None)
        if not conns:
            self.participants.pop(child_id, None)
            # Bağlantısı tamamen kopan öğrencide yetki kalmasın — antrenör
            # tekrar birine devretmeli.
            if self.controller_child_id == child_id:
                self.controller_child_id = None

    async def broadcast(self, message: dict) -> None:
        for sender in list(self.host_conns.values()):
            try:
                await sender.send_json(message)
            except Exception:
                pass
        for conns in list(self.participants.values()):
            for sender in list(conns.values()):
                try:
                    await sender.send_json(message)
                except Exception:
                    pass

    async def send_to_child(self, child_id: int, message: dict) -> None:
        for sender in list(self.participants.get(child_id, {}).values()):
            try:
                await sender.send_json(message)
            except Exception:
                pass

    async def send_to_host(self, message: dict) -> None:
        """SADECE antrenöre gönderir — ör. susturma-durumu senkronu ve
        "söz hakkı istiyor" bildirimleri öğrencilere DEĞİL, sadece host'a
        gider."""
        for sender in list(self.host_conns.values()):
            try:
                await sender.send_json(message)
            except Exception:
                pass


_rooms: dict[int, LiveLessonRoom] = {}


def get_room(lesson_id: int, start_fen: str) -> LiveLessonRoom:
    if lesson_id not in _rooms:
        _rooms[lesson_id] = LiveLessonRoom(lesson_id, start_fen)
    return _rooms[lesson_id]


def remove_room(lesson_id: int) -> None:
    _rooms.pop(lesson_id, None)


def _reset_for_tests() -> None:
    _rooms.clear()

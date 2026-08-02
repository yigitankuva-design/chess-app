# Oyun Odası (GameRoom) Çoklu Cihaz Desteği — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GameRoom`'u (bir maçın anlık bağlantılarını tutan sunucu bileşeni), aynı
sporcunun AYNI maça birden fazla cihazdan (bağlantıdan) bağlanabilmesini destekleyecek
şekilde düzeltmek — bugün ikinci bağlantı birincinin yerine geçiyor (birinci cihaz
sessizce mesaj almayı kesiyor).

**Architecture:** `GameRoom.players` bugün `child_id -> tek bağlantı` tutuyor. Bunu
`child_id -> {bağlantı_id: bağlantı}` yapısına çeviriyoruz. `join()` artık bir
bağlantı kimliği (`conn_id`) döndürüyor; `leave()` bu kimliği istiyor (hangi cihazın
koptuğunu doğru bilmek için). `broadcast`/`send_to` artık bir sporcunun TÜM açık
bağlantılarına gönderiyor. Bu, bu spec'in ("bot maçı cihazlar arası canlı senkron")
ön koşulu ve aynı zamanda bugün canlı insan-insan maçlarını da etkileyen mevcut bir
kusurun düzeltmesi — bot işine hiç dokunmadan tek başına test edilip yayına
gönderilebilir bağımsız bir iyileştirme.

**Tech Stack:** FastAPI, pytest + pytest-asyncio (mevcut `tests/test_matchmaking.py`,
`tests/test_draw_offers_ws.py` ile aynı `FakeSender`/`FakeWS` deseni).

**İlgili belge:** `docs/superpowers/specs/2026-08-02-bot-maci-cihazlar-arasi-canli-senkron-design.md`
(bölüm: "Gözden geçirmede bulunan engeller — madde 1").

**Kapsam dışı (bilerek):** Bot hamlesi, sunucu-taraflı motor, `/games/bot/start`
değişiklikleri, `_current_fen` düzeltmesi — bunlar AYRI, sonraki planlarda ele
alınacak (spec'te "parça parça ilerleyelim" kararı verildi).

---

### Task 1: `GameRoom` çoklu bağlantı desteği

**Files:**
- Modify: `apps/api/chess_api/services/game_room.py`
- Test: `apps/api/tests/test_game_room.py` (yeni)

- [ ] **Step 1: Başarısız testleri yaz**

`apps/api/tests/test_game_room.py`:

```python
import pytest
from chess_api.services.game_room import GameRoom


class FakeSender:
    """GameRoom'un bekledigi 'async send_json' arayuzunu taklit eder."""

    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


@pytest.mark.asyncio
async def test_ayni_sporcunun_iki_baglantisi_da_yayini_alir():
    """Bugunku kusur: ikinci join() birinciyi ANINDA sessizce siler.
    Ayni sporcu (child_id) ikinci cihazdan baglaninca, ilk cihaz koptu
    SANILIP hicbir yayin almamali degil — HER IKI cihaz da almali."""
    room = GameRoom(game_id=1)
    telefon, bilgisayar = FakeSender(), FakeSender()
    room.join(child_id=7, sender=telefon)
    room.join(child_id=7, sender=bilgisayar)  # AYNI child_id, ikinci baglanti

    await room.broadcast({"type": "move_made", "uci": "e2e4"})

    assert telefon.messages == [{"type": "move_made", "uci": "e2e4"}]
    assert bilgisayar.messages == [{"type": "move_made", "uci": "e2e4"}]


@pytest.mark.asyncio
async def test_bir_baglanti_kopunca_digeri_yayina_devam_eder():
    """Telefon sekmesi kapanir (leave), ama bilgisayar acik kalir — o
    hala yayin almaya devam etmeli."""
    room = GameRoom(game_id=1)
    telefon, bilgisayar = FakeSender(), FakeSender()
    telefon_conn = room.join(child_id=7, sender=telefon)
    room.join(child_id=7, sender=bilgisayar)

    room.leave(child_id=7, conn_id=telefon_conn)
    await room.broadcast({"type": "ping"})

    assert telefon.messages == []
    assert bilgisayar.messages == [{"type": "ping"}]


@pytest.mark.asyncio
async def test_son_baglanti_da_kopunca_sporcu_odadan_tamamen_cikar():
    room = GameRoom(game_id=1)
    tek = FakeSender()
    conn_id = room.join(child_id=7, sender=tek)

    room.leave(child_id=7, conn_id=conn_id)

    assert 7 not in room.players


@pytest.mark.asyncio
async def test_iki_farkli_sporcu_broadcast_ve_exclude_calisir():
    """Regresyon: insan-insan mactaki mevcut davranis (iki AYRI sporcu,
    exclude ile 'rakibe gonder') bozulmamali."""
    room = GameRoom(game_id=1)
    beyaz, siyah = FakeSender(), FakeSender()
    room.join(child_id=1, sender=beyaz)
    room.join(child_id=2, sender=siyah)

    await room.broadcast({"type": "x"}, exclude=1)

    assert beyaz.messages == []
    assert siyah.messages == [{"type": "x"}]


@pytest.mark.asyncio
async def test_send_to_sporcunun_tum_baglantilarina_gider():
    room = GameRoom(game_id=1)
    telefon, bilgisayar = FakeSender(), FakeSender()
    room.join(child_id=7, sender=telefon)
    room.join(child_id=7, sender=bilgisayar)

    await room.send_to(7, {"type": "error", "message": "not_your_turn"})

    assert telefon.messages == [{"type": "error", "message": "not_your_turn"}]
    assert bilgisayar.messages == [{"type": "error", "message": "not_your_turn"}]
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_game_room.py -v`
Expected: `test_ayni_sporcunun_iki_baglantisi_da_yayini_alir` FAIL — bugünkü
`join()` ikinci bağlantıda birinciyi `self.players[child_id] = sender` ile
ÜZERİNE YAZIYOR, `telefon.messages` boş kalıyor. Diğer testler de `conn_id`
döndürülmediği için (`join()` `None` döner) `TypeError` ile patlar.

- [ ] **Step 3: `GameRoom`'u çoklu bağlantı destekleyecek şekilde yeniden yaz**

`apps/api/chess_api/services/game_room.py` — TÜM dosyanın yeni hâli:

```python
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
from typing import Any, Protocol


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
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_game_room.py -v`
Expected: PASS (5 test).

- [ ] **Step 5: Regresyon — mevcut oda testleri**

Run: `cd apps/api && python -m pytest tests/test_matchmaking.py tests/test_draw_offers_ws.py -v`
Expected: PASS. NOT: `test_matchmaking.py`'deki `test_game_room_broadcast` vb.
testler `room.join(10, a)`'nin dönüş değerini kullanmıyor — yeni `join()`'in
`int` döndürmesi bu testleri BOZMAZ (dönüş değeri yok sayılıyor).

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/services/game_room.py apps/api/tests/test_game_room.py
git commit -m "fix: GameRoom ayni sporcunun coklu cihaz baglantisini destekler"
```

---

### Task 2: `live_game.py`'deki çağrı noktasını güncelle

**Kök neden:** `game_ws` bugün `room.join(child_id, websocket)` ve `room.leave(child_id)`
çağırıyor — Task 1'deki yeni imza (`join()` bir `conn_id` döner, `leave()` bunu
ister) ile artık uyuşmuyor. Bu adım olmadan Task 1'in düzeltmesi gerçek WebSocket
uç noktasına hiç ulaşmaz.

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py:168-238` (`game_ws` fonksiyonu)

- [ ] **Step 1: `game_ws`'i güncelle**

`apps/api/chess_api/routers/live_game.py` içinde, `game_ws` fonksiyonunun ilgili
kısımlarını şu şekilde değiştir (satır ~185-186 ve ~233-238):

Eski (satır ~185-186):
```python
    room = get_room(game_id)
    room.join(child_id, websocket)
    await room.broadcast({"type": "player_joined", "child_id": child_id})
```

Yeni:
```python
    room = get_room(game_id)
    conn_id = room.join(child_id, websocket)
    await room.broadcast({"type": "player_joined", "child_id": child_id})
```

Eski (satır ~233-238):
```python
    except WebSocketDisconnect:
        room.leave(child_id)
        await room.broadcast({"type": "opponent_disconnected", "child_id": child_id})
    except Exception:
        logger.exception("game_ws error")
        room.leave(child_id)
```

Yeni:
```python
    except WebSocketDisconnect:
        room.leave(child_id, conn_id)
        await room.broadcast({"type": "opponent_disconnected", "child_id": child_id})
    except Exception:
        logger.exception("game_ws error")
        room.leave(child_id, conn_id)
```

> NOT: `opponent_disconnected` mesajı bugünkü haliyle "rakip koptu" anlamına
> geliyor — bir sporcunun İKİNCİ cihazı kapandığında da (aynı sporcunun BAŞKA bir
> bağlantısı hâlâ açıkken) bu mesaj hâlâ yayınlanır. Bu, insan-insan maçında
> YANLIŞ bir bildirime yol açabilir (rakip kopmadığı hâlde "rakip koptu" görünür).
> Bu spec'in kapsamı YALNIZCA bağlantı takibini düzeltmektir (Task 1); bu mesajın
> ne zaman/kime gönderileceğinin incelikleri (ör. yalnızca sporcunun SON bağlantısı
> kapandığında göndermek) BİLEREK bu plana dahil EDİLMEDİ — ayrı bir iş kalemi
> olarak not edilecek (bkz. Task 3 Step 3).

- [ ] **Step 2: Regresyon — tüm mevcut canlı-maç WebSocket testleri**

Run: `cd apps/api && python -m pytest tests/test_live_game_ws.py tests/test_game_info_moves.py tests/test_live_two_moves.py tests/test_draw_offers_ws.py tests/test_lobby_ws.py tests/test_matchmaking.py tests/test_game_room.py -v`
Expected: TÜMÜ PASS. Bu testler `room.join`/`room.leave`'i ya doğrudan (Task 1'in
testleri) ya da gerçek WebSocket bağlantısı üzerinden (`test_live_game_ws.py`,
`test_game_info_moves.py`) dolaylı olarak çağırıyor — hiçbiri bozulmamalı.

- [ ] **Step 3: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py
git commit -m "fix: game_ws yeni GameRoom.join/leave imzasina gore guncellendi"
```

---

### Task 3: Tam test kapısı ve not

**Files:** (yok — yalnızca doğrulama)

- [ ] **Step 1: Backend tam test paketi**

Run: `cd apps/api && python -m pytest -q`
Expected: TÜM testler PASS (mevcut ~357 test + bu planın eklediği 5 test).

- [ ] **Step 2: Frontend'e dokunulmadı — web test paketi çalıştırmaya gerek yok**

Bu plan yalnızca `apps/api` içinde çalışıyor; `apps/web` hiç değişmedi. Bu adımda
web testlerini KOŞMAYA gerek yoktur (zaman kaybı) — yalnızca not düşülür.

- [ ] **Step 3: Bilinerek ertelenen konuyu kaydet**

Task 2 Step 1'deki NOT'ta bahsedilen `opponent_disconnected` inceliği (bir
sporcunun ikinci cihazı kapanınca, hâlâ açık ilk cihazına yanlışlıkla "rakip
koptu" bildirimi gitmesi) bu planın kapsamı DIŞINDA bırakıldı — insan-insan
maçlarda bugün zaten yalnızca TEK cihaz kullanıldığı için bu senaryo şu an
GERÇEKTE yaşanmıyor (yeni sorun EKLEMİYORUZ, mevcut davranışı KORUYORUZ). Bot
maçı planı (bir sonraki aşama) bu mesajın bot maçında ne anlama geleceğini zaten
ayrıca ele alacak (bkz. tasarım belgesi, "Riskler ve Açık Noktalar" — madde 2);
insan-insan maçındaki incelik o sırada ayrıca değerlendirilecek veya kullanıcıya
sorulacak.

- [ ] **Step 4: Kullanıcıya rapor + canlıya gönderme onayı**

Bu adımda kod yazılmaz — sonuçlar (kaç test geçti, ne değişti) KURAL #0'a uygun
sade Türkçe ile kullanıcıya özetlenir, `git push origin main` için açık onay
istenir (bu depo `main`'e doğrudan çalışıyor, ayrı dal/PR yok).

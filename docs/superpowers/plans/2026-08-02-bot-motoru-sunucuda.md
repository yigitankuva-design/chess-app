# Bot Motoru Sunucuda Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bot maçında hamleyi artık sunucu hesaplar — insan hamlesi işlenip
yayınlandıktan sonra sırada bot varsa, sunucu motoru çağırıp botun hamlesini de
aynı doğrulama+kayıt+yayın adımlarından geçirir. Beraberlik teklifine bot cevabı
da sunucuya taşınır. `student_color='b'` olan bot maçlarındaki sıra-kontrolü
hatası düzeltilir.

**Architecture:** `chess_api/services/bot_engine.py` (yeni) motor çağrısını
soyutlar — testler gerçek Stockfish yerine `monkeypatch` ile sahte bir motor
kullanır (bu makinede binary kurulu değil, doğrulandı). `live_game.py`'deki
`_handle_move` bot-farkında sıra kontrolüne kavuşur ve insan hamlesinin sonunda
gerekirse `_play_bot_move`'u tetikler. `chess_api/services/bot_draw.py` (yeni)
`botDraw.ts`'in birebir Python karşılığıdır; `_handle_offer_draw` bot maçında
botun kararını kendisi sorar.

**Tech Stack:** FastAPI, `python-chess` (zaten kurulu), pytest + pytest-asyncio
(mevcut `env`/`FakeRoom`/`FakeSender` desenleri — `test_live_two_moves.py`,
`test_draw_offers_ws.py`, `test_game_info_moves.py` ile AYNI).

**İlgili belge:** `docs/superpowers/specs/2026-08-02-bot-motoru-sunucuda-design.md`

**Kapsam dışı (bilerek):** `BotGame.tsx`'in bu WS akışına bağlanması (son, ayrı
parça); Nixpacks/Stockfish'in GERÇEKTEN Railway'e kurulup denenmesi (bu planın
kodu motor çağrısını doğru YAPILANDIRIR ama binary kurulumu ayrı, dikkatli bir
adım — bkz. Task 5).

---

### Task 1: `bot_engine.py` — motor soyutlaması

**Files:**
- Create: `apps/api/chess_api/services/bot_engine.py`
- Test: `apps/api/tests/test_bot_engine.py`

- [x] **Step 1: Başarısız testleri yaz**

`apps/api/tests/test_bot_engine.py`:

```python
from chess_api.services.bot_engine import depth_for_skill


def test_tam_tablo_degerleri():
    """apps/web/lib/play/levels.ts'teki 8 duzeyle AYNI olmali."""
    assert depth_for_skill(0) == 1
    assert depth_for_skill(3) == 3
    assert depth_for_skill(6) == 5
    assert depth_for_skill(9) == 7
    assert depth_for_skill(12) == 8
    assert depth_for_skill(15) == 9
    assert depth_for_skill(18) == 11
    assert depth_for_skill(20) == 12


def test_ara_deger_en_yakin_ALT_basamaga_yuvarlanir():
    """Sessizce cok guclu bir bot uretmekten daha guvenli (bkz. tasarim
    belgesi, sorun B)."""
    assert depth_for_skill(7) == 5    # 6-9 arasi -> 6'nin derinligi
    assert depth_for_skill(1) == 1    # 0-3 arasi -> 0'in derinligi
    assert depth_for_skill(19) == 11  # 18-20 arasi -> 18'in derinligi


def test_uc_degerler():
    assert depth_for_skill(0) == 1
    assert depth_for_skill(20) == 12
```

- [x] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_engine.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'chess_api.services.bot_engine'`.

- [x] **Step 3: Modülü yaz**

`apps/api/chess_api/services/bot_engine.py`:

```python
"""Bot maci motoru — sunucu tarafi (madde: motor sunucuda).

depth_for_skill saf bir fonksiyondur, testte dogrudan sinanir. get_bot_move
gercek Stockfish binary'sini cagirir — testlerde HER ZAMAN monkeypatch ile
degistirilir (bu bilgisayarda binary kurulu degil, dogrulandi; production'da
Nixpacks ile kurulacak, bkz. tasarim belgesi).
"""
import chess
import chess.engine

# apps/web/lib/play/levels.ts'teki 8 duzeyle AYNI (skill -> depth). Sunucu
# bugune kadar yalnizca skill_level'i biliyordu; depth olmadan bot cok daha
# guclu oynardi (bkz. tasarim belgesi, "sorun B").
_SKILL_TO_DEPTH: list[tuple[int, int]] = [
    (0, 1), (3, 3), (6, 5), (9, 7), (12, 8), (15, 9), (18, 11), (20, 12),
]


def depth_for_skill(skill_level: int) -> int:
    """skill_level tabloda yoksa EN YAKIN ALT basamagin derinligini kullanir
    — sessizce cok guclu bir bot uretmekten daha guvenli."""
    depth = _SKILL_TO_DEPTH[0][1]
    for skill, d in _SKILL_TO_DEPTH:
        if skill_level >= skill:
            depth = d
        else:
            break
    return depth


async def get_bot_move(fen: str, skill_level: int) -> str | None:
    """Verilen pozisyonda botun hamlesini UCI notasyonunda dondurur.

    Motor hatasi/beklenmedik durumda None doner — cagiran taraf bunu 'bu
    turda hamle oynanmadi' olarak ele alir, mac KILITLENMEZ (bugunku istemci
    davranisiyla tutarli, bkz. BotGame.tsx'teki 'motor hatasi oyunu
    kilitlemez' yorumu).
    """
    board = chess.Board(fen)
    depth = depth_for_skill(skill_level)
    transport, engine = await chess.engine.popen_uci("stockfish")
    try:
        await engine.configure({"Skill Level": max(0, min(20, skill_level))})
        result = await engine.play(board, chess.engine.Limit(depth=depth))
        return result.move.uci() if result.move else None
    finally:
        await engine.quit()
```

- [x] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_engine.py -v`
Expected: PASS (3 test — `get_bot_move` bu testlerde HİÇ çağrılmıyor, yalnızca
`depth_for_skill` sınanıyor; gerçek Stockfish binary'sine ihtiyaç YOK).

- [x] **Step 5: Commit**

```bash
git add apps/api/chess_api/services/bot_engine.py apps/api/tests/test_bot_engine.py
git commit -m "feat: bot_engine.py - skill->depth esleme + motor cagri soyutlamasi"
```

---

### Task 2: Sıra kontrolü — bot maçında `student_color`'a bakılsın

**Kök neden:** `_handle_move`'un sıra kontrolü `white_child_id`/`black_child_id`'ye
bakıyor. Bot maçında bunlar sporcunun GERÇEK rengini yansıtmaz (`black_child_id`
her zaman `NULL`, 2. parçanın bilerek verdiği karar — rozet uyumluluğu). Sonuç:
`student_color='b'` seçen bir sporcu, sırası geldiğinde ("child_id != black_id"
çünkü `black_id` `NULL`) hamlesi REDDEDİLİRDİ.

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py:249-263`
- Test: `apps/api/tests/test_bot_move_server.py` (yeni)

- [x] **Step 1: Başarısız testleri yaz**

`apps/api/tests/test_bot_move_server.py`:

```python
"""Bot maci motoru sunucuda — WS entegrasyon testleri.

env fixture'i ve FakeRoom, apps/api/tests/test_live_two_moves.py ve
test_draw_offers_ws.py ile AYNI desendir.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.models import Game, GameType, GameStatus


class FakeRoom:
    """room.broadcast / room.send_to yerine mesajlari toplar."""

    def __init__(self):
        self.broadcasts: list[dict] = []
        self.direct: list[tuple[int, dict]] = []

    async def broadcast(self, message: dict, exclude=None) -> None:
        self.broadcasts.append(message)

    async def send_to(self, child_id: int, message: dict) -> None:
        self.direct.append((child_id, message))


@pytest_asyncio.fixture
async def env(db_engine, monkeypatch):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(
        "chess_api.routers.live_game.get_session_factory", lambda: factory,
    )
    return factory


async def _make_bot_game(env, **kwargs) -> int:
    async with env() as db:
        game = Game(type=GameType.bot, status=GameStatus.active, white_child_id=9,
                    black_bot_level=5, **kwargs)
        db.add(game)
        await db.commit()
        await db.refresh(game)
        return game.id


@pytest.mark.asyncio
async def test_siyah_oynayan_sporcu_hamle_yapabilir(env):
    """Bugunku (duzeltmeden onceki) kod bunu REDDEDERDI — white_id/black_id'ye
    bakar, bot macinda black_id hep None'dur."""
    from chess_api.routers.live_game import _handle_move

    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    gid = await _make_bot_game(env, student_color="b", start_fen=acilis_fen)

    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "e7e5"}, room)

    assert room.direct == [], "not_your_turn HATASI OLMAMALI"
    sans = [m["san"] for m in room.broadcasts if m["type"] == "move_made"]
    assert sans == ["e5"]


@pytest.mark.asyncio
async def test_bot_sirasinda_sporcu_hamle_yapamaz(env):
    """Madalyonun diger yuzu: student_color='w' olan macta, siyahin (botun)
    sirasinda sporcu hamle DENERSE reddedilmeli."""
    from chess_api.routers.live_game import _handle_move

    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    gid = await _make_bot_game(env, student_color="w", start_fen=acilis_fen)

    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "e7e5"}, room)

    assert room.broadcasts == []
    assert room.direct[0][1]["message"] == "not_your_turn"
```

- [x] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_move_server.py -v`
Expected: `test_siyah_oynayan_sporcu_hamle_yapabilir` FAIL — `room.direct` boş
DEĞİL, `not_your_turn` hatası içeriyor (bugünkü kod `child_id != black_id`
kontrolüyle reddediyor, `black_id=None`). İkinci test zaten PASS eder (mevcut
davranışla tesadüfen aynı sonucu verir) — bu NORMAL, tek testin kırmızı olması
yeterli.

- [x] **Step 3: `_handle_move`'un sıra kontrolünü düzelt**

`apps/api/chess_api/routers/live_game.py` içinde, `_handle_move`'un turn-check
bloğunu (satır ~249-263) TAMAMEN şununla değiştir:

```python
        # Turn check. Bot macinda white_id/black_id sporcunun GERCEK rengini
        # yansitmaz (2. parcanin bilerek verdigi karar, rozet uyumlulugu icin,
        # bkz. Game.student_color) — bu yuzden bot macinda student_color'a
        # bakilir. Insan-insan macta eski mantikla MATEMATIKSEL OLARAK AYNI
        # (tum kombinasyonlar calistirilarak dogrulandi, 0 fark).
        whites_turn = current_fen.split()[1] == "w"
        if game.type == GameType.bot:
            student_is_white = (game.student_color or "w") == "w"
            human_may_move = whites_turn == student_is_white
        else:
            human_may_move = (
                (whites_turn and child_id == white_id)
                or (not whites_turn and child_id == black_id)
            )
        if not human_may_move:
            # Reddedilen hamlede istemci kendi tahtasini GERI ALABILSIN diye
            # otorite konum mesaja eklenir; yoksa istemci sunucudan kopar ve
            # sporcu bir daha hamle yapamaz.
            await room.send_to(child_id, {
                "type": "error", "message": "not_your_turn", "fen": current_fen,
            })
            return
```

- [x] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_move_server.py -v`
Expected: PASS (2 test).

- [x] **Step 5: Regresyon — mevcut tüm canlı-maç testleri**

Run: `cd apps/api && python -m pytest tests/test_live_two_moves.py tests/test_draw_offers_ws.py tests/test_game_info_moves.py tests/test_live_game_ws.py -v`
Expected: TÜMÜ PASS — insan-insan maçlarında davranış DEĞİŞMEMELİ (Step 3'teki
yorumda belirtilen "0 fark" iddiası burada gerçek testlerle doğrulanır).

- [x] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py apps/api/tests/test_bot_move_server.py
git commit -m "fix: bot macinda sira kontrolu student_color'a gore calisir"
```

---

### Task 3: Bot hamlesi otomatik oynanır

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py` (import + `_handle_move` sonu + yeni `_play_bot_move`)
- Test: `apps/api/tests/test_bot_move_server.py` (genişletilecek)

- [x] **Step 1: Başarısız testleri yaz**

`apps/api/tests/test_bot_move_server.py` dosyasının SONUNA ekle:

```python
@pytest.mark.asyncio
async def test_insan_hamlesinden_sonra_bot_hamlesi_otomatik_oynanir(env, monkeypatch):
    from chess_api.routers.live_game import _handle_move

    async def sahte_motor(fen, skill_level):
        return "e7e5"  # 1.e4 sonrasi standart cevap

    monkeypatch.setattr("chess_api.routers.live_game.get_bot_move", sahte_motor)

    gid = await _make_bot_game(env, student_color="w")

    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "e2e4"}, room)

    sans = [m["san"] for m in room.broadcasts if m["type"] == "move_made"]
    assert sans == ["e4", "e5"]
    bot_msg = [m for m in room.broadcasts if m["type"] == "move_made"][1]
    assert bot_msg["by_child_id"] is None


@pytest.mark.asyncio
async def test_bot_hamlesi_veritabanina_kaydedilir(env, monkeypatch):
    from chess_api.routers.live_game import _handle_move
    from sqlalchemy import select
    from chess_api.models import GameMove

    async def sahte_motor(fen, skill_level):
        return "e7e5"

    monkeypatch.setattr("chess_api.routers.live_game.get_bot_move", sahte_motor)

    gid = await _make_bot_game(env, student_color="w")
    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "e2e4"}, room)

    async with env() as db:
        moves = (await db.execute(
            select(GameMove).where(GameMove.game_id == gid).order_by(GameMove.ply)
        )).scalars().all()
    assert [m.san for m in moves] == ["e4", "e5"]
    assert moves[1].by_child_id is None


@pytest.mark.asyncio
async def test_insan_mat_ederse_bot_hamle_denemez(env, monkeypatch):
    """is_checkmate zaten True ise sira botta olsa bile motor CAGRILMAMALI —
    mac zaten bitmis."""
    from chess_api.routers.live_game import _handle_move

    called = {"n": 0}

    async def sahte_motor(fen, skill_level):
        called["n"] += 1
        return "a2a3"

    monkeypatch.setattr("chess_api.routers.live_game.get_bot_move", sahte_motor)

    # Fool's mate'e bir hamle kala: 1.f3 e5 2.g4, siyah (sporcu) Qh4# oynar.
    fen = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"
    gid = await _make_bot_game(env, student_color="b", start_fen=fen)

    room = FakeRoom()
    await _handle_move(gid, 9, 9, None, {"uci": "d8h4"}, room)

    over = [m for m in room.broadcasts if m["type"] == "game_over"]
    assert over, "mat sonunda game_over yayinlanmali"
    assert called["n"] == 0, "insan mat ederse bot hamle DENEMEMELI"
```

- [x] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_move_server.py -v -k "otomatik or veritabanina or mat_ederse"`

Expected: **ÜÇ testin ÜÇÜ de FAIL** — hepsi aynı sebeple:
`AttributeError: module 'chess_api.routers.live_game' has no attribute 'get_bot_move'`.

> Bu, `monkeypatch.setattr`'ın davranışıdır: var OLMAYAN bir isim üzerine yazmayı
> reddeder (çalıştırılarak doğrulandı). Üçüncü test (`mat_ederse`) mantıken
> bugünkü kodla da geçebilirdi, ama `monkeypatch.setattr` satırına daha assertion'a
> varmadan takılır. Yani burada "1 tanesi zaten geçiyor" BEKLENMEZ — üçü de
> kırmızıdır ve Step 3'ten sonra üçü birden yeşile döner.

- [x] **Step 3: `_play_bot_move`'u ekle ve `_handle_move`'a bağla**

`apps/api/chess_api/routers/live_game.py` — import bloğuna ekle (satır ~9'un
altına):

```python
from chess_api.services.game_room import get_room, remove_room
from chess_api.services.bot_engine import get_bot_move
```

> `bot_draw` import'u burada EKLENMEZ — o modül henüz yok (Task 4'te
> oluşturulacak). Şimdiden eklemek, bu adımı commit eder etmez
> `ModuleNotFoundError` ile TÜM test paketini kırardı (doğrulandı: modülün
> gerçekten henüz var olmadığı çalıştırılarak teyit edildi). `bot_accepts_draw`
> import'u Task 4 Step 7'de, `bot_draw.py` zaten yazıldıktan SONRA eklenecek.

`_handle_move` fonksiyonunun EN SONUNA (satır ~338, "Mat/pat da bir SONUCtur..."
bloğundan hemen sonra, fonksiyonun kapanışından ÖNCE) ekle:

```python
    # Bot maci: sira artik botta VE mac hala aktifse, sunucu botun hamlesini
    # kendisi oynar (madde: motor sunucuda).
    if game.type == GameType.bot and not (result["is_checkmate"] or result["is_stalemate"]):
        student_is_white = (game.student_color or "w") == "w"
        now_whites_turn = result["fen_after"].split()[1] == "w"
        if now_whites_turn != student_is_white:
            await _play_bot_move(game_id, room)
```

Dosyanın sonuna (`_handle_flag`'den ÖNCE veya SONRA, herhangi bir yere — burada
`_handle_move`'un hemen ardına) yeni fonksiyonu ekle:

```python
async def _play_bot_move(game_id: int, room) -> None:
    """Sirasi bota gelen bir bot macinda, sunucu motoruyla hamleyi kendisi
    oynar. Insan hamlesiyle AYNI adimlar (dogrulama, kayit, saat, mat/pat,
    yayin) — by_child_id=None 'bot' anlamina gelir.

    BILINEN SINIR: _handle_move'daki gibi bir "bayrak dustu mu" on kontrolu
    YOKTUR. Bot saniyenin altinda hamle uretttigi icin botun kendi suresini
    tuketip bayrak dusurmesi pratikte olmaz; dayaniklilik senaryolari tasarim
    belgesinde ACIKCA kapsam disi birakildi. Sporcunun bayragi zaten kendi
    hamlesinde (_handle_move) kontrol ediliyor.
    """
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        current_fen, ply = await _current_fen_and_ply(db, game_id)
        whites_turn = current_fen.split()[1] == "w"

        uci = await get_bot_move(current_fen, game.black_bot_level or 0)
        if not uci:
            return  # motor hamle uretemedi — mac kilitlenmez, ilerlemez

        result = validate_move(current_fen, uci)
        if not result:
            logger.error("bot motoru gecersiz hamle uretti: %s @ %s", uci, current_fen)
            return

        await _apply_clock_on_move(db, game, whites_turn)

        db.add(GameMove(
            game_id=game_id, ply=ply, san=result["san"],
            fen_after=result["fen_after"], by_child_id=None,
        ))

        if result["is_checkmate"]:
            game.status = GameStatus.finished
            game.result = GameResult.white_wins if whites_turn else GameResult.black_wins
        elif result["is_stalemate"]:
            game.status = GameStatus.finished
            game.result = GameResult.draw

        await db.commit()

    await room.broadcast({
        "type": "move_made",
        "uci": uci,
        "san": result["san"],
        "fen_after": result["fen_after"],
        "is_checkmate": result["is_checkmate"],
        "is_stalemate": result["is_stalemate"],
        "by_child_id": None,
    })

    async with get_session_factory()() as db2:
        fresh = await db2.get(Game, game_id)
        if fresh and fresh.base_ms is not None:
            await room.broadcast(
                _clock_payload(fresh, result["fen_after"].split()[1] == "w")
            )

    if result["is_checkmate"] or result["is_stalemate"]:
        async with get_session_factory()() as db3:
            finished = await db3.get(Game, game_id)
            final = finished.result.value if finished and finished.result else None
        if final:
            await room.broadcast({"type": "game_over", "result": final, "by_resign": False})
```

- [x] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_move_server.py -v`
Expected: PASS (5 test — Task 2'nin 2'si + bu adımın 3'ü).

- [x] **Step 5: Regresyon**

Run: `cd apps/api && python -m pytest tests/test_live_two_moves.py tests/test_draw_offers_ws.py tests/test_game_info_moves.py tests/test_live_game_ws.py -v`
Expected: TÜMÜ PASS.

- [x] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py apps/api/tests/test_bot_move_server.py
git commit -m "feat: bot hamlesi insan hamlesinden sonra sunucuda otomatik oynanir"
```

---

### Task 4: Beraberlik teklifine bot cevabı

**Files:**
- Create: `apps/api/chess_api/services/bot_draw.py`
- Test: `apps/api/tests/test_bot_draw.py` (yeni, saf mantık)
- Modify: `apps/api/chess_api/routers/live_game.py:390-412` (`_handle_offer_draw`)
- Test: `apps/api/tests/test_bot_draw_ws.py` (yeni, WS entegrasyonu)

- [x] **Step 1: Saf mantık için başarısız testler yaz**

`apps/api/tests/test_bot_draw.py`:

```python
"""apps/web/lib/play/botDraw.ts ile AYNI senaryolar — Python tarafi."""
from chess_api.services.bot_draw import material_diff, bot_accepts_draw

BASLANGIC = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
# Beyazin fazla bir veziri var (siyahin veziri yok).
BEYAZ_ONDE = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
# Siyahin fazla bir kalesi var (beyazin a1 kalesi yok).
SIYAH_ONDE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w KQkq - 0 1"


def test_baslangic_konumunda_fark_yoktur():
    assert material_diff(BASLANGIC) == 0


def test_eksik_siyah_vezir_beyaz_lehine_9_yapar():
    assert material_diff(BEYAZ_ONDE) == 9


def test_eksik_beyaz_kale_siyah_lehine_5_yapar():
    assert material_diff(SIYAH_ONDE) == -5


def test_yalnizca_tas_dizilimi_okunur():
    # "b KQkq" icindeki b ve K harfleri tas sanilirsa sonuc bozulur.
    assert material_diff(BASLANGIC.replace(" w ", " b ")) == 0


def test_esit_konumda_kabul_eder():
    assert bot_accepts_draw(BASLANGIC, "b") is True
    assert bot_accepts_draw(BASLANGIC, "w") is True


def test_bot_acik_ara_ondeyse_reddeder():
    assert bot_accepts_draw(BEYAZ_ONDE, "w") is False


def test_bot_geride_ise_kabul_eder():
    assert bot_accepts_draw(BEYAZ_ONDE, "b") is True


def test_bir_piyonluk_ustunluk_reddetmeye_yetmez():
    bir_piyon_fazla = "rnbqkbnr/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    assert material_diff(bir_piyon_fazla) == 1
    assert bot_accepts_draw(bir_piyon_fazla, "w") is True
```

- [x] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_draw.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'chess_api.services.bot_draw'`.

- [x] **Step 3: `bot_draw.py`'yi yaz**

`apps/api/chess_api/services/bot_draw.py`:

```python
"""Bota beraberlik teklifi — sunucu tarafi saf mantik.

apps/web/lib/play/botDraw.ts'teki materialDiff/botAcceptsDraw ile BIREBIR
AYNI mantik (Python'a birebir cevrildi).
"""
VALUE = {"p": 1, "n": 3, "b": 3, "r": 5, "q": 9, "k": 0}


def material_diff(fen: str) -> int:
    """FEN'in tas dizilimi bolumunden malzeme farkini hesaplar (beyaz lehine)."""
    board = fen.strip().split()[0]
    diff = 0
    for ch in board:
        lower = ch.lower()
        v = VALUE.get(lower)
        if v is None:
            continue  # rakam veya '/'
        diff += -v if ch == lower else v  # kucuk harf siyah, buyuk beyaz
    return diff


def bot_accepts_draw(fen: str, bot_color: str) -> bool:
    """Bot teklifi kabul eder mi? bot_color botun rengi ('w'/'b')."""
    white = material_diff(fen)
    bot_lead = white if bot_color == "w" else -white
    return bot_lead <= 1
```

- [x] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_draw.py -v`
Expected: PASS (8 test).

- [x] **Step 5: WS entegrasyonu için başarısız testler yaz**

`apps/api/tests/test_bot_draw_ws.py`:

```python
"""Bot maci — beraberlik teklifine sunucu tarafi bot cevabi (WS).

env fixture'i, apps/api/tests/test_live_two_moves.py ile AYNI desendir.
"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.models import Game, GameType, GameStatus


class FakeRoom:
    def __init__(self):
        self.broadcasts: list[dict] = []
        self.direct: list[tuple[int, dict]] = []

    async def broadcast(self, message: dict, exclude=None) -> None:
        self.broadcasts.append(message)

    async def send_to(self, child_id: int, message: dict) -> None:
        self.direct.append((child_id, message))


@pytest_asyncio.fixture
async def env(db_engine, monkeypatch):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(
        "chess_api.routers.live_game.get_session_factory", lambda: factory,
    )
    return factory


async def _make_bot_game(env, **kwargs) -> int:
    async with env() as db:
        game = Game(type=GameType.bot, status=GameStatus.active, white_child_id=9,
                    black_bot_level=5, **kwargs)
        db.add(game)
        await db.commit()
        await db.refresh(game)
        return game.id


BEYAZ_ONDE = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@pytest.mark.asyncio
async def test_bot_geride_teklifi_kabul_eder_ve_mac_biter(env):
    from chess_api.routers.live_game import _handle_offer_draw

    # student_color='w' -> bot siyah; beyaz vezir fazla -> bot GERIDE.
    gid = await _make_bot_game(env, student_color="w", start_fen=BEYAZ_ONDE)

    room = FakeRoom()
    await _handle_offer_draw(gid, 9, 9, room)

    over = [m for m in room.broadcasts if m["type"] == "game_over"]
    assert over and over[-1]["result"] == "1/2-1/2"


@pytest.mark.asyncio
async def test_bot_acik_ara_ondeyse_reddeder_ve_sporcuya_ULASIR(env):
    """Sorun A'nin regresyon testi: mevcut _handle_decline_draw kullanilsaydi
    bu mesaj HIC sporcuya ULASMAZDI (exclude=child_id, odada tek kisi var)."""
    from chess_api.routers.live_game import _handle_offer_draw

    # student_color='b' -> bot beyaz; beyaz vezir fazla -> bot ONDE.
    gid = await _make_bot_game(env, student_color="b", start_fen=BEYAZ_ONDE)

    room = FakeRoom()
    await _handle_offer_draw(gid, 9, 9, room)

    declined = [m for m in room.broadcasts if m["type"] == "draw_declined"]
    assert declined, "sporcuya draw_declined mesaji ULASMALI"
    assert declined[0]["by_child_id"] is None
```

- [x] **Step 6: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_draw_ws.py -v`
Expected: FAIL — her iki test de, bugünkü `_handle_offer_draw`'ın bot maçında
hiçbir bot cevabı tetiklememesi yüzünden `room.broadcasts` boş kalır
(`game_over`/`draw_declined` hiç yayınlanmaz).

- [x] **Step 7: `_handle_offer_draw`'ı güncelle**

Önce `apps/api/chess_api/routers/live_game.py`'nin import bloğuna, Task 3'te
eklenen `bot_engine` satırının hemen ALTINA ekle:

```python
from chess_api.services.bot_engine import get_bot_move
from chess_api.services.bot_draw import bot_accepts_draw
```

(Yalnızca `bot_draw` satırı YENİ; `bot_engine` satırı Task 3'ten zaten var,
referans için gösteriliyor.)

Sonra `_handle_offer_draw` fonksiyonunun (satır ~390-412) SON İKİ satırını:

```python
    await room.send_to(child_id, {"type": "draw_offer_sent", "offers_used": offers_used})
    await room.broadcast({"type": "draw_offered", "by_child_id": child_id}, exclude=child_id)
```

şununla değiştir:

```python
    await room.send_to(child_id, {"type": "draw_offer_sent", "offers_used": offers_used})
    if game.type == GameType.bot:
        await _resolve_bot_draw_response(game_id, room)
    else:
        await room.broadcast({"type": "draw_offered", "by_child_id": child_id}, exclude=child_id)
```

Dosyanın sonuna (`_handle_offer_draw`'ın hemen ardına) yeni fonksiyonu ekle:

```python
async def _resolve_bot_draw_response(game_id: int, room) -> None:
    """Bot maci: teklife botun kendi karari sunucu tarafinda verilir — insan-
    insan macta bunu yapan ikinci oyuncu yokken, burada 'ikinci oyuncu'
    sunucunun kendisidir."""
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        student_is_white = (game.student_color or "w") == "w"
        bot_color = "b" if student_is_white else "w"

    if bot_accepts_draw(current_fen, bot_color):
        await _handle_draw(game_id, room)
    else:
        # _handle_decline_draw KULLANILMAZ: exclude=child_id ile yayinlar,
        # bot macinda odadaki TEK katilimci sporcunun kendisi oldugu icin
        # mesaj HIC KIMSEYE gitmez (olculdu, bkz. tasarim belgesi sorun A).
        await room.broadcast({"type": "draw_declined", "by_child_id": None})
```

- [x] **Step 8: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_draw_ws.py -v`
Expected: PASS (2 test).

- [x] **Step 9: Regresyon**

Run: `cd apps/api && python -m pytest tests/test_live_two_moves.py tests/test_draw_offers_ws.py tests/test_game_info_moves.py tests/test_live_game_ws.py tests/test_bot_move_server.py -v`
Expected: TÜMÜ PASS — insan-insan maçındaki beraberlik akışı DEĞİŞMEMELİ
(`_handle_offer_draw`'a yalnızca bot dalı EKLENDİ, insan-insan `else` dalı
bugünküyle BİREBİR AYNI).

- [x] **Step 10: Commit**

```bash
git add apps/api/chess_api/services/bot_draw.py apps/api/tests/test_bot_draw.py apps/api/chess_api/routers/live_game.py apps/api/tests/test_bot_draw_ws.py
git commit -m "feat: bota beraberlik teklifine sunucu tarafi cevap"
```

---

### Task 5: Tam test kapısı ve rapor

**Files:** (yok — yalnızca doğrulama)

- [x] **Step 1: Backend tam paketi**

Run: `cd apps/api && python -m pytest -q`
Expected: TÜM testler PASS (mevcut 367 test + bu planın eklediği testler:
3 + 2 + 3 + 8 + 2 = 18 → toplam 385).

- [x] **Step 2: Frontend'e dokunulmadı**

Bu plan yalnızca `apps/api` içinde çalışıyor; `apps/web` hiç değişmedi. Web
test paketini koşmaya gerek yok.

- [x] **Step 3: Nixpacks/Stockfish kurulumu — BU PLANIN KAPSAMINDA DEĞİL**

Bu adımda `apps/api/nixpacks.toml` OLUŞTURULMAZ, `apps/api/railway.json`
DEĞİŞTİRİLMEZ. Sebep: bu, canlı Railway servisinin BUILD sürecini etkileyen bir
değişiklik — tasarım belgesinde belirtildiği gibi önce staging'de denenmeli,
production'a doğrudan uygulanmamalı. Bu planın kodu (motor çağrısının NASIL
yapılandırılacağı) hazır ve TEST EDİLMİŞ durumda; gerçek binary kurulumu ve
denemesi, kullanıcıyla birlikte AYRI bir karar/adım olarak ele alınacak — bu
plan bu noktada bilerek durur.

- [x] **Step 4: Kullanıcıya rapor + canlıya gönderme kararı**

Bu adımda kod yazılmaz. KURAL #0'a uygun sade Türkçe ile şunlar özetlenir:
- Bot hamlesi artık sunucuda hesaplanıyor (kod hazır, testlerle doğrulandı).
- `BotGame.tsx` henüz bu akışa bağlı DEĞİL — bu yüzden bu değişikliğin CANLIDA
  hiçbir gözle görülür etkisi YOK (yeni kod, eski akışı hiç değiştirmiyor,
  yalnızca EKLİYOR — hiçbir mevcut ekran bu yeni yolu çağırmıyor).
- Gerçek Stockfish kurulumu (Task 5 Step 3) HENÜZ yapılmadı — bu ayrı konuşulmalı.
- Bu yüzden `git push origin main` için onay istenirken, kullanıcıya "bu
  değişikliğin şu an hiçbir şeyi görünür şekilde değiştirmediği, yalnızca bir
  sonraki (son) parça için altyapı olduğu" açıkça belirtilir.

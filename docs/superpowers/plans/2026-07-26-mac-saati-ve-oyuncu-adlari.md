# Maç Saati ve Oyuncu Adları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İnsan-insan maçlarda sunucunun tuttuğu gerçek bir satranç saati ve maç ekranında iki oyuncunun adı.

**Architecture:** Saat verisi `games` tablosunda (5 nullable sütun), hesap saf bir modülde (`clock.py`, zaman enjekte), otorite sunucuda. İstemci yalnızca gösterir ve "rakibin süresi bitti" iddiasında bulunur; sunucu doğrular.

**Tech Stack:** FastAPI + WebSocket, SQLAlchemy 2 async, Alembic, pytest; Next.js 15 / React 19 / TypeScript, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-26-mac-saati-ve-oyuncu-adlari-design.md`

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/api/alembic/versions/20260727_GameClock_add.py` **(yeni)** | `games` tablosuna 5 nullable sütun. |
| `apps/api/chess_api/models/game.py` **(değişir)** | Aynı 5 alan modelde. |
| `apps/api/chess_api/services/clock.py` **(yeni)** | Saf saat mantığı, zaman parametre. |
| `apps/api/chess_api/routers/live_game.py` **(değişir)** | Tempo kaydı, `game_info`, `clock`, `flag`. |
| `apps/web/lib/play/clockFormat.ts` **(yeni)** | Saf: ms → `MM:SS` / `SS.d`. |
| `apps/web/components/play/PlayerClock.tsx` **(yeni)** | Ad + saat satırı. |
| `apps/web/components/LiveGame.tsx` **(değişir)** | İki saat, yerel geri sayım, `flag`. |

**Dokunulmaz:** müfredat tabloları (KURAL #4), `game_moves.time_left_seconds`, bot maçları,
`matchmaking.py` kuyruk akışı.

---

## Task 1: Migration + model alanları

**Files:**
- Create: `apps/api/alembic/versions/20260727_GameClock_add.py`
- Modify: `apps/api/chess_api/models/game.py`
- Test: `apps/api/tests/test_game_clock_model.py`

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_game_clock_model.py`:

```python
import pytest
from chess_api.models.game import Game, GameType, GameStatus


@pytest.mark.asyncio
async def test_saat_alanlari_bos_birakilabilir(db):
    """ESKI MACLAR: saat alanlari NULL kalir, mac calismaya devam eder."""
    g = Game(type=GameType.human, status=GameStatus.active,
             white_child_id=1, black_child_id=2)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    assert g.base_ms is None
    assert g.increment_ms is None
    assert g.white_ms is None
    assert g.black_ms is None
    assert g.last_clock_at is None


@pytest.mark.asyncio
async def test_saat_alanlari_yazilip_okunabilir(db):
    from datetime import datetime
    now = datetime(2026, 7, 27, 10, 0, 0)
    g = Game(type=GameType.human, status=GameStatus.active,
             white_child_id=1, black_child_id=2,
             base_ms=300000, increment_ms=3000,
             white_ms=300000, black_ms=300000, last_clock_at=now)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    assert g.base_ms == 300000
    assert g.increment_ms == 3000
    assert g.last_clock_at == now
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_game_clock_model.py -q
```

Beklenen: FAIL — `TypeError: 'base_ms' is an invalid keyword argument for Game`.

- [ ] **Step 3: Modele alanları ekle**

`apps/api/chess_api/models/game.py` içinde `start_fen` satırının **altına**:

```python
    # ── Mac saati (insan-insan maclar). HEPSI NULL OLABILIR: eski maclarda
    # bos kalir ve saat mantigi HIC calismaz (geriye donuk uyum, KURAL #3).
    # Milisaniye kullanilir; saniyeyle tutulursa her hamlede yuvarlama kaybi olur.
    base_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    increment_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    white_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_clock_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

- [ ] **Step 4: Migration yaz**

`apps/api/alembic/versions/20260727_GameClock_add.py`:

```python
"""games tablosuna mac saati sutunlari

Revision ID: GameClock
Revises: PoolImages

Yalnizca SUTUN EKLER. Hepsi nullable oldugu icin mevcut satirlar oldugu gibi
kalir ve devam eden maclar bozulmaz (KURAL #3). Mufredat tablolarina
dokunulmaz (KURAL #4). TRUNCATE/DELETE yoktur.
"""
import sqlalchemy as sa
from alembic import op

revision = "GameClock"
down_revision = "PoolImages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("base_ms", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("increment_ms", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("white_ms", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("black_ms", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("last_clock_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "last_clock_at")
    op.drop_column("games", "black_ms")
    op.drop_column("games", "white_ms")
    op.drop_column("games", "increment_ms")
    op.drop_column("games", "base_ms")
```

- [ ] **Step 5: Testleri ve migration başını doğrula**

```bash
cd apps/api && python -m pytest tests/test_game_clock_model.py -q && python -m alembic heads
```

Beklenen: 2 test PASS; `alembic heads` **tek** head verir ve `GameClock` olur.
İki head çıkarsa DUR — `down_revision` yanlış demektir.

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/models/game.py apps/api/alembic/versions/20260727_GameClock_add.py apps/api/tests/test_game_clock_model.py
git commit -m "feat: games tablosuna mac saati sutunlari"
```

---

## Task 2: `clock.py` saf saat mantığı

**Files:**
- Create: `apps/api/chess_api/services/clock.py`
- Test: `apps/api/tests/test_clock.py`

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_clock.py`:

```python
from chess_api.services.clock import ClockState, elapsed_ms, apply_move, is_flagged

T0 = 1_000_000.0  # sabit bir an (epoch saniye)


def _state(white=300_000, black=300_000, last=T0, inc=0):
    return ClockState(white_ms=white, black_ms=black, last_at=last, increment_ms=inc)


def test_elapsed_ms_gecen_sureyi_hesaplar():
    assert elapsed_ms(T0, T0 + 2.5) == 2500


def test_elapsed_ms_negatif_donmez():
    """Sunucu saati geri giderse 0 kabul edilir — negatif sure olmaz."""
    assert elapsed_ms(T0, T0 - 5) == 0


def test_apply_move_hamleyi_yapanin_saatinden_duser():
    s = apply_move(_state(), white_to_move=True, now=T0 + 2)
    assert s.white_ms == 298_000
    assert s.black_ms == 300_000      # rakibin saatine DOKUNULMAZ
    assert s.last_at == T0 + 2


def test_apply_move_siyah_oynayinca_siyahtan_duser():
    s = apply_move(_state(), white_to_move=False, now=T0 + 3)
    assert s.black_ms == 297_000
    assert s.white_ms == 300_000


def test_artirim_hamleden_SONRA_eklenir():
    """5+3: hamle 2 sn surdu -> 300000 - 2000 + 3000 = 301000."""
    s = apply_move(_state(inc=3000), white_to_move=True, now=T0 + 2)
    assert s.white_ms == 301_000


def test_saat_sifirin_altina_dusmez():
    s = apply_move(_state(white=1000), white_to_move=True, now=T0 + 10)
    assert s.white_ms == 0


def test_suresi_biten_oyuncuya_artirim_verilmez():
    """Sure bittiyse hamle gecerli sayilmaz; artirim eklenerek diriltilmez."""
    s = apply_move(_state(white=1000, inc=3000), white_to_move=True, now=T0 + 10)
    assert s.white_ms == 0


def test_is_flagged_hamle_beklerken_de_calisir():
    st = _state(white=5_000)
    assert is_flagged(st, white_to_move=True, now=T0 + 4) is False
    assert is_flagged(st, white_to_move=True, now=T0 + 6) is True


def test_is_flagged_sirasi_olmayani_bayraklamaz():
    st = _state(white=1_000, black=300_000)
    # Sira SIYAHTA; beyazin suresi az olsa da beyaz bayraklanmaz.
    assert is_flagged(st, white_to_move=False, now=T0 + 60) is False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_clock.py -q
```

Beklenen: FAIL — `ModuleNotFoundError: No module named 'chess_api.services.clock'`.

- [ ] **Step 3: Write the implementation**

`apps/api/chess_api/services/clock.py`:

```python
"""Satranc saati — saf mantik.

Zaman PARAMETRE olarak gelir (now). Boylece testler beklemez ve sunucu saati
tek bir yerden okunur. presence.py ve offer_sides.py ile ayni desen.

Milisaniye kullanilir: artirim ve gecen sure saniyenin altinda birikir.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class ClockState:
    white_ms: int
    black_ms: int
    last_at: float      # epoch saniye
    increment_ms: int


def elapsed_ms(last_at: float, now: float) -> int:
    """Gecen sure (ms). Sunucu saati geri giderse 0 — negatif sure olmaz."""
    delta = now - last_at
    return int(delta * 1000) if delta > 0 else 0


def apply_move(state: ClockState, white_to_move: bool, now: float) -> ClockState:
    """Hamleyi YAPANIN saatinden gecen sureyi duser, artirimi ekler.

    Rakibin saatine dokunulmaz. Saat 0'in altina dusmez; 0'a dusen oyuncuya
    artirim da verilmez (sure bitmistir, hamle onu diriltmez).
    """
    spent = elapsed_ms(state.last_at, now)
    if white_to_move:
        left = state.white_ms - spent
        left = 0 if left <= 0 else left + state.increment_ms
        return ClockState(left, state.black_ms, now, state.increment_ms)
    left = state.black_ms - spent
    left = 0 if left <= 0 else left + state.increment_ms
    return ClockState(state.white_ms, left, now, state.increment_ms)


def is_flagged(state: ClockState, white_to_move: bool, now: float) -> bool:
    """Sirasi gelen oyuncunun suresi bitti mi?

    Hamle BEKLERKEN de dogru cevap verir: son hamleden bu yana gecen sure
    sıradaki oyuncunun kalanini astiysa True.
    """
    spent = elapsed_ms(state.last_at, now)
    remaining = state.white_ms if white_to_move else state.black_ms
    return spent >= remaining
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && python -m pytest tests/test_clock.py -q
```

Beklenen: PASS — 9 test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/services/clock.py apps/api/tests/test_clock.py
git commit -m "feat: saf satranc saati mantigi (zaman enjekte)"
```

---

## Task 3: Tempo maç kaydına yazılır

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py`
- Test: `apps/api/tests/test_game_clock_ws.py`

Bugün seçilen tempo maç açılırken **kayboluyor** — bu düzeltilmeden saat çalışamaz.

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_game_clock_ws.py`:

```python
import pytest
from chess_api.routers.live_game import _create_human_game
from chess_api.models.game import Game


@pytest.mark.asyncio
async def test_tempolu_mac_saat_alanlariyla_acilir(app, db):
    """5+3 secilirse mac 300000 ms ve 3000 ms artirimla baslar."""
    gid = await _create_human_game(1, 2, base_ms=300_000, increment_ms=3_000)
    g = await db.get(Game, gid)
    assert g.base_ms == 300_000
    assert g.increment_ms == 3_000
    assert g.white_ms == 300_000
    assert g.black_ms == 300_000
    assert g.last_clock_at is not None


@pytest.mark.asyncio
async def test_temposuz_mac_saatsiz_acilir(app, db):
    """REGRESYON: eski cagiranlar (kuyruk akisi) tempo vermez, bozulmaz."""
    gid = await _create_human_game(1, 2)
    g = await db.get(Game, gid)
    assert g.base_ms is None
    assert g.white_ms is None
    assert g.last_clock_at is None
```

**NOT:** `_create_human_game` kendi oturumunu açar (`get_session_factory()`), test
oturumu değil. `app` fixture'ı `get_db` override'ını kurar ama WS/servis kodu bunu
kullanmaz. Bu test bu yüzden **`app` fixture'ını da ister**: `create_app()` çağrısı
`get_session_factory()`'yi test motoruna bağlar. Test çalışmazsa (gerçek veritabanına
bağlanmaya kalkarsa) DUR ve raporla — sahte geçen test yazma.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_game_clock_ws.py -q
```

Beklenen: FAIL — `_create_human_game() got an unexpected keyword argument 'base_ms'`.

- [ ] **Step 3: `_create_human_game`'i genişlet**

`apps/api/chess_api/routers/live_game.py` içindeki fonksiyonu değiştir:

```python
async def _create_human_game(white_child_id: int, black_child_id: int,
                             base_ms: int | None = None,
                             increment_ms: int | None = None) -> int:
    """Insan-insan mac kaydi.

    base_ms verilirse saat de kurulur. Varsayilanlar None oldugu icin mevcut
    cagiranlar (kuyruk akisi) aynen calisir — saatsiz mac acilir.
    """
    async with get_session_factory()() as db:
        game = Game(
            type=GameType.human,
            white_child_id=white_child_id,
            black_child_id=black_child_id,
            status=GameStatus.active,
            base_ms=base_ms,
            increment_ms=increment_ms,
            white_ms=base_ms,
            black_ms=base_ms,
            last_clock_at=datetime.utcnow() if base_ms is not None else None,
        )
        db.add(game)
        await db.commit()
        await db.refresh(game)
        return game.id
```

Dosyanın en üstüne import ekle (yoksa):

```python
from datetime import datetime
```

- [ ] **Step 4: Teklif panosu ve doğrudan davet tempoyu geçirsin**

`_handle_offer_take` içindeki oyun oluşturma satırını değiştir:

```python
    game_id = await _create_human_game(
        white_id, black_id,
        base_ms=int(offer["tc_base"]) * 1000 or None,
        increment_ms=int(offer["tc_increment"]) * 1000,
    )
```

**DİKKAT — tuzak:** `int(x) * 1000 or None` ifadesi `tc_base = 0` iken `None` verir;
bu istenen davranıştır (süre 0 = saatsiz). Ama `tc_increment` için `or None`
**KULLANILMAZ**: 0 artırım geçerli bir değerdir (`5+0`).

`_handle_challenge_accept` içindeki satırı değiştir:

```python
    base_s = criteria.get("tc_base")
    inc_s = criteria.get("tc_increment")
    game_id = await _create_human_game(
        white_id, black_id,
        base_ms=int(base_s) * 1000 if isinstance(base_s, int) and base_s > 0 else None,
        increment_ms=int(inc_s) * 1000 if isinstance(inc_s, int) else 0,
    )
```

- [ ] **Step 5: Testleri çalıştır**

```bash
cd apps/api && python -m pytest tests/test_game_clock_ws.py -q
```

Beklenen: PASS — 2 test.

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py apps/api/tests/test_game_clock_ws.py
git commit -m "feat: secilen tempo artik mac kaydina yaziliyor"
```

---

## Task 4: `/ws/game` — `game_info`, `clock`, `flag`

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py`
- Test: `apps/api/tests/test_game_clock_ws.py` (EKLEME)

- [ ] **Step 1: Write the failing test**

`apps/api/tests/test_game_clock_ws.py` dosyasının **sonuna** ekle:

```python
from chess_api.services.clock import ClockState, is_flagged


@pytest.mark.asyncio
async def test_hamle_sonrasi_saat_dusulur(app, db):
    """Hamle isleyince oynayanin saati azalir, rakibinki durur."""
    from datetime import datetime, timedelta
    from chess_api.routers.live_game import _apply_clock_on_move
    from chess_api.models.game import Game

    gid = await _create_human_game(1, 2, base_ms=300_000, increment_ms=0)
    g = await db.get(Game, gid)
    # Son hamle 4 saniye once islenmis gibi geri al
    g.last_clock_at = datetime.utcnow() - timedelta(seconds=4)
    await db.commit()

    flagged = await _apply_clock_on_move(db, g, white_to_move=True)
    assert flagged is False
    assert 295_000 <= g.white_ms <= 296_500   # ~4 sn dustu
    assert g.black_ms == 300_000              # rakip dokunulmadi


@pytest.mark.asyncio
async def test_saatsiz_macta_clock_islenmez(app, db):
    """REGRESYON: eski mac (base_ms None) hamlede saat hesabina girmez."""
    from chess_api.routers.live_game import _apply_clock_on_move
    from chess_api.models.game import Game

    gid = await _create_human_game(1, 2)
    g = await db.get(Game, gid)
    flagged = await _apply_clock_on_move(db, g, white_to_move=True)
    assert flagged is False
    assert g.white_ms is None


def test_sahte_flag_maci_bitirmez():
    """Sure dolmamisken gelen 'flag' iddiasi REDDEDILIR (saf kontrol)."""
    st = ClockState(white_ms=200_000, black_ms=200_000, last_at=1_000_000.0,
                    increment_ms=0)
    assert is_flagged(st, white_to_move=True, now=1_000_010.0) is False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && python -m pytest tests/test_game_clock_ws.py -q
```

Beklenen: FAIL — `cannot import name '_apply_clock_on_move'`.

- [ ] **Step 3: Yardımcıları yaz**

`apps/api/chess_api/routers/live_game.py` içine, `_create_human_game`'in **altına**:

```python
from datetime import timezone
from chess_api.services.clock import ClockState, apply_move, is_flagged


def _epoch(dt: datetime) -> float:
    """Naive UTC datetime -> epoch saniye. Veritabanina datetime.utcnow() ile
    yaziliyor (naive), bu yuzden UTC oldugu ACIKCA soylenir."""
    return dt.replace(tzinfo=timezone.utc).timestamp()


def _clock_state(game: Game) -> ClockState | None:
    """Macin saat durumu; saatsiz macta None."""
    if game.base_ms is None or game.last_clock_at is None:
        return None
    return ClockState(
        white_ms=game.white_ms or 0,
        black_ms=game.black_ms or 0,
        last_at=_epoch(game.last_clock_at),
        increment_ms=game.increment_ms or 0,
    )


async def _apply_clock_on_move(db, game: Game, white_to_move: bool) -> bool:
    """Hamlede saati isler. Sure bittiyse True doner (hamle islenmemeli).

    Saatsiz macta hicbir sey yapmaz ve False doner.
    """
    st = _clock_state(game)
    if st is None:
        return False
    now = datetime.utcnow()
    if is_flagged(st, white_to_move, _epoch(now)):
        return True
    new = apply_move(st, white_to_move, _epoch(now))
    game.white_ms = new.white_ms
    game.black_ms = new.black_ms
    game.last_clock_at = now
    await db.commit()
    return False


def _clock_payload(game: Game, white_to_move: bool) -> dict:
    return {
        "type": "clock",
        "white_ms": game.white_ms,
        "black_ms": game.black_ms,
        "white_to_move": white_to_move,
    }
```

- [ ] **Step 4: `_handle_move` içine saati bağla**

**Sıra kritiktir — iki ayrı yere iki ayrı şey konur:**

1. **Süre bitti mi kontrolü** → sıra kontrolünden sonra, `validate_move`'dan **önce**.
2. **Saati işletme (düşme + artırım)** → `validate_move` **BAŞARILI OLDUKTAN sonra**.

Neden ayrı: saat geçersiz hamlede de işletilirse, sporcu tahtaya olmayacak hamleler
yağdırarak **her denemede artırım kazanır**. Artırım yalnızca gerçekten yapılan
hamleye verilir.

**(1)** `whites_turn` sıra kontrolünden sonra, `validate_move`'dan önce:

```python
        # Sure bittiyse hamle HIC islenmez, mac kapanir.
        _st = _clock_state(game)
        if _st is not None and is_flagged(_st, whites_turn, _epoch(datetime.utcnow())):
            game.status = GameStatus.finished
            game.result = GameResult.black_wins if whites_turn else GameResult.white_wins
            game.finished_at = datetime.utcnow()
            await db.commit()
            await room.broadcast({
                "type": "game_over",
                "result": game.result.value,
                "by_resign": False,
                "by_flag": True,
            })
            return
```

**(2)** `validate_move` başarılı olduktan, yani `if not result: ... return` bloğunun
**hemen ardından** (hamle veritabanına eklenmeden önce):

```python
        # Hamle GECERLI — saati simdi islet. Artirim yalnizca gercek hamleye verilir.
        await _apply_clock_on_move(db, game, whites_turn)
```

Ve `move_made` yayınının **hemen ardından** saat yayını ekle:

```python
    # Hamle sonrasi guncel saat (saatsiz macta white_ms None gider, istemci cizmez)
    async with get_session_factory()() as db2:
        fresh = await db2.get(Game, game_id)
        if fresh and fresh.base_ms is not None:
            await room.broadcast(
                _clock_payload(fresh, result["fen_after"].split()[1] == "w")
            )
```

- [ ] **Step 5: `game_info` ve `flag` mesajlarını ekle**

`game_ws` içinde, `room.join(...)` ve `player_joined` yayınından **sonra**:

```python
    # Katilana macin kimlik ve saat bilgisi — isimler burada gider.
    async with get_session_factory()() as db:
        g = await db.get(Game, game_id)
        w = await db.get(ChildProfile, g.white_child_id) if g.white_child_id else None
        b = await db.get(ChildProfile, g.black_child_id) if g.black_child_id else None
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        await websocket.send_json({
            "type": "game_info",
            "white_name": w.display_name if w else "Sporcu",
            "black_name": b.display_name if b else "Sporcu",
            "white_ms": g.white_ms,
            "black_ms": g.black_ms,
            "increment_ms": g.increment_ms,
            "white_to_move": current_fen.split()[1] == "w",
        })
```

Mesaj döngüsüne yeni dal:

```python
            elif mtype == "flag":
                await _handle_flag(game_id, room)
```

Ve `_handle_move`'un **altına** yeni fonksiyon:

```python
async def _handle_flag(game_id: int, room) -> None:
    """'Rakibimin suresi bitti' iddiasi. SUNUCU KENDI HESABIYLA DOGRULAR;
    tutmazsa hicbir sey yapilmaz (sessiz). Istemciye asla guvenilmez."""
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        st = _clock_state(game)
        if st is None:
            return
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        white_to_move = current_fen.split()[1] == "w"
        if not is_flagged(st, white_to_move, _epoch(datetime.utcnow())):
            return  # sahte iddia
        game.status = GameStatus.finished
        game.result = GameResult.black_wins if white_to_move else GameResult.white_wins
        game.finished_at = datetime.utcnow()
        await db.commit()
        final = game.result.value
    await room.broadcast({
        "type": "game_over", "result": final, "by_resign": False, "by_flag": True,
    })
```

- [ ] **Step 6: Testleri çalıştır**

```bash
cd apps/api && python -m pytest tests/test_game_clock_ws.py tests/test_live_game_ws.py -q
```

Beklenen: hepsi PASS (yeni 5 + mevcut canlı oyun testleri bozulmamalı).

- [ ] **Step 7: Backend tam paket**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: **311** test PASS.
Hesap: 295 (mevcut) + 2 (Task 1) + 9 (Task 2) + 2 (Task 3) + 3 (Task 4) = 311.
Sayı tutmuyorsa DUR, nedenini bul ve **gerçek sayıyı** raporla (KURAL #1).

- [ ] **Step 8: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py apps/api/tests/test_game_clock_ws.py
git commit -m "feat: /ws/game saat mesajlari (game_info, clock, flag)"
```

---

## Task 5: `clockFormat.ts`

**Files:**
- Create: `apps/web/lib/play/clockFormat.ts`
- Test: `apps/web/tests/clock-format.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/clock-format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatClock, isLowTime } from '@/lib/play/clockFormat';

describe('formatClock', () => {
  it('dakika:saniye biçiminde gösterir', () => {
    expect(formatClock(300_000)).toBe('05:00');
    expect(formatClock(59_000)).toBe('00:59');
    expect(formatClock(0)).toBe('00:00');
  });

  it('son 10 saniyede ondalık gösterir', () => {
    expect(formatClock(9_400)).toBe('09.4');
    expect(formatClock(1_050)).toBe('01.0');
  });

  it('negatif değer ASLA eksi göstermez', () => {
    expect(formatClock(-5_000)).toBe('00:00');
  });

  it('bir saati aşan süreyi dakika olarak yazar', () => {
    expect(formatClock(3_600_000)).toBe('60:00');
  });
});

describe('isLowTime', () => {
  it('10 saniyenin altı düşük süredir', () => {
    expect(isLowTime(9_999)).toBe(true);
    expect(isLowTime(10_000)).toBe(false);
    expect(isLowTime(-1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/clock-format.test.ts
```

Beklenen: FAIL — `Failed to resolve import "@/lib/play/clockFormat"`.

- [ ] **Step 3: Write the implementation**

`apps/web/lib/play/clockFormat.ts`:

```ts
/** Son 10 saniyede saat kirmizi olur ve ondalik gosterir. */
const LOW_MS = 10_000;

export function isLowTime(ms: number): boolean {
  return ms < LOW_MS;
}

/** ms -> "MM:SS", son 10 sn'de "SS.d". Negatif deger ASLA eksi gostermez. */
export function formatClock(ms: number): string {
  const safe = ms > 0 ? ms : 0;
  if (safe < LOW_MS) {
    const s = Math.floor(safe / 1000);
    const d = Math.floor((safe % 1000) / 100);
    return `${String(s).padStart(2, '0')}.${d}`;
  }
  const total = Math.floor(safe / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/clock-format.test.ts
```

Beklenen: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/clockFormat.ts apps/web/tests/clock-format.test.ts
git commit -m "feat: saat bicimlendirme (saf)"
```

---

## Task 6: `PlayerClock` bileşeni

**Files:**
- Create: `apps/web/components/play/PlayerClock.tsx`
- Test: `apps/web/tests/player-clock.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/player-clock.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerClock } from '@/components/play/PlayerClock';

describe('PlayerClock', () => {
  it('ad ve saati gösterir', () => {
    render(<PlayerClock name="Ayşe" ms={300_000} active={false} />);
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('sırası gelen vurgulanır', () => {
    render(<PlayerClock name="Ayşe" ms={300_000} active />);
    expect(screen.getByLabelText('Ayşe saati')).toHaveAttribute('data-active', 'true');
  });

  it('saat YOKSA sadece ad çizilir (tempsuz eski maç)', () => {
    render(<PlayerClock name="Ayşe" ms={null} active={false} />);
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.queryByText(/:/)).not.toBeInTheDocument();
  });

  it('düşük sürede uyarı işareti taşır', () => {
    render(<PlayerClock name="Ayşe" ms={5_000} active />);
    expect(screen.getByLabelText('Ayşe saati')).toHaveAttribute('data-low', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/player-clock.test.tsx
```

Beklenen: FAIL — bileşen yok.

- [ ] **Step 3: Write the implementation**

`apps/web/components/play/PlayerClock.tsx`:

```tsx
'use client';
import { formatClock, isLowTime } from '@/lib/play/clockFormat';

interface Props {
  name: string;
  /** Kalan sure (ms). null => saatsiz mac: saat HIC cizilmez. */
  ms: number | null;
  /** Sirasi bu oyuncuda mi. */
  active: boolean;
}

/** Bir oyuncunun satiri: ad + saat. Saat yoksa yalnizca ad. */
export function PlayerClock({ name, ms, active }: Props) {
  const low = ms !== null && isLowTime(ms);
  return (
    <div
      aria-label={`${name} saati`}
      data-active={active ? 'true' : 'false'}
      data-low={low ? 'true' : 'false'}
      className="t-card-i flex items-center gap-3 px-4 py-2"
      style={{
        border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
      }}
    >
      <span className="text-sm">{active ? '🟢' : '⚪'}</span>
      <span className="font-semibold text-sm flex-1 min-w-0 truncate">{name}</span>
      {ms !== null && (
        <span
          className="font-mono font-bold tabular-nums"
          style={{ fontSize: '1.35rem', color: low ? '#f87171' : 'var(--t-text)' }}
        >
          {formatClock(ms)}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/player-clock.test.tsx
```

Beklenen: PASS — 4 test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/play/PlayerClock.tsx apps/web/tests/player-clock.test.tsx
git commit -m "feat: PlayerClock ad + saat satiri"
```

---

## Task 7: `LiveGame` entegrasyonu

**Files:**
- Modify: `apps/web/components/LiveGame.tsx`

Bu görev mevcut bir bileşene ekleme yapar. **Önce dosyayı oku** — aşağıdaki parçalar
mevcut yapıya yerleştirilecek, dosya baştan yazılmayacak.

- [ ] **Step 1: Durumları ekle**

Bileşenin diğer `useState` satırlarının yanına:

```tsx
  const [whiteName, setWhiteName] = useState('Sporcu');
  const [blackName, setBlackName] = useState('Sporcu');
  const [whiteMs, setWhiteMs] = useState<number | null>(null);
  const [blackMs, setBlackMs] = useState<number | null>(null);
  const [whiteToMove, setWhiteToMove] = useState(true);
  const flagSentRef = useRef(false);
```

`useRef` import'unu ekle: `import { useState, useEffect, useRef } from 'react';`
(mevcut import satırına `useRef` ve `useEffect` eksikse eklenir).

- [ ] **Step 2: Gelen mesajları işle**

WS mesaj işleyicisindeki `if/else if` zincirine iki dal ekle:

```tsx
    } else if (t === 'game_info') {
      setWhiteName(String(msg.white_name ?? 'Sporcu'));
      setBlackName(String(msg.black_name ?? 'Sporcu'));
      setWhiteMs(typeof msg.white_ms === 'number' ? msg.white_ms : null);
      setBlackMs(typeof msg.black_ms === 'number' ? msg.black_ms : null);
      setWhiteToMove(msg.white_to_move !== false);
    } else if (t === 'clock') {
      // Sunucudan gelen deger YEREL sayimin UZERINE yazilir — otorite sunucu.
      setWhiteMs(typeof msg.white_ms === 'number' ? msg.white_ms : null);
      setBlackMs(typeof msg.black_ms === 'number' ? msg.black_ms : null);
      setWhiteToMove(msg.white_to_move !== false);
      flagSentRef.current = false;   // yeni hamle: bayrak hakki tazelenir
```

Mesaj tipinin okunduğu `msg` nesnesinin tip tanımına şu alanlar eklenir:
`white_name?: string; black_name?: string; white_ms?: number; black_ms?: number;
increment_ms?: number; white_to_move?: boolean;`

- [ ] **Step 3: Yerel geri sayım**

Bileşene yeni bir `useEffect` ekle:

```tsx
  // YEREL geri sayim SADECE GORSELDIR. Gercek sure sunucuda; her hamlede
  // gelen 'clock' mesaji bu degerin uzerine yazar.
  useEffect(() => {
    if (whiteMs === null || blackMs === null) return;   // saatsiz mac
    const id = setInterval(() => {
      if (whiteToMove) setWhiteMs((v) => (v === null ? v : Math.max(0, v - 100)));
      else setBlackMs((v) => (v === null ? v : Math.max(0, v - 100)));
    }, 100);
    return () => clearInterval(id);
  }, [whiteToMove, whiteMs === null, blackMs === null]);
```

- [ ] **Step 4: Süre bitince bir kez `flag` gönder**

Yeni bir `useEffect`:

```tsx
  // 'flag' YALNIZCA sira RAKIPTEYKEN ve onun saati bitince gonderilir.
  // Kimse kendi yenilgisini bildirmez. Bir kez gonderilir.
  useEffect(() => {
    if (whiteMs === null || blackMs === null || flagSentRef.current) return;
    const iAmWhite = myColor === 'white';
    const opponentToMove = iAmWhite ? !whiteToMove : whiteToMove;
    const opponentMs = iAmWhite ? blackMs : whiteMs;
    if (opponentToMove && opponentMs <= 0) {
      flagSentRef.current = true;
      send({ type: 'flag' });
    }
  }, [whiteMs, blackMs, whiteToMove, myColor, send]);
```

`myColor` ve `send` bileşende zaten mevcut isimlerdir; farklıysa **mevcut isimler
kullanılır** (dosyayı okuyup uyarla, yeni değişken uydurma).

- [ ] **Step 5: Saatleri çiz**

Tahtanın **üstüne** rakip, **altına** kendisi gelecek şekilde:

```tsx
      <PlayerClock
        name={myColor === 'white' ? blackName : whiteName}
        ms={myColor === 'white' ? blackMs : whiteMs}
        active={myColor === 'white' ? !whiteToMove : whiteToMove}
      />
      {/* ... mevcut tahta ... */}
      <PlayerClock
        name={myColor === 'white' ? whiteName : blackName}
        ms={myColor === 'white' ? whiteMs : blackMs}
        active={myColor === 'white' ? whiteToMove : !whiteToMove}
      />
```

Import: `import { PlayerClock } from '@/components/play/PlayerClock';`

- [ ] **Step 6: Tip ve test kontrolü**

```bash
cd apps/web && npx tsc --noEmit && npx vitest run
```

Beklenen: tsc temiz; tüm testler PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/LiveGame.tsx
git commit -m "feat: mac ekraninda iki oyuncunun adi ve saati"
```

---

## Task 8: Tam test kapısı

- [ ] **Step 1: Backend**

```bash
cd apps/api && python -m pytest -q && python -m alembic heads
```

Beklenen: hepsi PASS; **tek** head (`GameClock`).

- [ ] **Step 2: Frontend**

```bash
cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run && npm run build
```

Beklenen: tsc 0 hata, lint 0 hata, testler PASS, `Compiled successfully`.

- [ ] **Step 3: Gerçek sayıları raporla**

Backend ve frontend test sayıları **gerçek çıktıdan** yazılır. Tahmin edilen sayı
tutmuyorsa nedeni araştırılır ve açıkça yazılır (KURAL #1).

---

## Task 9: Canlı doğrulama (KURAL #6)

- [ ] **Step 1: Sınırı ÖNCEDEN söyle**

Saatin gerçek akışı **iki sporcu oturumu** ister. Tek oturumla doğrulanamaz.
Kullanıcıya sor, onay gelmeden başlama.

- [ ] **Step 2: Doğrulanabilenler**

Prod API'ye bağlı dev sunucuda: maç ekranının açılması, isimlerin görünmesi,
saatsiz (eski) maçta saat kutusunun **çizilmemesi**.

- [ ] **Step 3: Temizlik**

```bash
rm -f apps/web/.env.local
```

`preview_stop` + `git status --short`.

- [ ] **Step 4: Dürüst rapor**

Doğrulanan / doğrulanamayan ayrı ayrı. Doğrulanamayan için "çalışıyor" DENMEZ.

---

## Task 10: Bitirme

- [ ] **Step 1: finishing-a-development-branch**

Testleri doğrula, seçenekleri sun, kullanıcının seçimini uygula.
**Migration içerdiği için** push öncesi kullanıcıya açıkça hatırlat: bu dağıtım
Railway'de `alembic upgrade head` çalıştıracak ve `games` tablosuna 5 sütun ekleyecek.

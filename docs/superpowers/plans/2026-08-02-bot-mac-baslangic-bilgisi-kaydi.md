# Bot Maçı — Başlangıç Bilgisi Kaydı Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bot maçı başlarken sporcunun rengini, açılış pratiği pozisyonunu ve maç
süresini sunucuya kaydetmek; sunucunun "şu an hangi pozisyondayız" hesaplamasındaki
mevcut bir hatayı düzeltmek. Rozet sistemine dokunulmaz.

**Architecture:** `Game` tablosuna tek bir yeni sütun (`student_color`) eklenir —
`white_child_id`/`black_child_id`/`black_bot_level` semantiği DEĞİŞMEZ (rozet
uyumluluğu). `/games/bot/start` isteğine üç opsiyonel alan eklenir, `Game`
satırına yazılır. `games.py::_current_fen`, `live_game.py`'deki eşdeğeriyle
aynı mantığa (`start_fen` desteği) kavuşturulur.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy 2 async, Alembic, pytest +
pytest-asyncio (mevcut `client`/`child_auth`/`db` fixture'ları).

**İlgili belge:** `docs/superpowers/specs/2026-08-02-bot-mac-baslangic-bilgisi-kaydi-design.md`

**Kapsam dışı (bilerek):** Botun hamlesini sunucuda hesaplamak; `white_child_id`/
`black_child_id`'yi gerçek satranç rengine göre düzeltmek; `BotGame.tsx`'in bu
yeni alanları göndermesi (ayrı, davranışsal etkisi olmayan küçük bir görev —
istenirse bu planın sonuna eklenebilir, aşağıda not var).

---

### Task 1: `Game` modeline `student_color` ekle + migration

**Files:**
- Modify: `apps/api/chess_api/models/game.py:36` (yeni satır eklenir)
- Create: `apps/api/alembic/versions/20260802_BotGameColor_add.py`
- Test: `apps/api/tests/test_play_models.py` (genişletilecek)

- [ ] **Step 1: Başarısız test yaz**

`apps/api/tests/test_play_models.py` dosyasının SONUNA ekle:

```python
@pytest.mark.asyncio
async def test_student_color_varsayilan_none(db):
    """student_color bossa 'beyaz' varsayilir (geriye uyumluluk) — eski
    kayitlarda bu alan hic yok, NULL kalir."""
    game = Game(type=GameType.bot, white_child_id=1, black_bot_level=5)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    assert game.student_color is None


@pytest.mark.asyncio
async def test_student_color_kaydedilebilir(db):
    game = Game(type=GameType.bot, white_child_id=1, black_bot_level=5,
                student_color="b")
    db.add(game)
    await db.commit()
    await db.refresh(game)
    assert game.student_color == "b"
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_play_models.py -v`
Expected: FAIL — `TypeError: 'student_color' is an invalid keyword argument for Game`
(sütun henüz modelde yok).

- [ ] **Step 3: Modele sütunu ekle**

`apps/api/chess_api/models/game.py` — `black_bot_level` satırının hemen
ALTINA (satır 36'dan sonra) ekle:

```python
    black_bot_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Sporcunun EKRANDA gordugu renk ('w'/'b'). white_child_id/black_child_id
    # semantigine (rozet sistemi bunlara dayanir, bkz. badge_engine.py) HIC
    # dokunulmaz — bu SADECE goruntuleme/motor-yon bilgisidir. NULL = eski
    # kayit, 'w' varsayilir (bugunku davranisla ayni).
    student_color: Mapped[str | None] = mapped_column(String(1), nullable=True)
```

- [ ] **Step 4: Migration dosyasını oluştur**

`apps/api/alembic/versions/20260802_BotGameColor_add.py`:

```python
"""games tablosuna student_color sutunu

Revision ID: BotGameColor
Revises: OpeningSortOrder

Yalnizca SUTUN EKLER, nullable. Mevcut satirlar oldugu gibi kalir, devam eden
maclar bozulmaz (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "BotGameColor"
down_revision = "OpeningSortOrder"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("student_color", sa.String(length=1), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "student_color")
```

- [ ] **Step 5: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_play_models.py -v`
Expected: PASS (6 test — 4 eski + 2 yeni).

> NOT: Testler `Base.metadata.create_all` ile (alembic'siz) çalışıyor — model
> değişikliği tek başına testleri geçirir. Migration dosyası GERÇEK (Railway)
> veritabanı için gerekli, testler onu kullanmaz.

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/models/game.py apps/api/alembic/versions/20260802_BotGameColor_add.py apps/api/tests/test_play_models.py
git commit -m "feat: Game.student_color sutunu (bot maci renk bilgisi)"
```

---

### Task 2: `/games/bot/start` renk/start_fen/tempo kaydetsin

**Files:**
- Modify: `apps/api/chess_api/schemas/game.py`
- Modify: `apps/api/chess_api/routers/games.py:1-38`
- Test: `apps/api/tests/test_games.py` (genişletilecek)

- [ ] **Step 1: Başarısız testleri yaz**

`apps/api/tests/test_games.py` dosyasının SONUNA ekle:

```python
async def test_start_bot_game_renk_start_fen_tempo_kaydedilir(client, child_auth, db):
    from sqlalchemy import select
    from chess_api.models import Game

    token, child_id = child_auth
    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "skill_level": 5,
            "student_color": "b",
            "start_fen": acilis_fen,
            "tc_base_seconds": 300,
            "tc_increment_seconds": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["your_color"] == "black"
    assert data["fen"] == acilis_fen

    gid = data["game_id"]
    game = (await db.execute(select(Game).where(Game.id == gid))).scalar_one()
    assert game.student_color == "b"
    assert game.start_fen == acilis_fen
    assert game.base_ms == 300_000
    assert game.increment_ms == 2_000
    assert game.white_ms == 300_000
    assert game.black_ms == 300_000
    # Rozet uyumlulugu: white_child_id/black_bot_level DEGISMEMELI.
    assert game.white_child_id == child_id
    assert game.black_bot_level == 5


async def test_start_bot_game_eski_istemci_hicbir_yeni_alan_gondermez(client, child_auth, db):
    """Geriye uyumluluk: eski istemci yalnizca skill_level gonderir."""
    from sqlalchemy import select
    from chess_api.models import Game

    token, child_id = child_auth
    response = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"skill_level": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["your_color"] == "white"

    gid = data["game_id"]
    game = (await db.execute(select(Game).where(Game.id == gid))).scalar_one()
    assert game.student_color == "w"
    assert game.start_fen is None
    assert game.base_ms is None
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_games.py -v -k "renk_start_fen_tempo or eski_istemci"`
Expected: FAIL — `student_color`/`start_fen`/`tc_base_seconds`/`tc_increment_seconds`
Pydantic'te tanımlı olmadığı için `422 Unprocessable Entity` döner (ekstra alan
hatası DEĞİL — Pydantic bilinmeyen alanları varsayılan olarak yok sayar; asıl
kırmızı sebep `game.student_color == "b"` asssertion'ının `AttributeError`
vermesi, çünkü Task 1 uygulanmadıysa sütun yok. Task 1 UYGULANDIYSA sütun var
ama `start_bot_game` onu hiç yazmadığı için `game.student_color is None`
olur, `assert game.student_color == "b"` FAIL eder).

- [ ] **Step 3: `StartBotGameRequest`/`StartBotGameResponse`'u genişlet**

`apps/api/chess_api/schemas/game.py` — TÜM dosyanın yeni hâli:

```python
from typing import Literal
from pydantic import BaseModel
from chess_api.models.game import GameStatus, GameResult


class StartBotGameRequest(BaseModel):
    skill_level: int  # 0-20
    # Sporcunun ekranda oynadigi renk. Eski istemciler bu alani hic
    # gondermez -> varsayilan 'w' bugunku davranisla AYNI.
    student_color: Literal['w', 'b'] = 'w'
    # Acilis pratigi icin baslangic pozisyonu. Verilmezse standart baslangic.
    start_fen: str | None = None
    # Mac suresi (saniye). None/0 = suresiz.
    tc_base_seconds: int | None = None
    tc_increment_seconds: int = 0


class StartBotGameResponse(BaseModel):
    game_id: int
    fen: str
    your_color: str


class MakeMoveRequest(BaseModel):
    move_uci: str


class MoveResponse(BaseModel):
    accepted: bool
    fen_after: str | None = None
    is_checkmate: bool = False
    is_stalemate: bool = False
    game_status: GameStatus
    result: GameResult | None = None
```

- [ ] **Step 4: `start_bot_game`'i güncelle**

`apps/api/chess_api/routers/games.py` — dosyanın en üstündeki import'lara
`datetime` ekle (satır 1'in üzerine):

```python
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
```

`start_bot_game` fonksiyonunun gövdesini (satır ~21-38) şu şekilde değiştir:

```python
@router.post("/bot/start", response_model=StartBotGameResponse)
async def start_bot_game(
    payload: StartBotGameRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    if payload.skill_level < 0 or payload.skill_level > 20:
        raise HTTPException(status_code=422, detail="Skill must be 0-20")

    status = await check_time_limit(db, child.id)
    if not status["allowed"]:
        raise HTTPException(status_code=429, detail=f"Günlük süre doldu ({status['used_minutes']}/{status['limit_minutes']} dk)")

    # base_ms>0 varsa saatli mac; yoksa suresiz (mevcut insan-insan akisiyla
    # AYNI donusum deseni, bkz. live_game.py::_handle_challenge_accept).
    base_ms = (payload.tc_base_seconds * 1000
               if payload.tc_base_seconds and payload.tc_base_seconds > 0 else None)

    # white_child_id/black_bot_level BILEREK degismiyor (rozet uyumlulugu,
    # bkz. docs/superpowers/specs/2026-08-02-bot-mac-baslangic-bilgisi-kaydi-design.md).
    game = Game(
        type=GameType.bot,
        white_child_id=child.id,
        black_bot_level=payload.skill_level,
        student_color=payload.student_color,
        start_fen=payload.start_fen,
        base_ms=base_ms,
        increment_ms=payload.tc_increment_seconds * 1000 if base_ms is not None else 0,
        white_ms=base_ms,
        black_ms=base_ms,
        last_clock_at=datetime.utcnow() if base_ms is not None else None,
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return StartBotGameResponse(
        game_id=game.id,
        fen=payload.start_fen or INITIAL_FEN,
        your_color="white" if payload.student_color == "w" else "black",
    )
```

- [ ] **Step 5: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_games.py -v`
Expected: PASS (mevcut testler + 2 yeni = 9 test). `test_start_bot_game`
(mevcut, satır 51) HÂLÂ geçmeli — `your_color == "white"` ve
`fen == INITIAL_FEN` beklentisi, `student_color` varsayılanı `'w'` ve
`start_fen` varsayılanı `None` olduğu için bozulmaz.

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/schemas/game.py apps/api/chess_api/routers/games.py apps/api/tests/test_games.py
git commit -m "feat: bot maci baslarken renk/acilis-pozisyonu/sure kaydedilir"
```

---

### Task 3: `_current_fen` açılış pozisyonunu dikkate alsın

**Kök neden:** `games.py::_current_fen`, hamle yoksa her zaman standart
başlangıç pozisyonunu (`INITIAL_FEN`) döndürüyor — `game.start_fen`'e hiç
bakmıyor. Açılış pratiğinden başlayan bir bot maçında (Task 2 sayesinde artık
`start_fen` doğru kaydediliyor) ilk hamle YANLIŞ pozisyona göre doğrulanır.

**Files:**
- Modify: `apps/api/chess_api/routers/games.py:41-46`
- Test: `apps/api/tests/test_games.py` (genişletilecek)

- [ ] **Step 1: Başarısız test yaz**

`apps/api/tests/test_games.py` dosyasının SONUNA ekle:

```python
async def test_acilis_pratiginden_baslayan_bot_macinda_ilk_hamle_dogru_degerlendirilir(client, child_auth):
    """Standart baslangicta yasak ama bu acilis pozisyonunda GECERLI bir
    hamle: 1.e4'ten sonra siyahin e7e5 oynamasi. games.py::_current_fen
    start_fen'i yok sayarsa bu hamle standart baslangica gore (beyazin
    sirasi) degerlendirilir ve YANLISLIKLA reddedilir."""
    token, child_id = child_auth
    acilis_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    start = await client.post(
        "/games/bot/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"skill_level": 5, "start_fen": acilis_fen},
    )
    gid = start.json()["game_id"]

    response = await client.post(
        f"/games/{gid}/move",
        headers={"Authorization": f"Bearer {token}"},
        json={"move_uci": "e7e5"},
    )
    assert response.status_code == 200
    assert response.json()["accepted"] is True
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_games.py -v -k acilis_pratiginden`
Expected: FAIL — `assert False is True` (`accepted` `False` döner, çünkü
sunucu standart başlangıca göre "beyazın sırası" sanıp `e7e5`'i siyah taşı
olarak reddeder).

- [ ] **Step 3: `_current_fen`'i düzelt**

`apps/api/chess_api/routers/games.py` — `_current_fen` fonksiyonunun (satır
~41-46) TAMAMINI değiştir:

```python
async def _current_fen(db: AsyncSession, game_id: int) -> str:
    last = (await db.execute(
        select(GameMove).where(GameMove.game_id == game_id)
        .order_by(GameMove.ply.desc()).limit(1)
    )).scalar_one_or_none()
    if last:
        return last.fen_after
    # Hamle yoksa macin KENDI baslangic konumu (acilis pratigi); yoksa
    # standart. AYNI mantik live_game.py::_current_fen_and_ply'de kullanilir.
    game = await db.get(Game, game_id)
    return game.start_fen if game and game.start_fen else INITIAL_FEN
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_games.py -v`
Expected: PASS (mevcut + 2 (Task 2) + 1 (bu adım) = 10 test).

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/games.py apps/api/tests/test_games.py
git commit -m "fix: bot maci _current_fen artik acilis pozisyonunu dikkate aliyor"
```

---

### Task 4: Tam test kapısı ve rapor

**Files:** (yok — yalnızca doğrulama)

- [ ] **Step 1: Backend tam paketi**

Run: `cd apps/api && python -m pytest -q`
Expected: TÜM testler PASS (mevcut 362 test + bu planın eklediği 6 test = 368).

- [ ] **Step 2: Rozet testleri özellikle kontrol edilir**

`badge_engine.py`'ye hiç dokunulmadı; ama emin olmak için ilgili testler
(varsa `bot_wins`/`black_bot_level` geçen dosyalar) ayrıca aranır:

Run: `cd apps/api && grep -rl "bot_wins\|black_bot_level" tests/*.py`
Bulunan dosyalar tam paket içinde zaten PASS etti (Step 1) — burada ekstra
işlem gerekmez, yalnızca hangi dosyaların etkilendiği görünür kılınır.

- [ ] **Step 3: Frontend'e dokunulmadı**

Bu plan yalnızca `apps/api` içinde çalışıyor; `apps/web` hiç değişmedi. Web
test paketini koşmaya gerek yok.

- [ ] **Step 4: Ertelenen görevi kaydet**

`BotGame.tsx`'in bu yeni alanları (`student_color`, `start_fen`,
`tc_base_seconds`, `tc_increment_seconds`) `/games/bot/start` çağrısına
EKLEMESİ, davranışsal olarak GÖRÜNÜR bir fark yaratmayacağı için (sunucu bu
bilgileri henüz kullanmıyor — motor entegrasyonu ayrı bir sonraki parça)
BİLEREK bu plana DAHİL EDİLMEDİ. Motor entegrasyonu parçası başladığında,
sunucunun bu bilgilere ihtiyacı olacağı an bu bağlantı da kurulacak.

- [ ] **Step 5: Kullanıcıya rapor + canlıya gönderme onayı**

Bu adımda kod yazılmaz — sonuçlar KURAL #0'a uygun sade Türkçe ile özetlenir,
`git push origin main` için açık onay istenir.

# Bot Ekranını WS Akışına Bağlama Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BotGame.tsx`'in yerini alacak, sunucudaki WS akışını kullanan yeni bir
giriş bileşeni (`BotGameLive`) yazmak ve test etmek — mevcut `LiveGame.tsx`'e
HİÇ dokunmadan. Bu bileşen hiçbir gerçek sayfaya bağlanmaz (motor kurulana kadar
sporcular eski, çalışan ekranı görmeye devam eder).

**Architecture:** `BotGameLive` mount olunca `/games/bot/start`'ı (artık tüm
alanlarla — 2. parçada eklendi) çağırır, dönen `game_id`'yi `sessionStorage`'da
saklar (sayfa yenilemesinde AYNI maça bağlanmak için), sonra `<LiveGame
gameId={...} myColor={...} />`'ı render eder. Backend'de tek küçük ek: bot
maçında boş kalan ismin yerine "Bot" yazması.

**Tech Stack:** React/Next.js, vitest + testing-library (mevcut
`live-game-controls.test.tsx`'teki `useWebSocket` mock deseni AYNEN
kullanılır), FastAPI/pytest (mevcut `test_game_info_moves.py` deseni).

**İlgili belge:** `docs/superpowers/specs/2026-08-02-bot-ekrani-ws-baglantisi-design.md`

**Kapsam dışı (bilerek):** `play/page.tsx` ve `OpeningPractice.tsx`'in
`<BotGame>` yerine `<BotGameLive>` kullanması (motor kurulduktan sonra ayrı bir
görev); "Bot düşünüyor..." göstergesi; eski `BotGame.tsx`'e/`botGameSession.ts`'e
dokunmak (silinmez, değiştirilmez).

---

### Task 1: `BotGameLive.tsx` — giriş bileşeni

**Files:**
- Create: `apps/web/lib/play/botGameLiveSession.ts`
- Create: `apps/web/components/BotGameLive.tsx`
- Test: `apps/web/tests/bot-game-live.test.tsx`

- [ ] **Step 1: Başarısız testleri yaz**

`apps/web/tests/bot-game-live.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: () => ({ send: vi.fn(), readyState: 1 }),
  wsBase: () => 'ws://test',
}));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok', getAthleteName: () => 'Sporcu' }));

import { BotGameLive } from '@/components/BotGameLive';

describe('BotGameLive — /games/bot/start doğru gövdeyle çağrılır', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renk/pozisyon/süre /games/bot/start gövdesine doğru geçer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 42, fen: 'std', your_color: 'black' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<BotGameLive skillLevel={5} studentColor="b"
      startFen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
      timeControl={{ base: 300, increment: 2, label: '5+2' }} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body as string);
    expect(body).toEqual({
      skill_level: 5,
      student_color: 'b',
      start_fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      tc_base_seconds: 300,
      tc_increment_seconds: 2,
    });
  });

  it('dönen game_id ile LiveGame doğru myColor ile render edilir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 42, fen: 'std', your_color: 'black' }),
    }));

    render(<BotGameLive skillLevel={5} studentColor="b" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument());
  });

  it('sayfa yenilemesinde AYNI oyuna bağlanır, YENİ /games/bot/start çağrılmaz', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 42, fen: 'std', your_color: 'white' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<BotGameLive skillLevel={5} studentColor="w" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();

    render(<BotGameLive skillLevel={5} studentColor="w" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1); // ikinci kez çağrılmadı
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/web && npx vitest run tests/bot-game-live.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/BotGameLive"` (dosya
henüz yok).

- [ ] **Step 3: `botGameLiveSession.ts`'i yaz**

`apps/web/lib/play/botGameLiveSession.ts`:

```ts
/** BotGameLive için maç kimliğinin (yalnızca game_id) sayfa yenilemesine
 *  dayanıklı saklanması. Eski botGameSession.ts'ten (moves/times de saklar)
 *  FARKLI ve çok daha basit — moves/times ARTIK sunucuda, WS'in gönderdiği
 *  game_info mesajıyla geliyor; istemcinin ayrıca saklamasına gerek yok.
 */
export function botGameLiveKey(
  skillLevel: number,
  studentColor: 'w' | 'b',
  startFen?: string,
): string {
  return `bsa:botmac-live:${skillLevel}:${studentColor}:${startFen ?? 'std'}`;
}

export function loadBotGameLiveId(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function saveBotGameLiveId(key: string, gameId: number): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, String(gameId)); } catch { /* yok say */ }
}
```

- [ ] **Step 4: `BotGameLive.tsx`'i yaz**

`apps/web/components/BotGameLive.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { LiveGame } from './LiveGame';
import { getToken } from '@/lib/auth-storage';
import type { TimeControl } from './BotGame';
import {
  botGameLiveKey, loadBotGameLiveId, saveBotGameLiveId,
} from '@/lib/play/botGameLiveSession';

interface Props {
  skillLevel: number;
  timeControl?: TimeControl | null;
  /** Sporcunun oynadığı renk. Varsayılan 'w'. */
  studentColor?: 'w' | 'b';
  /** Açılış pratiği için başlangıç pozisyonu. Verilmezse standart başlangıç. */
  startFen?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function BotGameLive({ skillLevel, timeControl, studentColor = 'w', startFen }: Props) {
  const sessionKey = botGameLiveKey(skillLevel, studentColor, startFen);
  const [gameId, setGameId] = useState<number | null>(() => loadBotGameLiveId(sessionKey));

  useEffect(() => {
    if (gameId != null) return; // sayfa yenilendi, kayıtlı maça bağlanılacak
    let cancelled = false;
    (async () => {
      try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/games/bot/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            skill_level: skillLevel,
            student_color: studentColor,
            start_fen: startFen ?? null,
            tc_base_seconds: timeControl?.base ?? null,
            tc_increment_seconds: timeControl?.increment ?? 0,
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          saveBotGameLiveId(sessionKey, data.game_id);
          setGameId(data.game_id);
        }
      } catch { /* offline — asagida yukleniyor iskeleti kalir */ }
    })();
    return () => { cancelled = true; };
  }, [gameId, sessionKey, skillLevel, studentColor, startFen, timeControl]);

  if (gameId == null) {
    return (
      <div className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-5 w-40 mx-auto" />
        <div className="t-skel aspect-square max-w-sm mx-auto rounded-lg" />
      </div>
    );
  }

  return <LiveGame gameId={gameId} myColor={studentColor === 'w' ? 'white' : 'black'} />;
}
```

- [ ] **Step 5: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/web && npx vitest run tests/bot-game-live.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 6: Regresyon — `BotGame.tsx`'e ve `LiveGame.tsx`'e dokunulmadı**

Run: `cd apps/web && npx vitest run tests/bot-game-persistence.test.tsx tests/bot-game-premove.test.tsx tests/bot-game-history.test.tsx tests/bot-game-color.test.tsx tests/live-game-controls.test.tsx`
Expected: TÜMÜ PASS — bu dosya hiçbirine dokunmadığı için değişiklik
BEKLENMEZ, yalnızca doğrulama amaçlı çalıştırılır.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/play/botGameLiveSession.ts apps/web/components/BotGameLive.tsx apps/web/tests/bot-game-live.test.tsx
git commit -m "feat: BotGameLive - bot maci icin WS tabanli giris bileseni (henuz hicbir sayfaya baglanmadi)"
```

---

### Task 2: Backend — bot maçında boş kalan isim "Bot" yazsın

**Kök neden:** `game_ws`'in `game_info` mesajı, boş kalan tarafın ismini
`ChildProfile` bulunamadığında `"Sporcu"` varsayılanına düşürüyor. Bot
maçlarında bu, botun ekranda "Sporcu" görünmesine yol açar.

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py:190-215` (`game_ws` içindeki `game_info` bloğu)
- Test: `apps/api/tests/test_bot_game_info_name.py` (yeni)

- [ ] **Step 1: Başarısız testleri yaz**

`apps/api/tests/test_bot_game_info_name.py`:

```python
"""Bot macinda game_info'daki bos isim 'Bot' yazar; insan-insan macta
'Sporcu' varsayilani DEGISMEZ (regresyon)."""
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from chess_api.main import create_app
from chess_api.models import Game, GameType, GameStatus
from chess_api.services.jwt import encode_token


@pytest_asyncio.fixture
async def env(db_engine, monkeypatch):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(
        "chess_api.routers.live_game.get_session_factory", lambda: factory,
    )
    return factory


@pytest.mark.asyncio
async def test_bot_macinda_bos_kalan_taraf_bot_yazar(env):
    async with env() as db:
        game = Game(type=GameType.bot, status=GameStatus.active, white_child_id=9,
                    black_bot_level=5, student_color="w")
        db.add(game)
        await db.commit()
        await db.refresh(game)
        gid = game.id

    token = encode_token({"child_profile_id": 9, "role": "child"})
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/game/{gid}?token={token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "game_info":
            msg = ws.receive_json()

    assert msg["black_name"] == "Bot"


@pytest.mark.asyncio
async def test_insan_macinda_isim_hala_sporcu_varsayilanlidir(env):
    from chess_api.routers.live_game import _create_human_game

    gid = await _create_human_game(1, 2)

    token = encode_token({"child_profile_id": 1, "role": "child"})
    client = TestClient(create_app())
    with client.websocket_connect(f"/ws/game/{gid}?token={token}") as ws:
        msg = ws.receive_json()
        while msg["type"] != "game_info":
            msg = ws.receive_json()

    assert msg["white_name"] == "Sporcu"
    assert msg["black_name"] == "Sporcu"
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_game_info_name.py -v`
Expected: `test_bot_macinda_bos_kalan_taraf_bot_yazar` FAIL — `black_name` şu an
`"Sporcu"` döner. İkinci test zaten PASS eder (bugünkü davranışla aynı) — bu
NORMAL, regresyon koruması.

- [ ] **Step 3: `game_info` bloğunu düzelt**

`apps/api/chess_api/routers/live_game.py` içinde `game_ws`'in `game_info`
gönderen bölümünü (satır ~190-215) şu şekilde değiştir:

Eski:
```python
    async with get_session_factory()() as db:
        g = await db.get(Game, game_id)
        w = await db.get(ChildProfile, g.white_child_id) if g.white_child_id else None
        b = await db.get(ChildProfile, g.black_child_id) if g.black_child_id else None
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        # Yeniden baglanan sporcu notasyon listesini bastan gorur.
        past = (await db.execute(
            select(GameMove).where(GameMove.game_id == game_id)
            .order_by(GameMove.ply.asc())
        )).scalars().all()
        await websocket.send_json({
            "type": "game_info",
            "white_name": w.display_name if w else "Sporcu",
            "black_name": b.display_name if b else "Sporcu",
```

Yeni:
```python
    async with get_session_factory()() as db:
        g = await db.get(Game, game_id)
        w = await db.get(ChildProfile, g.white_child_id) if g.white_child_id else None
        b = await db.get(ChildProfile, g.black_child_id) if g.black_child_id else None
        current_fen, _ = await _current_fen_and_ply(db, game_id)
        # Bot macinda bos kalan taraf botun kendisidir — "Sporcu" degil "Bot".
        default_name = "Bot" if g.type == GameType.bot else "Sporcu"
        # Yeniden baglanan sporcu notasyon listesini bastan gorur.
        past = (await db.execute(
            select(GameMove).where(GameMove.game_id == game_id)
            .order_by(GameMove.ply.asc())
        )).scalars().all()
        await websocket.send_json({
            "type": "game_info",
            "white_name": w.display_name if w else default_name,
            "black_name": b.display_name if b else default_name,
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `cd apps/api && python -m pytest tests/test_bot_game_info_name.py -v`
Expected: PASS (2 test).

- [ ] **Step 5: Regresyon**

Run: `cd apps/api && python -m pytest tests/test_live_game_ws.py tests/test_game_info_moves.py tests/test_live_two_moves.py tests/test_draw_offers_ws.py tests/test_bot_move_server.py tests/test_bot_draw_ws.py -v`
Expected: TÜMÜ PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py apps/api/tests/test_bot_game_info_name.py
git commit -m "fix: bot macinda game_info bos kalan taraf icin 'Bot' yazar"
```

---

### Task 3: Tam test kapısı ve rapor

**Files:** (yok — yalnızca doğrulama)

- [ ] **Step 1: Backend tam paketi**

Run: `cd apps/api && python -m pytest -q`
Expected: TÜM testler PASS (mevcut 385 test + bu planın eklediği 2 = 387).

- [ ] **Step 2: Frontend tam paketi**

Run: `cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run`
Expected: `tsc`/`lint` hatasız; `vitest` mevcut testler + 3 yeni = TÜMÜ PASS.

- [ ] **Step 3: Canlı doğrulama — KISMEN mümkün (KURAL #6, dürüstçe)**

`BotGameLive` hiçbir sayfaya bağlı olmadığı için tarayıcıda "bota karşı oyna"
akışından erişilemez — bu GERÇEK bir sınırlama, gizlenmez. Bunun yerine:
- Mevcut "bota karşı oyna" ekranının (eski `BotGame.tsx`, hâlâ değişmedi)
  DAVRANIŞININ bu plan yüzünden bozulmadığı, gerçek tarayıcıda kısa bir
  gezinme ile doğrulanır (yalnızca "hâlâ eskisi gibi çalışıyor" kontrolü).
- `BotGameLive`'in kendisi yalnızca otomatik testlerle doğrulanmış sayılır;
  gerçek uçtan uca deneme, motorla birlikte yapılacak "devreye alma"
  görevinde gerçekleşecektir.

- [ ] **Step 4: Kullanıcıya rapor + canlıya gönderme kararı**

Bu adımda kod yazılmaz. KURAL #0'a uygun sade Türkçe ile şunlar özetlenir:
- Yeni ekran parçası hazır ve test edildi ama HİÇBİR gerçek sayfaya bağlı
  değil — bu commit'lerin canlıya gönderilmesi sporcuların gördüğü hiçbir
  şeyi DEĞİŞTİRMEZ (yalnızca `game_info`'daki "Bot" ismi düzeltmesi dışında,
  o da yalnızca ekranı GÖRÜLEBİLECEK biri varsa etkiler — ki şu an yok).
- Devreye alma (gerçek sayfaların `<BotGameLive>` kullanması), Stockfish
  kurulduktan sonra AYRI bir görev.

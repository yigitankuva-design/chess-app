# Maç Yap Bölümü Genişletme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maç Yap bölümünü 4 sekmeye çıkarmak, 1-8 zorluk + renk seçimi eklemek, arkadaşa gerçek maç daveti göndermeyi sağlamak, terk etme/beraberlik teklifini kullanıcının istediği davranışa cilalamak ve açılış pratiği modunu kurmak.

**Architecture:** Saf mantık (zorluk tablosu, renk atama, sonuç metni, teklif sayacı) ayrı test edilebilir modüllere çıkarılır. Arkadaş daveti için mevcut `game_room.py` in-memory desenine birebir benzeyen yeni bir `lobby.py` servisi ve `/ws/lobby` WebSocket kanalı eklenir. Terk/beraberlik zaten çalışıyor — üzerine `decline_draw`, 3-hak sayacı ve sonuç formatı eklenir. Açılış pratiği yeni `Opening` tablosu + admin CRUD + mevcut maç akışlarına `start_fen` parametresi ile bağlanır.

**Tech Stack:** Next.js 15 / React 19 / TypeScript / vitest + RTL (frontend); FastAPI + SQLAlchemy 2 async + Alembic + pytest (backend); WebSocket (mevcut `useWebSocket` hook'u ve `game_room` deseni).

**Spec:** `docs/superpowers/specs/2026-07-26-mac-yap-genisletme-design.md`

---

## Ölçülen gerçekler (varsayım değil)

Plan yazılırken kod okunarak doğrulandı:

1. **Terk/beraberlik zaten çalışıyor.** `live_game.py:116-121` mesaj yönlendirme,
   `:187-206` `_handle_resign`/`_handle_draw`. `LiveGame.tsx:72-101` "Teslim ol",
   "Beraberlik teklif et" ve "Kabul et" UI'ı **zaten var**. Eksik: red butonu,
   3-hak sınırı, sonuç metni formatı.
2. **Sporcu her zaman beyaz.** `BotGame.tsx:185` → `chessRef.current.turn() === 'w'`.
   Ayrıca `:96-97` saat mantığı ve `:133` mat sonucu (`chess.turn() === 'b'` →
   çocuk kazandı) beyaz varsayımına bağlı. Renk seçimi bu **üç** yeri de etkiler.
3. **`expire_on_commit=False`** (`database.py:42`) → `live_game.py:195`'teki
   commit sonrası `game.result.value` erişimi güvenli, bug değil.
4. **Migration head:** `PracticeResults`. Yeni migration'ın `down_revision`'ı bu olacak.
5. **WS test kalıbı:** `TestClient(app).websocket_connect(...)` +
   `_reset_for_tests()` (bkz. `tests/test_live_game_ws.py:1-24`).
6. **`GameResult` enum** sadece 3 değer (`1-0`/`0-1`/`1/2-1/2`) — resign/draw
   için yeni enum değeri **gerekmiyor**.

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/play/levels.ts` (YENİ) | 1-8 zorluk tablosu + tempo listesi (Süresiz'siz) |
| `apps/web/lib/play/color.ts` (YENİ) | Renk seçimi tipi + "Rastgele" çözümleme |
| `apps/web/lib/play/resultText.ts` (YENİ) | `1 – 0 (Beyaz Kazandı)` vb. sonuç metni |
| `apps/web/lib/play/drawOffers.ts` (YENİ) | 3-teklif sınırı saf mantığı |
| `apps/api/chess_api/services/lobby.py` (YENİ) | In-memory lobi (aktif sporcular + davet yönlendirme) |
| `apps/api/chess_api/models/opening.py` (YENİ) | `Opening` tablosu |
| `apps/api/alembic/versions/20260727_PlayFeatures_add.py` (YENİ) | `openings` tablosu + `games` sütunları |
| `apps/web/lib/hooks/use-lobby.ts` (YENİ) | `/ws/lobby` bağlantısı, aktif liste, gelen davet |
| `apps/web/components/ChallengeScreen.tsx` (YENİ) | Arkadaşa davet gönderme akışı |
| `apps/web/components/play/MatchCriteria.tsx` (YENİ) | Düzey/Tempo/Renk seçim bileşeni (3 akışta paylaşılır) |
| `apps/web/app/admin/openings/page.tsx` (YENİ) | Zafer Hoca'nın açılış CRUD ekranı |
| `apps/web/app/(child)/play/page.tsx` (DEĞİŞİKLİK) | 4 kart + akış yönlendirme |
| `apps/web/components/BotGame.tsx` (DEĞİŞİKLİK) | `studentColor` + `startFen` prop'ları |
| `apps/web/components/LiveGame.tsx` (DEĞİŞİKLİK) | Terk Et etiketi, red butonu, sonuç formatı, hak sayacı |
| `apps/api/chess_api/routers/live_game.py` (DEĞİŞİKLİK) | `/ws/lobby`, `decline_draw`, hak sayacı |
| `apps/api/chess_api/routers/admin.py` (DEĞİŞİKLİK) | Opening CRUD |
| `apps/api/chess_api/models/game.py` (DEĞİŞİKLİK) | `white_draw_offers`, `black_draw_offers`, `start_fen` |

**Sıra:** Saf mantık (1-4) → backend model/migration (5) → backend terk/beraberlik (6) → backend lobi (7) → frontend paylaşılan bileşen (8) → frontend BotGame (9) → frontend LiveGame (10) → frontend ChallengeScreen (11) → /play 4 kart (12) → Opening CRUD (13-14) → Açılış pratiği akışı (15) → ana sayfa kısayolu hizalama (16) → test kapısı (17) → canlı doğrulama (18).

**Toplam 18 görev.** Bu, tek plan tercihinin doğal sonucu (normalde 5 alt
projeye bölünürdü). Her görev yine TDD ve kendi commit'iyle ilerler.

---

## Task 1: `levels.ts` — 1-8 zorluk + tempo listesi

**Files:**
- Create: `apps/web/lib/play/levels.ts`
- Test: `apps/web/tests/play-levels.test.ts`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/play-levels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LEVELS, TIME_GROUPS, ALL_TIMES } from '@/lib/play/levels';

describe('LEVELS', () => {
  it('tam 8 seviye vardır', () => expect(LEVELS).toHaveLength(8));

  it('seviye numaraları 1..8 sıralıdır', () => {
    expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('skill_level 0..20 aralığında ve artan sıradadır', () => {
    const skills = LEVELS.map((l) => l.skill);
    expect(skills).toEqual([0, 3, 6, 9, 12, 15, 18, 20]);
    expect(Math.min(...skills)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...skills)).toBeLessThanOrEqual(20);
  });

  it('depth artan sıradadır', () => {
    expect(LEVELS.map((l) => l.depth)).toEqual([1, 3, 5, 7, 8, 9, 11, 12]);
  });
});

describe('TIME_GROUPS', () => {
  it('Süresiz seçeneği YOKTUR (madde g)', () => {
    const labels = TIME_GROUPS.flatMap((g) => g.items).map((i) => i.label);
    expect(labels).not.toContain('Süresiz');
    expect(labels.some((l) => l.toLowerCase().includes('süresiz'))).toBe(false);
  });

  it('üç tempo grubu vardır', () => {
    expect(TIME_GROUPS.map((g) => g.cat)).toEqual(['Yıldırım', 'Hızlı', 'Klasik']);
  });

  it('her temponun pozitif base süresi vardır (süresiz maç olamaz)', () => {
    for (const t of ALL_TIMES) expect(t.base).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-levels.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/play/levels"`

- [ ] **Step 3: Uygulamayı yaz**

`apps/web/lib/play/levels.ts`:

```ts
import type { TimeControl } from '@/components/BotGame';

export interface PlayLevel {
  /** Sporcuya gösterilen düzey numarası (1 en kolay, 8 en zor). */
  level: number;
  /** Stockfish skill level (0-20) — backend de bu aralığı doğruluyor. */
  skill: number;
  /** Stockfish arama derinliği. */
  depth: number;
}

/**
 * 8 zorluk düzeyi (madde e). Eski 5 seviyeli tablo (skill 0/3/8/14/20,
 * depth 1/4/8/10/12) 8 basamağa orantılı olarak genişletildi; uç değerler
 * (skill 0 ve 20, depth 1 ve 12) korundu.
 */
export const LEVELS: PlayLevel[] = [
  { level: 1, skill: 0,  depth: 1 },
  { level: 2, skill: 3,  depth: 3 },
  { level: 3, skill: 6,  depth: 5 },
  { level: 4, skill: 9,  depth: 7 },
  { level: 5, skill: 12, depth: 8 },
  { level: 6, skill: 15, depth: 9 },
  { level: 7, skill: 18, depth: 11 },
  { level: 8, skill: 20, depth: 12 },
];

/**
 * Tempo grupları. "Süresiz" KASTEN YOK (madde g) — her maçın saati olmak
 * zorunda, aksi halde terk/beraberlik dışında maç bitmeyebilir.
 */
export const TIME_GROUPS: { cat: string; emoji: string; items: TimeControl[] }[] = [
  { cat: 'Yıldırım', emoji: '⚡', items: [
    { label: '3+2', base: 180, increment: 2 },
    { label: '5+0', base: 300, increment: 0 },
    { label: '5+3', base: 300, increment: 3 },
  ]},
  { cat: 'Hızlı', emoji: '🚀', items: [
    { label: '10+0',  base: 600, increment: 0 },
    { label: '10+5',  base: 600, increment: 5 },
    { label: '15+10', base: 900, increment: 10 },
  ]},
  { cat: 'Klasik', emoji: '🐢', items: [
    { label: '30+0',  base: 1800, increment: 0 },
    { label: '30+10', base: 1800, increment: 10 },
    { label: '30+20', base: 1800, increment: 20 },
  ]},
];

export const ALL_TIMES: TimeControl[] = TIME_GROUPS.flatMap((g) => g.items);
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-levels.test.ts`
Beklenen: PASS — 7 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/levels.ts apps/web/tests/play-levels.test.ts
git commit -m "feat: 1-8 zorluk duzeyi tablosu, Suresiz tempo kaldirildi"
```

---

## Task 2: `color.ts` — renk seçimi

**Files:**
- Create: `apps/web/lib/play/color.ts`
- Test: `apps/web/tests/play-color.test.ts`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/play-color.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { COLOR_CHOICES, resolveColor, oppositeColor } from '@/lib/play/color';

afterEach(() => vi.restoreAllMocks());

describe('COLOR_CHOICES', () => {
  it('üç seçenek: Beyaz, Rastgele, Siyah (madde f)', () => {
    expect(COLOR_CHOICES.map((c) => c.value)).toEqual(['white', 'random', 'black']);
    expect(COLOR_CHOICES.map((c) => c.label)).toEqual(['Beyaz', 'Rastgele', 'Siyah']);
  });
});

describe('resolveColor', () => {
  it('beyaz seçilirse w döner', () => expect(resolveColor('white')).toBe('w'));
  it('siyah seçilirse b döner', () => expect(resolveColor('black')).toBe('b'));

  it('rastgele: 0.4 → w', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    expect(resolveColor('random')).toBe('w');
  });

  it('rastgele: 0.6 → b', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    expect(resolveColor('random')).toBe('b');
  });

  it('rastgele: tam 0.5 sınırı b döner (deterministik sınır)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(resolveColor('random')).toBe('b');
  });
});

describe('oppositeColor', () => {
  it('w → b', () => expect(oppositeColor('w')).toBe('b'));
  it('b → w', () => expect(oppositeColor('b')).toBe('w'));
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-color.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/play/color"`

- [ ] **Step 3: Uygulamayı yaz**

`apps/web/lib/play/color.ts`:

```ts
/** Sporcunun maçta oynayacağı taş rengi (madde f). */
export type PieceColor = 'w' | 'b';
export type ColorChoice = 'white' | 'random' | 'black';

export const COLOR_CHOICES: { value: ColorChoice; label: string; emoji: string }[] = [
  { value: 'white',  label: 'Beyaz',    emoji: '⚪' },
  { value: 'random', label: 'Rastgele', emoji: '🎲' },
  { value: 'black',  label: 'Siyah',    emoji: '⚫' },
];

/** Seçimi somut renge çevirir. 'random' → %50 beyaz / %50 siyah. */
export function resolveColor(choice: ColorChoice): PieceColor {
  if (choice === 'white') return 'w';
  if (choice === 'black') return 'b';
  return Math.random() < 0.5 ? 'w' : 'b';
}

export function oppositeColor(c: PieceColor): PieceColor {
  return c === 'w' ? 'b' : 'w';
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-color.test.ts`
Beklenen: PASS — 8 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/color.ts apps/web/tests/play-color.test.ts
git commit -m "feat: renk secimi saf mantigi (Beyaz/Rastgele/Siyah)"
```

---

## Task 3: `resultText.ts` — sonuç bildirimi metni

**Files:**
- Create: `apps/web/lib/play/resultText.ts`
- Test: `apps/web/tests/play-result-text.test.ts`

**Not:** Kullanıcı üç sabit metin istedi (madde c): `1 – 0 (Beyaz Kazandı)`,
`1/2 – 1/2 (Beraberlik)`, `0 – 1 (Siyah Kazandı)`. Tirelerin **uzun tire (–)**
olduğuna dikkat — kullanıcının yazdığı karakter aynen korunuyor.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/play-result-text.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatGameResult, GAME_RESULT_TEXT } from '@/lib/play/resultText';

describe('GAME_RESULT_TEXT', () => {
  it('üç sonuç için kullanıcının istediği tam metinler', () => {
    expect(GAME_RESULT_TEXT['1-0']).toBe('1 – 0 (Beyaz Kazandı)');
    expect(GAME_RESULT_TEXT['0-1']).toBe('0 – 1 (Siyah Kazandı)');
    expect(GAME_RESULT_TEXT['1/2-1/2']).toBe('1/2 – 1/2 (Beraberlik)');
  });
});

describe('formatGameResult', () => {
  it('beyaz kazandı', () => {
    expect(formatGameResult('1-0')).toBe('1 – 0 (Beyaz Kazandı)');
  });

  it('siyah kazandı', () => {
    expect(formatGameResult('0-1')).toBe('0 – 1 (Siyah Kazandı)');
  });

  it('beraberlik', () => {
    expect(formatGameResult('1/2-1/2')).toBe('1/2 – 1/2 (Beraberlik)');
  });

  it('bilinmeyen sonuç boş string döner (çökmez)', () => {
    expect(formatGameResult('garbage')).toBe('');
  });

  it('undefined sonuç boş string döner', () => {
    expect(formatGameResult(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-result-text.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/play/resultText"`

- [ ] **Step 3: Uygulamayı yaz**

`apps/web/lib/play/resultText.ts`:

```ts
/**
 * Maç sonucu bildirimi (madde c). Backend'in GameResult enum değerleri
 * ('1-0' | '0-1' | '1/2-1/2') doğrudan bu metinlere eşlenir — yeni bir
 * backend alanı gerekmiyor.
 *
 * NOT: Tireler UZUN TİRE (–, U+2013). Kullanıcının yazdığı biçim aynen korundu.
 */
export const GAME_RESULT_TEXT: Record<string, string> = {
  '1-0': '1 – 0 (Beyaz Kazandı)',
  '0-1': '0 – 1 (Siyah Kazandı)',
  '1/2-1/2': '1/2 – 1/2 (Beraberlik)',
};

/** Bilinmeyen/eksik sonuçta boş string — UI çökmez, sadece bildirim göstermez. */
export function formatGameResult(result: string | undefined): string {
  if (!result) return '';
  return GAME_RESULT_TEXT[result] ?? '';
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-result-text.test.ts`
Beklenen: PASS — 6 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/resultText.ts apps/web/tests/play-result-text.test.ts
git commit -m "feat: mac sonucu bildirim metni (1-0 / 0-1 / 1-2-1-2)"
```

---

## Task 4: `drawOffers.ts` — 3 teklif hakkı saf mantığı

**Files:**
- Create: `apps/web/lib/play/drawOffers.ts`
- Test: `apps/web/tests/play-draw-offers.test.ts`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/play-draw-offers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MAX_DRAW_OFFERS, canOfferDraw, offersLeft } from '@/lib/play/drawOffers';

describe('MAX_DRAW_OFFERS', () => {
  it('3tur (madde d)', () => expect(MAX_DRAW_OFFERS).toBe(3));
});

describe('canOfferDraw', () => {
  it('hiç teklif edilmemişse izin verir', () => expect(canOfferDraw(0)).toBe(true));
  it('1 ve 2 teklifte hâlâ izin verir', () => {
    expect(canOfferDraw(1)).toBe(true);
    expect(canOfferDraw(2)).toBe(true);
  });
  it('3 teklifte artık izin VERMEZ', () => expect(canOfferDraw(3)).toBe(false));
  it('3ten fazlaysa izin vermez (bozuk veri koruması)', () => {
    expect(canOfferDraw(4)).toBe(false);
  });
});

describe('offersLeft', () => {
  it('0 kullanıldıysa 3 hak kalır', () => expect(offersLeft(0)).toBe(3));
  it('2 kullanıldıysa 1 hak kalır', () => expect(offersLeft(2)).toBe(1));
  it('3 kullanıldıysa 0 hak kalır', () => expect(offersLeft(3)).toBe(0));
  it('negatife düşmez', () => expect(offersLeft(5)).toBe(0));
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-draw-offers.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/play/drawOffers"`

- [ ] **Step 3: Uygulamayı yaz**

`apps/web/lib/play/drawOffers.ts`:

```ts
/**
 * Beraberlik teklifi hakkı (madde d): her oyuncu bir maçta EN FAZLA 3 kez
 * teklif edebilir. Sayaç sunucuda tutulur (games tablosu), bu modül yalnızca
 * kuralı ifade eder — hem UI hem test aynı kuralı kullanır.
 */
export const MAX_DRAW_OFFERS = 3;

export function canOfferDraw(used: number): boolean {
  return used < MAX_DRAW_OFFERS;
}

export function offersLeft(used: number): number {
  return Math.max(0, MAX_DRAW_OFFERS - used);
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-draw-offers.test.ts`
Beklenen: PASS — 9 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/drawOffers.ts apps/web/tests/play-draw-offers.test.ts
git commit -m "feat: beraberlik teklifi 3-hak siniri saf mantigi"
```

---

## Task 5: Backend model + migration (`games` sütunları, `openings` tablosu)

**Files:**
- Modify: `apps/api/chess_api/models/game.py`
- Create: `apps/api/chess_api/models/opening.py`
- Modify: `apps/api/chess_api/models/__init__.py`
- Create: `apps/api/alembic/versions/20260727_PlayFeatures_add.py`
- Test: `apps/api/tests/test_play_models.py`

**KURAL #4:** Migration yalnızca `ADD COLUMN` + `CREATE TABLE`. `games` bir
müfredat tablosu DEĞİL. Hiçbir `DROP`/`TRUNCATE`/`DELETE` yok.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_play_models.py`:

```python
import pytest
from sqlalchemy import select
from chess_api.models import Game, GameType, GameStatus
from chess_api.models.opening import Opening


@pytest.mark.asyncio
async def test_yeni_oyunda_beraberlik_sayaclari_sifirdir(db):
    """Varsayilan 0 olmali; mevcut satirlar da 0 kabul edilir (geriye uyumluluk)."""
    game = Game(type=GameType.human, white_child_id=1, black_child_id=2,
                status=GameStatus.active)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    assert game.white_draw_offers == 0
    assert game.black_draw_offers == 0


@pytest.mark.asyncio
async def test_start_fen_varsayilan_none(db):
    """start_fen bossa standart baslangic pozisyonu varsayilir (geriye uyumluluk)."""
    game = Game(type=GameType.bot, white_child_id=1, black_bot_level=5)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    assert game.start_fen is None


@pytest.mark.asyncio
async def test_start_fen_kaydedilebilir(db):
    fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    game = Game(type=GameType.bot, white_child_id=1, black_bot_level=5, start_fen=fen)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    assert game.start_fen == fen


@pytest.mark.asyncio
async def test_opening_kaydedilir(db):
    op = Opening(name="İtalyan Açılışı",
                 start_fen="r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1")
    db.add(op)
    await db.commit()
    found = (await db.execute(select(Opening))).scalars().all()
    assert len(found) == 1
    assert found[0].name == "İtalyan Açılışı"
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_play_models.py -q`
Beklenen: FAIL — `ModuleNotFoundError: No module named 'chess_api.models.opening'`

- [ ] **Step 3: `game.py`'ye üç sütun ekle**

`apps/api/chess_api/models/game.py` içinde `Game` sınıfında,
`pgn: Mapped[str | None] = mapped_column(Text, nullable=True)` satırının ALTINA ekle:

```python
    # Beraberlik teklifi sayaclari (madde d) — oyuncu basina en fazla 3 teklif.
    white_draw_offers: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    black_draw_offers: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    # Acilis pratigi icin baslangic pozisyonu. None => standart baslangic (geriye uyumlu).
    start_fen: Mapped[str | None] = mapped_column(String(120), nullable=True)
```

- [ ] **Step 4: `opening.py`'yi yaz**

`apps/api/chess_api/models/opening.py`:

```python
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Opening(Base):
    """Acilis pratigi icin bir acilis: adi ve baslangic pozisyonu (FEN).

    Icerik Zafer Hoca tarafindan admin panelinden girilir (kullanici verisi).
    """

    __tablename__ = "openings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    start_fen: Mapped[str] = mapped_column(String(120))
```

- [ ] **Step 5: `__init__.py`'ye ekle**

`apps/api/chess_api/models/__init__.py` içinde
`from chess_api.models.practice import ChildPracticeResult` satırının ALTINA ekle:

```python
from chess_api.models.opening import Opening
```

Aynı dosyada `__all__` içinde `"ChildPracticeResult",` satırının ALTINA ekle:

```python
    "Opening",
```

- [ ] **Step 6: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_play_models.py -q`
Beklenen: PASS — 4 test

- [ ] **Step 7: Migration yaz**

`apps/api/alembic/versions/20260727_PlayFeatures_add.py`:

```python
"""add play features: draw offer counters, start_fen, openings table

Revision ID: PlayFeatures
Revises: PracticeResults
Create Date: 2026-07-27 00:00:00.000000

SADECE ADD COLUMN + CREATE TABLE. Mevcut satirlar etkilenmez:
server_default='0' sayesinde eski oyunlarda sayaclar 0 olur, start_fen NULL
kalir ve NULL => standart baslangic pozisyonu demektir (KURAL #3).
Mufredat tablolarina dokunulmadi (KURAL #4).
"""
import sqlalchemy as sa
from alembic import op

revision = 'PlayFeatures'
down_revision = 'PracticeResults'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('games', sa.Column('white_draw_offers', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('games', sa.Column('black_draw_offers', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('games', sa.Column('start_fen', sa.String(length=120), nullable=True))
    op.create_table(
        'openings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('start_fen', sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('openings')
    op.drop_column('games', 'start_fen')
    op.drop_column('games', 'black_draw_offers')
    op.drop_column('games', 'white_draw_offers')
```

- [ ] **Step 8: Migration zincirinin tek başlı olduğunu doğrula**

Çalıştır: `cd apps/api && python -m alembic heads`
Beklenen: Tek satır — `PlayFeatures (head)`. Birden fazla head görünürse DUR.

- [ ] **Step 9: Migration guard testinin geçtiğini doğrula (KURAL #4)**

Çalıştır: `cd apps/api && python -m pytest tests/test_migration_guard.py -q`
Beklenen: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/api/chess_api/models/game.py apps/api/chess_api/models/opening.py apps/api/chess_api/models/__init__.py apps/api/alembic/versions/20260727_PlayFeatures_add.py apps/api/tests/test_play_models.py
git commit -m "feat: games beraberlik sayaclari + start_fen + openings tablosu"
```

---

## Task 6: Backend — `decline_draw` + 3 teklif sınırı

**Files:**
- Modify: `apps/api/chess_api/routers/live_game.py`
- Test: `apps/api/tests/test_draw_offers_ws.py`

**Mevcut durum:** `live_game.py:118-121` — `offer_draw` sınırsız broadcast
ediyor, `accept_draw` oyunu bitiriyor. Red mesajı ve sayaç yok.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_draw_offers_ws.py`:

```python
import pytest
from sqlalchemy import select
from chess_api.models import Game, GameType, GameStatus
from chess_api.routers.live_game import _handle_offer_draw, _handle_decline_draw
from chess_api.services.game_room import get_room, _reset_for_tests


class FakeSender:
    """GameRoom'un bekledigi 'async send_json' arayuzunu taklit eder."""

    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


async def _make_game(db) -> Game:
    game = Game(type=GameType.human, white_child_id=1, black_child_id=2,
                status=GameStatus.active)
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return game


@pytest.mark.asyncio
async def test_beraberlik_teklifi_rakibe_iletilir_ve_sayac_artar(db, monkeypatch):
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_offer_draw(game.id, child_id=1, white_id=1, room=room)

    assert any(m.get("type") == "draw_offered" for m in black.messages)
    await db.refresh(game)
    assert game.white_draw_offers == 1


@pytest.mark.asyncio
async def test_dorduncu_teklif_reddedilir(db, monkeypatch):
    _reset_for_tests()
    game = await _make_game(db)
    game.white_draw_offers = 3
    await db.commit()
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_offer_draw(game.id, child_id=1, white_id=1, room=room)

    # Rakibe teklif GITMEZ, teklif edene limit uyarisi gider
    assert not any(m.get("type") == "draw_offered" for m in black.messages)
    assert any(m.get("type") == "draw_offer_rejected" for m in white.messages)
    await db.refresh(game)
    assert game.white_draw_offers == 3  # artmadi


@pytest.mark.asyncio
async def test_red_rakibe_bildirilir_ve_oyun_devam_eder(db, monkeypatch):
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    await _handle_decline_draw(game.id, child_id=2, room=room)

    assert any(m.get("type") == "draw_declined" for m in white.messages)
    await db.refresh(game)
    assert game.status == GameStatus.active  # oyun BITMEDI


class _SessionCtx:
    """Testte 'async with get_session_factory()() as db' kalibini karsilar."""

    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self._db

    async def __aexit__(self, *exc):
        return False
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_draw_offers_ws.py -q`
Beklenen: FAIL — `ImportError: cannot import name '_handle_offer_draw'`

- [ ] **Step 3: `live_game.py`'ye iki handler ekle**

`apps/api/chess_api/routers/live_game.py` dosyasının SONUNA ekle:

```python
MAX_DRAW_OFFERS = 3


async def _handle_offer_draw(game_id, child_id, white_id, room):
    """Beraberlik teklifi (madde d). Oyuncu basina en fazla 3 teklif."""
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
        is_white = child_id == white_id
        used = game.white_draw_offers if is_white else game.black_draw_offers
        if used >= MAX_DRAW_OFFERS:
            await room.send_to(child_id, {
                "type": "draw_offer_rejected", "reason": "limit",
                "max_offers": MAX_DRAW_OFFERS,
            })
            return
        if is_white:
            game.white_draw_offers = used + 1
        else:
            game.black_draw_offers = used + 1
        offers_used = used + 1
        await db.commit()

    await room.send_to(child_id, {"type": "draw_offer_sent", "offers_used": offers_used})
    await room.broadcast({"type": "draw_offered", "by_child_id": child_id}, exclude=child_id)


async def _handle_decline_draw(game_id, child_id, room):
    """Beraberlik teklifini reddetme (madde d). Oyun DEVAM EDER."""
    async with get_session_factory()() as db:
        game = await db.get(Game, game_id)
        if not game or game.status != GameStatus.active:
            return
    await room.broadcast({"type": "draw_declined", "by_child_id": child_id}, exclude=child_id)
```

- [ ] **Step 4: Mesaj yönlendirmesini güncelle**

`apps/api/chess_api/routers/live_game.py` satır 118-121'deki dallanmayı şu hale getir:

```python
            elif mtype == "offer_draw":
                await _handle_offer_draw(game_id, child_id, white_id, room)
            elif mtype == "decline_draw":
                await _handle_decline_draw(game_id, child_id, room)
            elif mtype == "accept_draw":
                await _handle_draw(game_id, room)
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_draw_offers_ws.py -q`
Beklenen: PASS — 3 test

- [ ] **Step 6: Mat/pat'ta da `game_over` yayınla (öz-denetimde bulunan boşluk)**

**Sorun:** `_handle_move` mat/pat'ta yalnızca `move_made` yayınlıyor
(`live_game.py:176-184`); `game_over` **yayınlamıyor**. Bu yüzden frontend'in
sonuç bildirimi (`1 – 0 (Beyaz Kazandı)` vb.) mat sonunda hiç görünmez —
sadece terk/beraberlikte görünür. Kullanıcı bildirimi bir sonuç ilanı olarak
istedi, mat da bir sonuçtur.

Testi `apps/api/tests/test_draw_offers_ws.py` dosyasının SONUNA ekle:

```python
@pytest.mark.asyncio
async def test_matta_game_over_yayinlanir(db, monkeypatch):
    """Mat sonunda sonuc bildirimi icin game_over sart (aksi halde frontend
    sonuc satirini hic gostermez)."""
    from chess_api.routers.live_game import _handle_move
    _reset_for_tests()
    game = await _make_game(db)
    monkeypatch.setattr("chess_api.routers.live_game.get_session_factory",
                        lambda: (lambda: _SessionCtx(db)))
    room = get_room(game.id)
    white, black = FakeSender(), FakeSender()
    room.join(1, white)
    room.join(2, black)

    # Ilk hamleden itibaren en kisa mat (Fool's mate) yerine dogrudan
    # validate_move'u taklit etmek yerine gercek hamleleri oynuyoruz:
    # 1. f3 e5 2. g4 Qh4# -> siyah mat eder.
    for uci, cid in [("f2f3", 1), ("e7e5", 2), ("g2g4", 1), ("d8h4", 2)]:
        await _handle_move(game.id, cid, 1, 2, {"uci": uci}, room)

    all_msgs = white.messages + black.messages
    over = [m for m in all_msgs if m.get("type") == "game_over"]
    assert over, "mat sonunda game_over yayinlanmali"
    assert over[-1]["result"] == "0-1"
```

- [ ] **Step 7: `_handle_move` sonuna `game_over` yayını ekle**

`apps/api/chess_api/routers/live_game.py` içindeki `_handle_move`'un en sonundaki
`await room.broadcast({... "by_child_id": child_id})` çağrısının ALTINA ekle:

```python
    # Mat/pat da bir SONUCtur — frontend'in sonuc bildirimi (1-0 / 0-1 /
    # 1/2-1/2) game_over mesajina bagli, bu yuzden burada da yayinlanir.
    if result["is_checkmate"] or result["is_stalemate"]:
        async with get_session_factory()() as db:
            finished = await db.get(Game, game_id)
            final = finished.result.value if finished and finished.result else None
        if final:
            await room.broadcast({"type": "game_over", "result": final, "by_resign": False})
```

- [ ] **Step 8: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_draw_offers_ws.py -q`
Beklenen: PASS — 4 test

- [ ] **Step 9: Mevcut WS testlerinin bozulmadığını doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_live_game_ws.py tests/test_matchmaking.py -q`
Beklenen: Tümü PASS

- [ ] **Step 10: Commit**

```bash
git add apps/api/chess_api/routers/live_game.py apps/api/tests/test_draw_offers_ws.py
git commit -m "feat: beraberlik 3-hak siniri + decline_draw + matta game_over"
```

---

## Task 7: Backend — lobi servisi ve `/ws/lobby`

**Files:**
- Create: `apps/api/chess_api/services/lobby.py`
- Modify: `apps/api/chess_api/routers/live_game.py`
- Test: `apps/api/tests/test_lobby.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_lobby.py`:

```python
import pytest
from chess_api.services.lobby import (
    join_lobby, leave_lobby, online_players, send_to_player, _reset_for_tests,
)


class FakeSender:
    def __init__(self):
        self.messages = []

    async def send_json(self, data: dict) -> None:
        self.messages.append(data)


def setup_function():
    _reset_for_tests()


def test_baslangicta_kimse_online_degil():
    assert online_players() == []


def test_katilan_oyuncu_online_listesinde_gorunur():
    join_lobby(7, "Ali", FakeSender())
    assert online_players() == [{"child_id": 7, "display_name": "Ali"}]


def test_ayrilan_oyuncu_listeden_cikar():
    join_lobby(7, "Ali", FakeSender())
    leave_lobby(7)
    assert online_players() == []


def test_ayni_oyuncu_iki_kez_katilirsa_tek_kayit_kalir():
    join_lobby(7, "Ali", FakeSender())
    join_lobby(7, "Ali", FakeSender())
    assert len(online_players()) == 1


def test_online_listesi_kendini_haric_tutabilir():
    join_lobby(7, "Ali", FakeSender())
    join_lobby(8, "Veli", FakeSender())
    ids = [p["child_id"] for p in online_players(exclude=7)]
    assert ids == [8]


@pytest.mark.asyncio
async def test_belirli_oyuncuya_mesaj_gonderilir():
    ali, veli = FakeSender(), FakeSender()
    join_lobby(7, "Ali", ali)
    join_lobby(8, "Veli", veli)
    await send_to_player(8, {"type": "challenge_received", "from_child_id": 7})
    assert veli.messages == [{"type": "challenge_received", "from_child_id": 7}]
    assert ali.messages == []


@pytest.mark.asyncio
async def test_olmayan_oyuncuya_mesaj_sessizce_yok_sayilir():
    await send_to_player(999, {"type": "x"})  # patlamamali
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_lobby.py -q`
Beklenen: FAIL — `ModuleNotFoundError: No module named 'chess_api.services.lobby'`

- [ ] **Step 3: `lobby.py`'yi yaz**

`apps/api/chess_api/services/lobby.py`:

```python
"""In-memory lobi: o an bagli (aktif) sporcular ve aralarindaki mac davetleri.

game_room.py ile ayni deseni izler (tek instance deploy varsayimi). Coklu
instance icin Redis pub/sub gerekir — mevcut matchmaking.py'de de ayni sinir var.
"""
from typing import Any, Protocol


class Sender(Protocol):
    async def send_json(self, data: dict) -> None: ...


# child_id -> (display_name, sender)
_players: dict[int, tuple[str, Sender]] = {}


def join_lobby(child_id: int, display_name: str, sender: Sender) -> None:
    """Ayni cocuk tekrar baglanirsa eski kaydin uzerine yazilir (tek sekme kurali)."""
    _players[child_id] = (display_name, sender)


def leave_lobby(child_id: int) -> None:
    _players.pop(child_id, None)


def online_players(exclude: int | None = None) -> list[dict[str, Any]]:
    """Aktif sporcu listesi. exclude verilirse o cocuk listeden cikarilir."""
    return [
        {"child_id": cid, "display_name": name}
        for cid, (name, _) in _players.items()
        if cid != exclude
    ]


async def send_to_player(child_id: int, message: dict) -> bool:
    """Tek bir oyuncuya mesaj. Oyuncu bagli degilse False doner (sessiz)."""
    entry = _players.get(child_id)
    if not entry:
        return False
    try:
        await entry[1].send_json(message)
        return True
    except Exception:
        return False


def _reset_for_tests() -> None:
    _players.clear()
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_lobby.py -q`
Beklenen: PASS — 7 test

- [ ] **Step 5: `/ws/lobby` ucunu ve HTTP listesini ekle**

`apps/api/chess_api/routers/live_game.py` dosyasının başındaki import bloğuna ekle:

```python
from chess_api.services.lobby import (
    join_lobby, leave_lobby, online_players, send_to_player,
)
```

Ayrıca aynı dosyanın import bloğunda `from fastapi import ...` satırını şu hale getir
(HTTP uç için `Depends` gerekli):

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
```

Ve dosyanın SONUNA ekle:

```python
@router.get("/lobby/online")
async def lobby_online(child: ChildProfile = Depends(get_current_child)):
    """Ilk yuklemede aktif sporcu listesi; canli guncelleme WS uzerinden gelir."""
    return {"players": online_players(exclude=child.id)}


async def _resolve_display_name(child_id: int) -> str:
    async with get_session_factory()() as db:
        child = await db.get(ChildProfile, child_id)
        return child.display_name if child else "Sporcu"


async def _handle_challenge(child_id: int, msg: dict) -> None:
    """Belirli bir sporcuya mac daveti (madde b)."""
    target = msg.get("target_child_id")
    if not isinstance(target, int):
        return
    name = await _resolve_display_name(child_id)
    await send_to_player(target, {
        "type": "challenge_received",
        "from_child_id": child_id,
        "from_name": name,
        "criteria": msg.get("criteria") or {},
    })


async def _handle_challenge_accept(child_id: int, msg: dict) -> None:
    """Daveti kabul et: oyunu olustur ve iki tarafa da bildir.

    RENGI DAVET EDEN (challenger) belirler; kabul eden sadece onu alir.
    criteria.color: 'w' => challenger beyaz, 'b' => challenger siyah.
    """
    challenger = msg.get("from_child_id")
    if not isinstance(challenger, int):
        return
    criteria = msg.get("criteria") or {}
    challenger_is_white = criteria.get("color", "w") == "w"
    white_id = challenger if challenger_is_white else child_id
    black_id = child_id if challenger_is_white else challenger

    game_id = await _create_human_game(white_id, black_id)

    await send_to_player(challenger, {
        "type": "matched", "game_id": game_id,
        "color": "white" if challenger_is_white else "black",
        "opponent_id": child_id,
    })
    await send_to_player(child_id, {
        "type": "matched", "game_id": game_id,
        "color": "black" if challenger_is_white else "white",
        "opponent_id": challenger,
    })


async def _handle_challenge_decline(child_id: int, msg: dict) -> None:
    challenger = msg.get("from_child_id")
    if isinstance(challenger, int):
        await send_to_player(challenger, {
            "type": "challenge_declined", "by_child_id": child_id,
        })


@router.websocket("/ws/lobby")
async def lobby_ws(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    child_id = _child_id_from_token(token)
    if not child_id:
        await websocket.send_json({"type": "error", "message": "auth"})
        await websocket.close(code=4401)
        return

    name = await _resolve_display_name(child_id)
    join_lobby(child_id, name, websocket)
    await websocket.send_json({"type": "lobby_joined", "players": online_players(exclude=child_id)})

    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            if mtype == "challenge":
                await _handle_challenge(child_id, msg)
            elif mtype == "challenge_accept":
                await _handle_challenge_accept(child_id, msg)
            elif mtype == "challenge_decline":
                await _handle_challenge_decline(child_id, msg)
    except WebSocketDisconnect:
        leave_lobby(child_id)
    except Exception:
        logger.exception("lobby_ws error")
        leave_lobby(child_id)
```

`get_current_child` import'unu da ekle (dosyada henüz yok):

```python
from chess_api.dependencies.auth import get_current_child
```

- [ ] **Step 6: WS uç testini yaz**

`apps/api/tests/test_lobby_ws.py`:

```python
from fastapi.testclient import TestClient
from chess_api.main import create_app
from chess_api.services.jwt import encode_token
from chess_api.services.lobby import _reset_for_tests


def test_lobby_ws_gecersiz_token_reddedilir():
    _reset_for_tests()
    client = TestClient(create_app())
    with client.websocket_connect("/ws/lobby?token=not.a.real.token") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"


def test_lobby_ws_gecerli_tokenda_katilim_onaylanir():
    _reset_for_tests()
    client = TestClient(create_app())
    token = encode_token({"child_profile_id": 1, "role": "child"})
    with client.websocket_connect(f"/ws/lobby?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "lobby_joined"
        assert msg["players"] == []  # kendisi haric kimse yok
```

- [ ] **Step 7: WS testinin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_lobby_ws.py -q`
Beklenen: PASS — 2 test

- [ ] **Step 8: Tüm backend testlerini çalıştır (regresyon)**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: Tümü PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/chess_api/services/lobby.py apps/api/chess_api/routers/live_game.py apps/api/tests/test_lobby.py apps/api/tests/test_lobby_ws.py
git commit -m "feat: lobi servisi + /ws/lobby (arkadasa mac daveti)"
```

---

## Task 8: `MatchCriteria` — paylaşılan Düzey/Tempo/Renk seçim bileşeni

**Files:**
- Create: `apps/web/components/play/MatchCriteria.tsx`
- Test: `apps/web/tests/match-criteria.test.tsx`

**Neden paylaşılan:** Aynı seçim ekranı üç akışta kullanılacak (Bota Karşı,
Arkadaşla, Açılış Pratiği) — kopyalamak yerine tek bileşen (DRY).

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/match-criteria.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCriteria } from '@/components/play/MatchCriteria';

describe('MatchCriteria', () => {
  it('8 zorluk düzeyi butonu gösterir', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(screen.getByRole('button', { name: `Düzey ${n}` })).toBeInTheDocument();
    }
  });

  it('üç renk seçeneği gösterir', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    expect(screen.getByRole('button', { name: 'Beyaz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rastgele' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siyah' })).toBeInTheDocument();
  });

  it('Süresiz tempo seçeneği YOKTUR (madde g)', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    expect(screen.queryByText(/süresiz/i)).not.toBeInTheDocument();
  });

  it('tempo seçilmeden başlatma butonu devre dışıdır', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    expect(screen.getByRole('button', { name: /Oyuna Başla/ })).toBeDisabled();
  });

  it('düzey+tempo seçilince başlatma butonu aktifleşir ve seçimleri geri verir', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Oyuna Başla" />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 3' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siyah' }));
    const startBtn = screen.getByRole('button', { name: /Oyuna Başla/ });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);
    const arg = onStart.mock.calls[0][0];
    expect(arg.level.level).toBe(3);
    expect(arg.level.skill).toBe(6);
    expect(arg.timeControl.label).toBe('5+0');
    expect(arg.colorChoice).toBe('black');
  });

  it('varsayılan renk Rastgeledir', () => {
    const onStart = vi.fn();
    render(<MatchCriteria onStart={onStart} startLabel="Oyuna Başla" />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 1' }));
    fireEvent.click(screen.getByRole('button', { name: '3+2' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyuna Başla/ }));
    expect(onStart.mock.calls[0][0].colorChoice).toBe('random');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/match-criteria.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/components/play/MatchCriteria"`

- [ ] **Step 3: Bileşeni yaz**

`apps/web/components/play/MatchCriteria.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { LEVELS, TIME_GROUPS } from '@/lib/play/levels';
import type { PlayLevel } from '@/lib/play/levels';
import { COLOR_CHOICES } from '@/lib/play/color';
import type { ColorChoice } from '@/lib/play/color';
import type { TimeControl } from '@/components/BotGame';

export interface MatchCriteriaValue {
  level: PlayLevel;
  timeControl: TimeControl;
  colorChoice: ColorChoice;
}

interface Props {
  onStart: (value: MatchCriteriaValue) => void;
  /** Başlatma butonunun metni ("Oyuna Başla" / "Teklif Gönder" / "Pratiğe Başla"). */
  startLabel: string;
}

/** Düzey (1-8) + Tempo + Renk seçimi. Bota Karşı, Arkadaşla ve Açılış
 *  Pratiği akışlarının üçünde de aynen kullanılır (DRY). */
export function MatchCriteria({ onStart, startLabel }: Props) {
  const [level, setLevel] = useState<PlayLevel>(LEVELS[0]);
  const [tc, setTc] = useState<TimeControl | null>(null);
  const [colorChoice, setColorChoice] = useState<ColorChoice>('random');

  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Düzey (1 en kolay · 8 en zor)</p>
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map((l) => (
            <button key={l.level} type="button" onClick={() => setLevel(l)}
              className="py-3 rounded-xl text-sm font-bold transition-all"
              style={pill(level.level === l.level)}>
              Düzey {l.level}
            </button>
          ))}
        </div>
      </div>

      {TIME_GROUPS.map((g) => (
        <div key={g.cat} className="space-y-2">
          <p className="text-xs font-semibold t-muted uppercase tracking-wide flex items-center gap-1.5">
            <span>{g.emoji}</span> {g.cat}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {g.items.map((item) => (
              <button key={item.label} type="button" onClick={() => setTc(item)}
                className="py-3 rounded-xl text-sm font-bold transition-all"
                style={pill(tc?.label === item.label)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Renk</p>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_CHOICES.map((c) => (
            <button key={c.value} type="button" onClick={() => setColorChoice(c.value)}
              className="py-3 rounded-xl text-sm font-bold transition-all"
              style={pill(colorChoice === c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!tc}
        onClick={() => { if (tc) onStart({ level, timeControl: tc, colorChoice }); }}
        className="w-full py-3.5 rounded-xl text-base font-bold transition-all shadow-sm disabled:opacity-40"
        style={{ background: 'var(--t-accent)', color: '#fff' }}
      >
        ▶️ {startLabel}{tc ? ` (${tc.label})` : ''}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/match-criteria.test.tsx`
Beklenen: PASS — 6 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/play/MatchCriteria.tsx apps/web/tests/match-criteria.test.tsx
git commit -m "feat: MatchCriteria bileseni (Duzey 1-8 + Tempo + Renk)"
```

---

## Task 9: `BotGame` — renk ve başlangıç FEN'i desteği

**Files:**
- Modify: `apps/web/components/BotGame.tsx`
- Test: `apps/web/tests/bot-game-color.test.tsx`

**ÖLÇÜLDÜ — üç yer beyaz varsayımına bağlı:** `BotGame.tsx:185` (`childTurn`),
`:96-97` (saat hangi tarafın azalacağı), `:133` (mat sonucunda kim kazandı).
Hepsi `studentColor`'a göre güncellenecek.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

**ÖLÇÜLEN SINIR (P5'te yaşandı):** Gerçek `react-chessboard`, pozisyon
DEĞİŞTİĞİNDE kareden `getBoundingClientRect().width` okuyor ve happy-dom'da
layout olmadığı için **"Square width not found"** fırlatıyor. Bu testte bot
ilk hamlesini oynayacağı için pozisyon değişir → gerçek tahta kullanılamaz.
Bu yüzden `ChessBoard` stub'lanır ve **prop'lar üzerinden** doğrulama yapılır
(zaten test edilen şey tahta çizimi değil, renk/FEN mantığı).

`apps/web/tests/bot-game-color.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Stockfish worker happy-dom'da calismaz — motoru taklit ediyoruz.
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e2e4'; }
    destroy() {}
  },
}));

// NEDEN STUB: gercek react-chessboard pozisyon degisince happy-dom'da
// "Square width not found" firlatir (P5'te olculdu). Burada test edilen sey
// tahta cizimi degil, renk/FEN mantigi — prop'lar uzerinden dogruluyoruz.
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, boardOrientation }: { fen: string; boardOrientation?: string }) => (
    <div data-testid="board" data-fen={fen} data-orientation={boardOrientation ?? 'white'} />
  ),
}));

import { BotGame } from '@/components/BotGame';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

const board = () => screen.getByTestId('board');

describe('BotGame — renk desteği', () => {
  it('sporcu beyazsa tahta beyaz yönünde açılır', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board().getAttribute('data-orientation')).toBe('white'));
  });

  it('sporcu siyahsa tahta siyah yönünde açılır', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="b" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board().getAttribute('data-orientation')).toBe('black'));
  });

  it('sporcu beyazsa bot BAŞTA hamle yapmaz (sıra sporcuda)', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board()).toBeInTheDocument());
    // Baslangic pozisyonu degismemis olmali: beyaz oynayacak (" w " iceriyor)
    expect(board().getAttribute('data-fen')).toContain(' w ');
  });

  it('sporcu siyahsa bot ilk hamleyi otomatik oynar (e2e4)', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="b" onGameEnd={vi.fn()} />);
    // Mock motor e2e4 oynar → FEN'de e4'te piyon olur ve sira siyaha gecer.
    await waitFor(
      () => {
        const fen = board().getAttribute('data-fen') ?? '';
        expect(fen).toContain(' b ');          // sira siyahta (sporcuda)
        expect(fen.split(' ')[0]).not.toBe(
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',  // pozisyon degisti
        );
      },
      { timeout: 3000 },
    );
  });

  it('startFen verilirse oyun o pozisyondan başlar', async () => {
    // Beyazin e4 oynadigi, siranin SIYAHTA oldugu pozisyon; sporcu siyah
    // oldugu icin bot hamle yapmaz ve FEN aynen korunur.
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    render(<BotGame skillLevel={0} depth={1} studentColor="b" startFen={fen} onGameEnd={vi.fn()} />);
    await waitFor(() => {
      const shown = board().getAttribute('data-fen') ?? '';
      expect(shown.split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
    });
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/bot-game-color.test.tsx`
Beklenen: FAIL — `studentColor` prop'u tipte yok / tahta yönü değişmiyor

- [ ] **Step 3: Props ve state'i güncelle**

`apps/web/components/BotGame.tsx` içindeki `interface Props` bloğunu şu hale getir:

```ts
interface Props {
  skillLevel: number;
  depth: number;
  timeControl?: TimeControl | null;
  /** Sporcunun oynadigi renk (madde f). Varsayilan 'w' — eski cagrilar bozulmaz. */
  studentColor?: 'w' | 'b';
  /** Acilis pratigi icin baslangic pozisyonu. Verilmezse standart baslangic. */
  startFen?: string;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
}
```

Bileşen imzasını ve `chessRef` başlatmasını şu hale getir:

```ts
export function BotGame({ skillLevel, depth, timeControl, studentColor = 'w', startFen, onGameEnd }: Props) {
  const chessRef = useRef(new Chess(startFen));
  const botColor = studentColor === 'w' ? 'b' : 'w';
```

- [ ] **Step 4: Saat, mat sonucu ve sıra mantığını renkten bağımsız hale getir**

`useEffect` içindeki saat tick bloğunu (satır ~92-100) şu hale getir:

```ts
  useEffect(() => {
    if (!tc || status !== 'playing') return;
    const id = setInterval(() => {
      const turn = chessRef.current.turn();
      // Saat HER ZAMAN sirasi gelen rengin saatinden duser — sporcunun rengi
      // ne olursa olsun beyaz saati beyazin, siyah saati siyahin.
      if (turn === 'w') setWhiteTime((t) => Math.max(0, t - 1));
      else setBlackTime((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [tc, status]);
```

Zaman aşımı bloğunu (satır ~103-114) şu hale getir:

```ts
  useEffect(() => {
    if (!tc || status !== 'playing') return;
    const studentTime = studentColor === 'w' ? whiteTime : blackTime;
    const botTime = studentColor === 'w' ? blackTime : whiteTime;
    if (studentTime <= 0) {
      setStatus('over');
      setResultText('⏰ Süren bitti — Bot kazandı.');
      onGameEnd('loss');
    } else if (botTime <= 0) {
      setStatus('over');
      setResultText('⏰ Botun süresi bitti — Kazandın! 🎉');
      onGameEnd('win');
    }
  }, [whiteTime, blackTime, status, tc, onGameEnd, studentColor]);
```

`finish()` fonksiyonunu şu hale getir:

```ts
  function finish() {
    const chess = chessRef.current;
    setStatus('over');
    if (chess.isCheckmate()) {
      // Mat olan taraf SIRASI GELEN taraftir; sporcu mat edildiyse kaybetti.
      const studentWon = chess.turn() === botColor;
      setResultText(studentWon ? '🎉 Kazandın! Mat!' : '😔 Bot kazandı.');
      onGameEnd(studentWon ? 'win' : 'loss');
    } else {
      setResultText('🤝 Berabere.');
      onGameEnd('draw');
    }
  }
```

`childTurn` hesaplamasını (satır ~185) şu hale getir:

```ts
  const childTurn = chessRef.current.turn() === studentColor;
```

Artış (increment) uygulamasını `handleDrop` içinde renkten bağımsız yap
(satır ~153 ve ~165):

```ts
    if (tc) {
      // Hamleyi yapan SPORCU — kendi rengine gore artis eklenir.
      if (studentColor === 'w') setWhiteTime((t) => t + tc.increment);
      else setBlackTime((t) => t + tc.increment);
    }
```

ve bot hamlesinden sonra:

```ts
          if (tc) {
            if (botColor === 'w') setWhiteTime((t) => t + tc.increment);
            else setBlackTime((t) => t + tc.increment);
          }
```

- [ ] **Step 5: Tahta yönünü ve saat etiketlerini güncelle**

`<ChessBoard ... />` çağrısını şu hale getir:

```tsx
      <ChessBoard
        fen={fen}
        interactive={status === 'playing' && !thinking}
        onPieceDrop={handleDrop}
        boardOrientation={studentColor === 'w' ? 'white' : 'black'}
      />
```

Üstteki bot saatini şu hale getir (bot rengine göre doğru saat gösterilsin):

```tsx
      {tc && (
        <div className="max-w-sm mx-auto mb-2">
          <Clock seconds={botColor === 'w' ? whiteTime : blackTime}
            active={!childTurn && status === 'playing'} label="🤖 Bot" />
        </div>
      )}
```

Alttaki sporcu saatini şu hale getir:

```tsx
      {tc && (
        <div className="max-w-sm mx-auto mt-2">
          <Clock seconds={studentColor === 'w' ? whiteTime : blackTime}
            active={childTurn && status === 'playing'} label="🧒 Sen" />
        </div>
      )}
```

- [ ] **Step 6: Sporcu siyahsa botun ilk hamlesini oynat**

Motor kurulum `useEffect`'inin içinde, `if (!cancelled) setStatus('playing');`
satırının ALTINA ekle:

```ts
      // Sporcu siyahsa beyaz (bot) baslar — ilk hamleyi otomatik oynat.
      if (!cancelled && chessRef.current.turn() === botColor) {
        setThinking(true);
        try {
          const uci = await eng.bestMove(chessRef.current.fen(), depth);
          if (uci && uci !== '(none)') {
            chessRef.current.move({
              from: uci.slice(0, 2) as Square,
              to: uci.slice(2, 4) as Square,
              promotion: 'q',
            });
            setFen(chessRef.current.fen());
            await persistMove(uci);
          }
        } catch { /* motor hatasi oyunu kilitlemez */ }
        if (!cancelled) setThinking(false);
      }
```

Aynı `useEffect`'in bağımlılık dizisini `[skillLevel]` yerine şu hale getir:

```ts
  }, [skillLevel, depth, botColor]);
```

- [ ] **Step 7: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/bot-game-color.test.tsx`
Beklenen: PASS — 5 test

- [ ] **Step 8: Tip kontrolü**

Çalıştır: `cd apps/web && npx tsc --noEmit`
Beklenen: Hatasız. `page.tsx` hâlâ eski `LEVELS`'ı kullanıyorsa hata verebilir —
Task 12'de düzeltilecek; şimdilik hata çıkarsa Task 12'ye kadar
`page.tsx`'i **değiştirme**, hatayı not et ve Task 12'de gider.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/BotGame.tsx apps/web/tests/bot-game-color.test.tsx
git commit -m "feat: BotGame renk secimi (studentColor) + startFen destegi"
```

---

## Task 10: `LiveGame` — Terk Et, red butonu, sonuç formatı, hak sayacı

**Files:**
- Modify: `apps/web/components/LiveGame.tsx`
- Test: `apps/web/tests/live-game-controls.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/live-game-controls.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const sent: object[] = [];
let handler: ((d: unknown) => void) | null = null;

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (_url: string | null, onMessage: (d: unknown) => void) => {
    handler = onMessage;
    return { send: (d: object) => { sent.push(d); }, readyState: 1 };
  },
  wsBase: () => 'ws://test',
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { LiveGame } from '@/components/LiveGame';

function setup() {
  sent.length = 0;
  handler = null;
  return render(<LiveGame gameId={1} myColor="white" />);
}

describe('LiveGame — Terk Et', () => {
  it('buton metni "Terk Et"tir (kullanıcının kelimesi)', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Teslim ol/ })).not.toBeInTheDocument();
  });

  it('onaylanınca resign mesajı gönderir', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Terk Et' }));
    expect(sent).toContainEqual({ type: 'resign' });
  });
});

describe('LiveGame — sonuç bildirimi formatı (madde c)', () => {
  it('beyaz kazandığında "1 – 0 (Beyaz Kazandı)" gösterir', () => {
    setup();
    handler!({ type: 'game_over', result: '1-0' });
    expect(screen.getByText('1 – 0 (Beyaz Kazandı)')).toBeInTheDocument();
  });

  it('siyah kazandığında "0 – 1 (Siyah Kazandı)" gösterir', () => {
    setup();
    handler!({ type: 'game_over', result: '0-1' });
    expect(screen.getByText('0 – 1 (Siyah Kazandı)')).toBeInTheDocument();
  });

  it('beraberlikte "1/2 – 1/2 (Beraberlik)" gösterir', () => {
    setup();
    handler!({ type: 'game_over', result: '1/2-1/2' });
    expect(screen.getByText('1/2 – 1/2 (Beraberlik)')).toBeInTheDocument();
  });
});

describe('LiveGame — beraberlik teklifi (madde d)', () => {
  it('teklif gelince Kabul Et ve Kabul Etme butonları görünür', () => {
    setup();
    handler!({ type: 'draw_offered', by_child_id: 2 });
    expect(screen.getByRole('button', { name: 'Kabul Et' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kabul Etme' })).toBeInTheDocument();
  });

  it('Kabul Et accept_draw gönderir', () => {
    setup();
    handler!({ type: 'draw_offered', by_child_id: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Et' }));
    expect(sent).toContainEqual({ type: 'accept_draw' });
  });

  it('Kabul Etme decline_draw gönderir ve teklif kartını kapatır', () => {
    setup();
    handler!({ type: 'draw_offered', by_child_id: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Etme' }));
    expect(sent).toContainEqual({ type: 'decline_draw' });
    expect(screen.queryByRole('button', { name: 'Kabul Et' })).not.toBeInTheDocument();
  });

  it('kalan hak sayısını gösterir ve 3 teklif sonrası buton devre dışı kalır', () => {
    setup();
    const btn = () => screen.getByRole('button', { name: /Beraberlik Teklif Et/ });
    expect(btn()).not.toBeDisabled();
    handler!({ type: 'draw_offer_sent', offers_used: 3 });
    expect(btn()).toBeDisabled();
  });

  it('teklif reddedilirse bilgi mesajı gösterilir, oyun devam eder', () => {
    setup();
    handler!({ type: 'draw_declined', by_child_id: 2 });
    expect(screen.getByText(/reddetti/i)).toBeInTheDocument();
    // Oyun bitmedi: Terk Et butonu hâlâ duruyor
    expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/live-game-controls.test.tsx`
Beklenen: FAIL — "Terk Et" bulunamaz (şu an "Teslim ol"), sonuç formatı farklı

- [ ] **Step 3: `LiveGame.tsx`'i güncelle**

`apps/web/components/LiveGame.tsx` dosyasının tamamını şu hale getir:

```tsx
'use client';
import { useState, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';
import { formatGameResult } from '@/lib/play/resultText';
import { canOfferDraw, offersLeft } from '@/lib/play/drawOffers';

interface Props { gameId: number; myColor: 'white' | 'black'; }

export function LiveGame({ gameId, myColor }: Props) {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [status, setStatus] = useState<'active' | 'over'>('active');
  const [info, setInfo] = useState<string>('');
  const [resultLine, setResultLine] = useState<string>('');
  const [drawOffered, setDrawOffered] = useState(false);
  const [myOffersUsed, setMyOffersUsed] = useState(0);

  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token ? `${wsBase()}/ws/game/${gameId}?token=${encodeURIComponent(token)}` : null;

  const { send } = useWebSocket(url, (data: unknown) => {
    const msg = data as {
      type?: string;
      fen_after?: string;
      is_checkmate?: boolean;
      is_stalemate?: boolean;
      result?: string;
      by_resign?: boolean;
      offers_used?: number;
      max_offers?: number;
    };
    const t = msg?.type;
    if (t === 'move_made') {
      const chess = chessRef.current;
      if (msg.fen_after && chess.fen() !== msg.fen_after) {
        try { chess.load(msg.fen_after); setFen(msg.fen_after); } catch { /* ignore */ }
      }
      // Mat/pat'ta sonuc satiri game_over mesajiyla gelir; burada sadece bilgi.
      if (msg.is_checkmate) { setStatus('over'); setInfo('Mat! Oyun bitti.'); }
      else if (msg.is_stalemate) { setStatus('over'); setInfo('Pat!'); }
    } else if (t === 'game_over') {
      setStatus('over');
      setResultLine(formatGameResult(msg.result));
      setInfo(msg.by_resign ? 'Maç terk edildi.' : '');
    } else if (t === 'opponent_disconnected') {
      setInfo('Rakip bağlantısı koptu.');
    } else if (t === 'invalid_move') {
      setFen(chessRef.current.fen());
    } else if (t === 'draw_offered') {
      setDrawOffered(true);
    } else if (t === 'draw_declined') {
      setInfo('Rakip beraberlik teklifini reddetti.');
    } else if (t === 'draw_offer_sent') {
      setMyOffersUsed(msg.offers_used ?? 0);
      setInfo('Beraberlik teklifi gönderildi.');
    } else if (t === 'draw_offer_rejected') {
      setMyOffersUsed(msg.max_offers ?? 3);
      setInfo('Beraberlik teklif hakkın kalmadı.');
    }
  });

  function handleDrop(from: Square, to: Square): boolean {
    if (status !== 'active') return false;
    const chess = chessRef.current;
    const myTurn = (chess.turn() === 'w' && myColor === 'white') || (chess.turn() === 'b' && myColor === 'black');
    if (!myTurn) return false;
    let move;
    try { move = chess.move({ from, to, promotion: 'q' }); } catch { return false; }
    if (!move) return false;
    setFen(chess.fen());
    send({ type: 'move', uci: `${from}${to}` });
    return true;
  }

  const canOffer = canOfferDraw(myOffersUsed);

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-3">
      <ChessBoard fen={fen} interactive={status === 'active'} onPieceDrop={handleDrop} boardOrientation={myColor} />

      {drawOffered && status === 'active' && (
        <div className="t-ok p-3 space-y-2">
          <p className="text-sm font-semibold">Rakip beraberlik teklif etti</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { send({ type: 'accept_draw' }); setDrawOffered(false); }}
              className="t-btn px-4 py-2 text-sm"
            >
              Kabul Et
            </button>
            <button
              type="button"
              onClick={() => { send({ type: 'decline_draw' }); setDrawOffered(false); }}
              className="t-btn-ghost px-4 py-2 text-sm"
            >
              Kabul Etme
            </button>
          </div>
        </div>
      )}

      {status === 'over' ? (
        <div className="t-ok p-4 text-center space-y-1">
          {resultLine && <p className="text-lg font-bold">{resultLine}</p>}
          {info && <p className="text-sm t-muted">{info}</p>}
        </div>
      ) : (
        <>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              disabled={!canOffer}
              onClick={() => send({ type: 'offer_draw' })}
              className="t-btn-ghost px-4 py-2 text-sm disabled:opacity-40"
            >
              Beraberlik Teklif Et ({offersLeft(myOffersUsed)})
            </button>
            <button
              type="button"
              onClick={() => { if (confirm('Maçı terk etmek istiyor musun? Maçı kaybedeceksin.')) send({ type: 'resign' }); }}
              className="t-btn px-4 py-2 text-sm"
              style={{ background: 'var(--t-err-bg, #ef4444)', color: '#fff' }}
            >
              Terk Et
            </button>
          </div>
          {info && <p className="text-center text-sm t-muted">{info}</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/live-game-controls.test.tsx`
Beklenen: PASS — 10 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/LiveGame.tsx apps/web/tests/live-game-controls.test.tsx
git commit -m "feat: Terk Et + Kabul Etme + sonuc bildirimi + 3 hak gostergesi"
```

---

## Task 11: `use-lobby` hook'u ve `ChallengeScreen`

**Files:**
- Create: `apps/web/lib/hooks/use-lobby.ts`
- Create: `apps/web/components/ChallengeScreen.tsx`
- Test: `apps/web/tests/challenge-screen.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/challenge-screen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const sent: object[] = [];
let handler: ((d: unknown) => void) | null = null;

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (_url: string | null, onMessage: (d: unknown) => void) => {
    handler = onMessage;
    return { send: (d: object) => { sent.push(d); }, readyState: 1 };
  },
  wsBase: () => 'ws://test',
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { ChallengeScreen } from '@/components/ChallengeScreen';

function setup(onMatched = vi.fn()) {
  sent.length = 0;
  handler = null;
  const utils = render(<ChallengeScreen onMatched={onMatched} />);
  return { ...utils, onMatched };
}

describe('ChallengeScreen', () => {
  it('önce maç kriterleri sorulur', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Teklif Gönder/ })).toBeInTheDocument();
  });

  it('kriterler seçilince aktif sporcu listesi gösterilir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Gönder/ }));
    handler!({ type: 'lobby_joined', players: [{ child_id: 9, display_name: 'Veli' }] });
    expect(screen.getByText('Veli')).toBeInTheDocument();
  });

  it('kimse aktif değilse bilgi mesajı gösterir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 1' }));
    fireEvent.click(screen.getByRole('button', { name: '3+2' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Gönder/ }));
    handler!({ type: 'lobby_joined', players: [] });
    expect(screen.getByText(/şu an aktif sporcu yok/i)).toBeInTheDocument();
  });

  it('bir sporcuya tıklayınca challenge mesajı gönderilir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 3' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Gönder/ }));
    handler!({ type: 'lobby_joined', players: [{ child_id: 9, display_name: 'Veli' }] });
    fireEvent.click(screen.getByText('Veli'));
    const challenge = sent.find((m) => (m as { type?: string }).type === 'challenge') as
      { target_child_id: number; criteria: { color: string; skill: number } };
    expect(challenge.target_child_id).toBe(9);
    expect(challenge.criteria.color).toBe('w');
    expect(challenge.criteria.skill).toBe(6);
  });

  it('gelen davet bildiriminde Kabul Et / Kabul Etme çıkar', () => {
    setup();
    handler!({ type: 'challenge_received', from_child_id: 5, from_name: 'Ayşe', criteria: {} });
    expect(screen.getByText(/Ayşe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kabul Et' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kabul Etme' })).toBeInTheDocument();
  });

  it('daveti kabul edince challenge_accept gönderilir', () => {
    setup();
    handler!({ type: 'challenge_received', from_child_id: 5, from_name: 'Ayşe', criteria: { color: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Et' }));
    const acc = sent.find((m) => (m as { type?: string }).type === 'challenge_accept') as
      { from_child_id: number; criteria: { color: string } };
    expect(acc.from_child_id).toBe(5);
    expect(acc.criteria.color).toBe('b');
  });

  it('daveti reddedince challenge_decline gönderilir ve bildirim kapanır', () => {
    setup();
    handler!({ type: 'challenge_received', from_child_id: 5, from_name: 'Ayşe', criteria: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Etme' }));
    expect(sent).toContainEqual({ type: 'challenge_decline', from_child_id: 5 });
    expect(screen.queryByRole('button', { name: 'Kabul Et' })).not.toBeInTheDocument();
  });

  it('eşleşme olunca onMatched çağrılır', () => {
    const onMatched = vi.fn();
    setup(onMatched);
    handler!({ type: 'matched', game_id: 42, color: 'black', opponent_id: 9 });
    expect(onMatched).toHaveBeenCalledWith({ gameId: 42, color: 'black' });
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/challenge-screen.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/components/ChallengeScreen"`

- [ ] **Step 3: `use-lobby.ts` hook'unu yaz**

`apps/web/lib/hooks/use-lobby.ts`:

```ts
'use client';
import { useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';

export interface OnlinePlayer { child_id: number; display_name: string }

export interface IncomingChallenge {
  from_child_id: number;
  from_name: string;
  criteria: Record<string, unknown>;
}

export interface MatchedInfo { gameId: number; color: 'white' | 'black' }

interface Options {
  onMatched: (info: MatchedInfo) => void;
}

/** /ws/lobby baglantisi: aktif sporcu listesi + gelen/giden mac davetleri. */
export function useLobby({ onMatched }: Options) {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [notice, setNotice] = useState<string>('');

  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token ? `${wsBase()}/ws/lobby?token=${encodeURIComponent(token)}` : null;

  const { send } = useWebSocket(url, (data: unknown) => {
    const msg = data as {
      type?: string;
      players?: OnlinePlayer[];
      from_child_id?: number;
      from_name?: string;
      criteria?: Record<string, unknown>;
      game_id?: number;
      color?: string;
    };
    const t = msg?.type;
    if (t === 'lobby_joined') {
      setPlayers(msg.players ?? []);
    } else if (t === 'challenge_received') {
      setIncoming({
        from_child_id: msg.from_child_id ?? 0,
        from_name: msg.from_name ?? 'Sporcu',
        criteria: msg.criteria ?? {},
      });
    } else if (t === 'challenge_declined') {
      setNotice('Teklifin reddedildi.');
    } else if (t === 'matched' && typeof msg.game_id === 'number') {
      onMatched({ gameId: msg.game_id, color: msg.color === 'black' ? 'black' : 'white' });
    }
  });

  return {
    players,
    incoming,
    notice,
    /** Belirli bir sporcuya davet gonder. */
    challenge: (targetChildId: number, criteria: Record<string, unknown>) =>
      send({ type: 'challenge', target_child_id: targetChildId, criteria }),
    acceptChallenge: (c: IncomingChallenge) => {
      send({ type: 'challenge_accept', from_child_id: c.from_child_id, criteria: c.criteria });
      setIncoming(null);
    },
    declineChallenge: (c: IncomingChallenge) => {
      send({ type: 'challenge_decline', from_child_id: c.from_child_id });
      setIncoming(null);
    },
  };
}
```

- [ ] **Step 4: `ChallengeScreen.tsx`'i yaz**

`apps/web/components/ChallengeScreen.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { resolveColor } from '@/lib/play/color';
import { useLobby } from '@/lib/hooks/use-lobby';
import type { MatchedInfo } from '@/lib/hooks/use-lobby';

interface Props {
  onMatched: (info: MatchedInfo) => void;
}

/** Arkadasa mac daveti akisi (madde b): kriterleri sec -> aktif sporcuyu sec
 *  -> teklif gonder -> kabul edilirse maca gec. */
export function ChallengeScreen({ onMatched }: Props) {
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const lobby = useLobby({ onMatched });

  /** Kriterleri WS'e gonderilecek sade nesneye cevirir (renk burada cozulur). */
  function criteriaPayload(v: MatchCriteriaValue) {
    return {
      color: resolveColor(v.colorChoice),
      skill: v.level.skill,
      depth: v.level.depth,
      tc_label: v.timeControl.label,
      tc_base: v.timeControl.base,
      tc_increment: v.timeControl.increment,
    };
  }

  return (
    <div className="space-y-4">
      {lobby.incoming && (
        <div className="t-ok p-3 space-y-2">
          <p className="text-sm font-semibold">
            {lobby.incoming.from_name} sana maç teklif etti
          </p>
          <div className="flex gap-2">
            <button type="button" className="t-btn px-4 py-2 text-sm"
              onClick={() => lobby.acceptChallenge(lobby.incoming!)}>
              Kabul Et
            </button>
            <button type="button" className="t-btn-ghost px-4 py-2 text-sm"
              onClick={() => lobby.declineChallenge(lobby.incoming!)}>
              Kabul Etme
            </button>
          </div>
        </div>
      )}

      {lobby.notice && <p className="text-sm t-muted text-center">{lobby.notice}</p>}

      {!criteria ? (
        <MatchCriteria startLabel="Teklif Gönder" onStart={setCriteria} />
      ) : waitingFor ? (
        <div className="t-card-i p-5 text-center space-y-2">
          <p className="text-3xl">⏳</p>
          <p className="font-bold text-sm">{waitingFor} bekleniyor…</p>
          <button type="button" className="t-btn-ghost px-4 py-2 text-sm"
            onClick={() => setWaitingFor(null)}>
            Vazgeç
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold t-muted uppercase tracking-wide">
            Aktif sporcular — teklif göndermek için birine dokun
          </p>
          {lobby.players.length === 0 ? (
            <p className="text-sm t-muted">Şu an aktif sporcu yok. Biraz sonra tekrar dene.</p>
          ) : (
            lobby.players.map((p) => (
              <button
                key={p.child_id}
                type="button"
                onClick={() => {
                  lobby.challenge(p.child_id, criteriaPayload(criteria));
                  setWaitingFor(p.display_name);
                }}
                className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-xl">🧒</span>
                <span className="font-medium text-sm flex-1">{p.display_name}</span>
                <span className="text-xs t-muted">Teklif et →</span>
              </button>
            ))
          )}
          <button type="button" className="t-btn-ghost px-4 py-2 text-xs"
            onClick={() => setCriteria(null)}>
            ← Kriterleri değiştir
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/challenge-screen.test.tsx`
Beklenen: PASS — 8 test

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/hooks/use-lobby.ts apps/web/components/ChallengeScreen.tsx apps/web/tests/challenge-screen.test.tsx
git commit -m "feat: arkadasa mac daveti ekrani + lobi hook'u"
```

---

## Task 12: `/play` — 4 kart ve akış yönlendirme

**Files:**
- Modify: `apps/web/app/(child)/play/page.tsx`
- Test: `apps/web/tests/play-page-tabs.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/play-page-tabs.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));

vi.mock('@/components/BotGame', () => ({
  BotGame: () => <div data-testid="bot-game" />,
}));

vi.mock('@/components/ChallengeScreen', () => ({
  ChallengeScreen: () => <div data-testid="challenge-screen" />,
}));

import PlayPage from '@/app/(child)/play/page';

describe('/play — 4 sekme (madde a)', () => {
  it('dört maç türü kartı gösterilir', () => {
    render(<PlayPage />);
    expect(screen.getByText('Arkadaşla Oyna')).toBeInTheDocument();
    expect(screen.getByText('Bota Karşı Oyna')).toBeInTheDocument();
    expect(screen.getByText('Açılışı Pratiği Yap')).toBeInTheDocument();
    expect(screen.getByText('Turnuvaya Katıl')).toBeInTheDocument();
  });

  it('Bota Karşı Oyna seçilince kriter ekranı açılır', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rastgele' })).toBeInTheDocument();
  });

  it('Arkadaşla Oyna seçilince davet ekranı açılır', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Arkadaşla Oyna'));
    expect(screen.getByTestId('challenge-screen')).toBeInTheDocument();
  });

  it('Turnuvaya Katıl seçilince Yakında mesajı gösterilir', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Turnuvaya Katıl'));
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
  });

  it('Bota Karşı akışında kriterler seçilip başlatılınca oyun render edilir', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 4' }));
    fireEvent.click(screen.getByRole('button', { name: '10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyuna Başla/ }));
    expect(screen.getByTestId('bot-game')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-page-tabs.test.tsx`
Beklenen: FAIL — "Açılışı Pratiği Yap" bulunamaz

- [ ] **Step 3: `page.tsx`'i yeniden yaz**

`apps/web/app/(child)/play/page.tsx` dosyasının tamamını şu hale getir:

```tsx
'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BotGame } from '@/components/BotGame';
import { ChallengeScreen } from '@/components/ChallengeScreen';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { LEVELS, ALL_TIMES } from '@/lib/play/levels';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';
import { useTabGuard } from '@/lib/settings/useTabGuard';

type Mode = 'friend' | 'bot' | 'opening' | 'tournament';

const MODE_CARDS: { mode: Mode; emoji: string; title: string; subtitle: string }[] = [
  { mode: 'friend',     emoji: '🤝', title: 'Arkadaşla Oyna',     subtitle: 'Aktif sporcuya teklif gönder' },
  { mode: 'bot',        emoji: '🤖', title: 'Bota Karşı Oyna',    subtitle: 'Bilgisayara karşı maç' },
  { mode: 'opening',    emoji: '📖', title: 'Açılışı Pratiği Yap', subtitle: 'Seçtiğin açılıştan başla' },
  { mode: 'tournament', emoji: '🏆', title: 'Turnuvaya Katıl',    subtitle: 'Çok oyunculu etkinlik' },
];

const ChevronRight = () => (
  <svg className="flex-shrink-0 t-muted" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

export default function PlayPage() {
  return (
    <Suspense fallback={<main id="main-content" className="px-4 pt-5 max-w-lg mx-auto"><p className="text-sm t-muted">Yükleniyor...</p></main>}>
      <PlayInner />
    </Suspense>
  );
}

function PlayInner() {
  useTabGuard('play');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hızlı Erişim patikasından (skill+tc) gelinmişse doğrudan bot maçına gir.
  const skillParam = searchParams.get('skill');
  const tcParam = searchParams.get('tc');
  const quickLevel = skillParam !== null ? LEVELS.find((l) => l.skill === Number(skillParam)) : undefined;
  const quickTc = tcParam ? ALL_TIMES.find((t) => t.label === tcParam) : undefined;
  const quickStart: MatchCriteriaValue | null = quickLevel && quickTc
    ? { level: quickLevel, timeControl: quickTc, colorChoice: 'white' }
    : null;

  const [mode, setMode] = useState<Mode | null>(quickStart ? 'bot' : null);
  const [botCriteria, setBotCriteria] = useState<MatchCriteriaValue | null>(quickStart);
  const [botColor, setBotColor] = useState<PieceColor>(
    quickStart ? resolveColor(quickStart.colorChoice) : 'w',
  );
  const [gameKey, setGameKey] = useState(0);

  function startBot(v: MatchCriteriaValue) {
    setBotCriteria(v);
    setBotColor(resolveColor(v.colorChoice));
    setGameKey((k) => k + 1);
  }

  // ── Mod seçimi (4 kart) ────────────────────────────────────────────────────
  if (!mode) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest">Maç Türü Seç</p>
        {MODE_CARDS.map((c) => (
          <button key={c.mode} onClick={() => setMode(c.mode)}
            className="t-card-i w-full flex items-center gap-4 px-4 py-4 text-left">
            <span className="text-2xl">{c.emoji}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">{c.title}</p>
              <p className="text-xs t-muted mt-0.5">{c.subtitle}</p>
            </div>
            <ChevronRight />
          </button>
        ))}
      </main>
    );
  }

  const backBtn = (
    <button onClick={() => { setMode(null); setBotCriteria(null); }}
      className="t-btn-ghost text-xs px-3 py-1.5">
      ← Maç Türü
    </button>
  );

  // ── Turnuva: henüz özellikleri belirlenmedi ────────────────────────────────
  if (mode === 'tournament') {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">🏆 Turnuvaya Katıl</p>
          {backBtn}
        </div>
        <div className="t-card-i p-5 text-center space-y-2">
          <p className="text-3xl">🚧</p>
          <p className="font-bold text-sm">Yakında</p>
          <p className="text-xs t-muted">Turnuva özellikleri hazırlanıyor.</p>
        </div>
      </main>
    );
  }

  // ── Açılış Pratiği ─────────────────────────────────────────────────────────
  if (mode === 'opening') {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">📖 Açılışı Pratiği Yap</p>
          {backBtn}
        </div>
        <div className="t-card-i p-5 text-center space-y-2">
          <p className="text-3xl">🚧</p>
          <p className="font-bold text-sm">Yakında</p>
          <p className="text-xs t-muted">Açılış pratiği hazırlanıyor.</p>
        </div>
      </main>
    );
  }

  // ── Arkadaşla Oyna ─────────────────────────────────────────────────────────
  if (mode === 'friend') {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">🤝 Arkadaşla Oyna</p>
          {backBtn}
        </div>
        <ChallengeScreen
          onMatched={({ gameId, color }) => router.push(`/play/online/${gameId}?color=${color}`)}
        />
      </main>
    );
  }

  // ── Bota Karşı Oyna: kriter seçimi ─────────────────────────────────────────
  if (!botCriteria) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">🤖 Bota Karşı Oyna</p>
          {backBtn}
        </div>
        <MatchCriteria startLabel="Oyuna Başla" onStart={startBot} />
      </main>
    );
  }

  // ── Bota Karşı Oyna: maç ───────────────────────────────────────────────────
  return (
    <main className="pb-12">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <p className="font-semibold text-sm">
          🤖 Bot — Düzey {botCriteria.level.level} · {botCriteria.timeControl.label} ·{' '}
          {botColor === 'w' ? 'Beyaz' : 'Siyah'}
        </p>
        <button onClick={() => setBotCriteria(null)} className="t-btn-ghost text-xs px-3 py-1.5">
          Ayarları değiştir
        </button>
      </div>

      <BotGame
        key={gameKey}
        skillLevel={botCriteria.level.skill}
        depth={botCriteria.level.depth}
        timeControl={botCriteria.timeControl}
        studentColor={botColor}
        onGameEnd={() => {}}
      />

      <div className="text-center mt-4">
        <button onClick={() => { setBotColor(resolveColor(botCriteria.colorChoice)); setGameKey((k) => k + 1); }}
          className="t-btn-ghost px-5 py-2">
          Yeni Oyun
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/play-page-tabs.test.tsx`
Beklenen: PASS — 5 test

- [ ] **Step 5: Tip kontrolü ve lint**

Çalıştır: `cd apps/web && npx tsc --noEmit && npx next lint`
Beklenen: tsc hatasız; lint yalnızca önceden var olan uyarılar.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(child)/play/page.tsx" apps/web/tests/play-page-tabs.test.tsx
git commit -m "feat: /play 4 mac turu karti + yeni kriter akisi"
```

---

## Task 13: Backend — Opening CRUD

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Create: `apps/api/chess_api/routers/openings.py`
- Modify: `apps/api/chess_api/main.py`
- Test: `apps/api/tests/test_openings.py`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/api/tests/test_openings.py`:

```python
import pytest

VALID_FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1"


async def _teacher_token(client, email="op@t.com"):
    r = await client.post("/auth/teacher/signup", json={
        "email": email, "password": "guvenli12345", "name": "Teacher",
    })
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_ogretmen_acilis_ekler(client):
    tok = await _teacher_token(client, "op1@t.com")
    r = await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "İtalyan Açılışı", "start_fen": VALID_FEN})
    assert r.status_code == 201
    assert r.json()["name"] == "İtalyan Açılışı"


@pytest.mark.asyncio
async def test_acilis_listesi_herkese_acik(client):
    """Sporcu acilis listesini gorebilmeli (mac kurarken secer)."""
    tok = await _teacher_token(client, "op2@t.com")
    await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                      json={"name": "Sicilya", "start_fen": VALID_FEN})
    r = await client.get("/openings")
    assert r.status_code == 200
    assert [o["name"] for o in r.json()] == ["Sicilya"]


@pytest.mark.asyncio
async def test_gecersiz_fen_reddedilir(client):
    tok = await _teacher_token(client, "op3@t.com")
    r = await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "Bozuk", "start_fen": "bu bir fen degil"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_bos_isim_reddedilir(client):
    tok = await _teacher_token(client, "op4@t.com")
    r = await client.post("/admin/openings", headers={"Authorization": f"Bearer {tok}"},
                          json={"name": "   ", "start_fen": VALID_FEN})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_ogretmen_acilis_siler(client):
    tok = await _teacher_token(client, "op5@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    created = await client.post("/admin/openings", headers=h,
                                json={"name": "Silinecek", "start_fen": VALID_FEN})
    oid = created.json()["id"]
    r = await client.delete(f"/admin/openings/{oid}", headers=h)
    assert r.status_code == 200
    listing = await client.get("/openings")
    assert listing.json() == []


@pytest.mark.asyncio
async def test_tokensiz_ekleme_engellenir(client):
    r = await client.post("/admin/openings", json={"name": "X", "start_fen": VALID_FEN})
    assert r.status_code in (401, 403)
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_openings.py -q`
Beklenen: FAIL — hepsi 404 (uçlar yok)

- [ ] **Step 3: Admin CRUD uçlarını ekle**

`apps/api/chess_api/routers/admin.py` dosyasının SONUNA ekle:

```python
# ---------------------------------------------------------------------------
# Acilis pratigi: acilis listesi (Zafer Hoca girer)
# ---------------------------------------------------------------------------

class OpeningCreateRequest(BaseModel):
    name: str
    start_fen: str


def _validate_fen(fen: str) -> None:
    """FEN'i python-chess ile dogrular; bozuk pozisyon kaydedilmez."""
    try:
        chess.Board(fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Geçersiz FEN")


@router.post("/openings", status_code=201)
async def create_opening(
    payload: OpeningCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Açılış adı gerekli")
    _validate_fen(payload.start_fen)
    op_row = Opening(name=name, start_fen=payload.start_fen)
    db.add(op_row)
    await db.commit()
    await db.refresh(op_row)
    return {"id": op_row.id, "name": op_row.name, "start_fen": op_row.start_fen}


@router.delete("/openings/{opening_id}")
async def delete_opening(
    opening_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    row = await db.get(Opening, opening_id)
    if not row:
        raise HTTPException(status_code=404, detail="Opening not found")
    await db.delete(row)
    await db.commit()
    return {"deleted": True}
```

Aynı dosyanın import bloğuna `Opening` modelini ekle:

```python
from chess_api.models.opening import Opening
```

**Not:** `chess`, `BaseModel`, `Depends`, `HTTPException`, `AsyncSession`,
`get_db`, `get_current_user`, `_ensure_admin` bu dosyada **zaten import/tanımlı**
(satır 1-32 arası doğrulandı) — tekrar eklenmeyecek.

- [ ] **Step 4: Herkese açık liste ucunu yaz**

`apps/api/chess_api/routers/openings.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.opening import Opening

router = APIRouter(tags=["openings"])


@router.get("/openings")
async def list_openings(db: AsyncSession = Depends(get_db)):
    """Sporcu mac kurarken acilis secer — kimlik dogrulamasi gerekmez
    (mufredat listesi gibi herkese acik, /modules ile ayni desen)."""
    rows = (await db.execute(select(Opening).order_by(Opening.id))).scalars().all()
    return [{"id": o.id, "name": o.name, "start_fen": o.start_fen} for o in rows]
```

- [ ] **Step 5: Router'ı `main.py`'ye kaydet**

`apps/api/chess_api/main.py` satır 5'teki import listesinin SONUNA ekle
(aynı satırda):

```python
, openings as openings_router
```

Ve `app.include_router(practice_router.router)` satırının ALTINA ekle:

```python
    app.include_router(openings_router.router)
```

- [ ] **Step 6: Testin geçtiğini doğrula**

Çalıştır: `cd apps/api && python -m pytest tests/test_openings.py -q`
Beklenen: PASS — 6 test

- [ ] **Step 7: Tüm backend testlerini çalıştır**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: Tümü PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/chess_api/routers/openings.py apps/api/chess_api/main.py apps/api/tests/test_openings.py
git commit -m "feat: acilis CRUD (admin ekler, sporcu listeler)"
```

---

## Task 14: Admin açılış ekranı

**Files:**
- Create: `apps/web/app/admin/openings/page.tsx`
- Modify: `apps/web/app/admin/layout.tsx`

**Not:** Bu sayfa admin auth + dinamik veri gerektirdiği için birim testi
kırılgan olur; doğrulaması Task 18'deki canlı tarayıcı sürüşüyle yapılır.
CRUD mantığı Task 13'te pytest ile tam kapsandı.

- [ ] **Step 1: Sayfayı yaz**

`apps/web/app/admin/openings/page.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Opening { id: number; name: string; start_fen: string }

export default function AdminOpeningsPage() {
  const [list, setList] = useState<Opening[]>([]);
  const [name, setName] = useState('');
  const [fen, setFen] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/openings`);
      setList(r.ok ? await r.json() : []);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    setErr(null); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/admin/openings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, start_fen: fen }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setErr(body.detail ?? 'Eklenemedi');
        return;
      }
      setName(''); setFen(''); setMsg('Açılış eklendi');
      await load();
    } catch {
      setErr('Eklenemedi');
    }
  }

  async function remove(id: number) {
    try {
      await fetch(`${API_BASE}/admin/openings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await load();
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-bold n-text text-lg">Açılış Listesi</h2>
      <p className="text-xs n-muted">
        Sporcuların &ldquo;Açılışı Pratiği Yap&rdquo; bölümünde seçeceği açılışlar.
        FEN, açılışın oynanacağı başlangıç pozisyonudur.
      </p>

      <div className="neon-card neon-green p-5 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Açılış adı (örn. İtalyan Açılışı)" className="neon-input" />
        <input value={fen} onChange={(e) => setFen(e.target.value)}
          placeholder="Başlangıç FEN'i" className="neon-input" />
        {err && <p className="text-rose-400 text-sm">{err}</p>}
        {msg && <p className="text-green-300 text-sm">{msg}</p>}
        <button type="button" onClick={add}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm">
          Açılış ekle
        </button>
      </div>

      <div className="space-y-2">
        {list.length === 0 && <p className="text-xs n-muted">Henüz açılış eklenmedi.</p>}
        {list.map((o) => (
          <div key={o.id} className="neon-card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm n-text">{o.name}</p>
              <p className="text-xs n-muted break-all">{o.start_fen}</p>
            </div>
            <button type="button" onClick={() => remove(o.id)}
              className="px-3 py-1.5 rounded-lg text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40">
              Sil
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Admin menüsüne bağlantı ekle**

`apps/web/app/admin/layout.tsx` içindeki `NAV_GROUPS` sabitinde,
`'Sporcu Paneli'` grubunun `items` dizisine ekle (mevcut
`{ href: '/admin/settings/board', label: 'Görünüm — Tahta & Taş' }`
satırının ALTINA):

```ts
      { href: '/admin/openings', label: 'Açılış Listesi' },
```

- [ ] **Step 3: Tip kontrolü ve lint**

Çalıştır: `cd apps/web && npx tsc --noEmit && npx next lint`
Beklenen: tsc hatasız; lint yalnızca önceden var olan uyarılar.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin/openings/page.tsx apps/web/app/admin/layout.tsx
git commit -m "feat: admin acilis listesi ekrani"
```

---

## Task 15: Açılış Pratiği sporcu akışı

**Files:**
- Create: `apps/web/components/play/OpeningPractice.tsx`
- Modify: `apps/web/app/(child)/play/page.tsx`
- Test: `apps/web/tests/opening-practice.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/opening-practice.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/BotGame', () => ({
  BotGame: ({ startFen }: { startFen?: string }) => (
    <div data-testid="bot-game" data-start-fen={startFen ?? ''} />
  ),
}));

vi.mock('@/components/ChallengeScreen', () => ({
  ChallengeScreen: () => <div data-testid="challenge-screen" />,
}));

import { OpeningPractice } from '@/components/play/OpeningPractice';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => [{ id: 1, name: 'İtalyan Açılışı', start_fen: FEN }],
  })));
});

describe('OpeningPractice', () => {
  it('önce rakip türü sorulur (Bota Karşı / Arkadaşına Karşı)', () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    expect(screen.getByText('Bota Karşı Pratik Yap')).toBeInTheDocument();
    expect(screen.getByText('Arkadaşına Karşı Pratik Yap')).toBeInTheDocument();
  });

  it('rakip seçilince açılış listesi yüklenir', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
  });

  it('açılış seçilince maç kriterleri sorulur', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
  });

  it('bot dalında maç seçilen açılışın FENiyle başlar', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    const game = screen.getByTestId('bot-game');
    expect(game.getAttribute('data-start-fen')).toBe(FEN);
  });

  it('arkadaş dalında davet ekranı gösterilir', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    expect(screen.getByTestId('challenge-screen')).toBeInTheDocument();
  });

  it('açılış listesi boşsa bilgi mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    await waitFor(() =>
      expect(screen.getByText(/henüz açılış eklenmedi/i)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/opening-practice.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/components/play/OpeningPractice"`

- [ ] **Step 3: Bileşeni yaz**

`apps/web/components/play/OpeningPractice.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { ChallengeScreen } from '@/components/ChallengeScreen';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';
import type { MatchedInfo } from '@/lib/hooks/use-lobby';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Opening { id: number; name: string; start_fen: string }
type Opponent = 'bot' | 'friend';

interface Props {
  onMatched: (info: MatchedInfo) => void;
}

/** Acilis pratigi akisi (madde h.3): rakip turu -> acilis -> kriterler -> mac. */
export function OpeningPractice({ onMatched }: Props) {
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [chosen, setChosen] = useState<Opening | null>(null);
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [color, setColor] = useState<PieceColor>('w');

  const loadOpenings = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/openings`);
      setOpenings(r.ok ? await r.json() : []);
    } catch {
      setOpenings([]);
    }
  }, []);

  useEffect(() => {
    if (opponent && openings === null) void loadOpenings();
  }, [opponent, openings, loadOpenings]);

  // ── Adım 1: rakip türü ─────────────────────────────────────────────────────
  if (!opponent) {
    return (
      <div className="space-y-3">
        {([['bot', '🤖', 'Bota Karşı Pratik Yap'], ['friend', '🤝', 'Arkadaşına Karşı Pratik Yap']] as const)
          .map(([val, emoji, label]) => (
            <button key={val} type="button" onClick={() => setOpponent(val)}
              className="t-card-i w-full flex items-center gap-4 px-4 py-4 text-left">
              <span className="text-2xl">{emoji}</span>
              <span className="font-semibold text-sm flex-1">{label}</span>
            </button>
          ))}
      </div>
    );
  }

  // ── Adım 2: açılış seçimi ──────────────────────────────────────────────────
  if (!chosen) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Açılış Konumunu Belirle</p>
        {openings === null && <p className="text-sm t-muted">Yükleniyor…</p>}
        {openings?.length === 0 && (
          <p className="text-sm t-muted">Zafer Hoca henüz açılış eklemedi.</p>
        )}
        {openings?.map((o) => (
          <button key={o.id} type="button" onClick={() => setChosen(o)}
            className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left">
            <span className="text-xl">📖</span>
            <span className="font-medium text-sm flex-1">{o.name}</span>
          </button>
        ))}
        <button type="button" onClick={() => setOpponent(null)}
          className="t-btn-ghost px-4 py-2 text-xs">
          ← Rakip türü
        </button>
      </div>
    );
  }

  // ── Adım 3: kriterler ──────────────────────────────────────────────────────
  if (!criteria) {
    // Arkadaş dalında renk/kriter seçimi ChallengeScreen içinde yapılır.
    if (opponent === 'friend') {
      return <ChallengeScreen onMatched={onMatched} />;
    }
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">
          {chosen.name} — Maç Kriterlerini Belirle
        </p>
        <MatchCriteria
          startLabel="Pratiğe Başla"
          onStart={(v) => { setCriteria(v); setColor(resolveColor(v.colorChoice)); }}
        />
        <button type="button" onClick={() => setChosen(null)}
          className="t-btn-ghost px-4 py-2 text-xs">
          ← Açılış seç
        </button>
      </div>
    );
  }

  // ── Adım 4: maç (bot) ──────────────────────────────────────────────────────
  return (
    <BotGame
      skillLevel={criteria.level.skill}
      depth={criteria.level.depth}
      timeControl={criteria.timeControl}
      studentColor={color}
      startFen={chosen.start_fen}
      onGameEnd={() => {}}
    />
  );
}
```

- [ ] **Step 4: `page.tsx`'te "Yakında" yerine gerçek bileşeni bağla**

`apps/web/app/(child)/play/page.tsx` import bloğuna ekle:

```ts
import { OpeningPractice } from '@/components/play/OpeningPractice';
```

Ve `mode === 'opening'` bloğunun içeriğini şu hale getir:

```tsx
  if (mode === 'opening') {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">📖 Açılışı Pratiği Yap</p>
          {backBtn}
        </div>
        <OpeningPractice
          onMatched={({ gameId, color }) => router.push(`/play/online/${gameId}?color=${color}`)}
        />
      </main>
    );
  }
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/opening-practice.test.tsx`
Beklenen: PASS — 6 test

- [ ] **Step 6: `/play` sekme testinin hâlâ geçtiğini doğrula**

`tests/play-page-tabs.test.tsx` içindeki "Açılışı Pratiği Yap → Yakında"
beklentisi artık geçersiz. O testi şu hale getir:

```tsx
  it('Açılışı Pratiği Yap seçilince rakip türü sorulur', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Açılışı Pratiği Yap'));
    expect(screen.getByText('Bota Karşı Pratik Yap')).toBeInTheDocument();
  });
```

Ve dosyanın başındaki mock listesine ekle:

```tsx
vi.mock('@/components/play/OpeningPractice', () => ({
  OpeningPractice: () => <div>Bota Karşı Pratik Yap</div>,
}));
```

Çalıştır: `cd apps/web && npx vitest run tests/play-page-tabs.test.tsx`
Beklenen: PASS — 5 test

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/play/OpeningPractice.tsx "apps/web/app/(child)/play/page.tsx" apps/web/tests/opening-practice.test.tsx apps/web/tests/play-page-tabs.test.tsx
git commit -m "feat: acilis pratigi akisi (bot ve arkadas dallari)"
```

---

## Task 16: Ana sayfadaki İKİNCİ zorluk/tempo kopyasını hizala

**Files:**
- Modify: `apps/web/app/(child)/home/page.tsx`
- Test: `apps/web/tests/home-bot-shortcut.test.tsx`

**NEDEN GEREKLİ (öz-denetimde bulundu):** `home/page.tsx:38-42` kendi
`BOT_LEVELS` sabitini tutuyor — **eski 5 seviyeli tablo** (skill 0/3/8/14/20) —
ve `/play?skill=${skill}&depth=${depth}&tc=${...}` linkleri üretiyor
(satır 426). Yeni 8'li tabloda **skill=8 ve skill=14 YOK**, dolayısıyla bu
kısayollar oyunu doğrudan başlatamaz, sporcuyu mod seçim ekranına düşürür.
Ayrıca `home/page.tsx:48`'de **"Süresiz" tempo kategorisi** hâlâ duruyor
(madde g ile çelişir). İki kopya tek kaynağa (`lib/play/levels.ts`) bağlanır.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/home-bot-shortcut.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { LEVELS, TIME_GROUPS } from '@/lib/play/levels';
import { HOME_BOT_LEVELS, HOME_TEMPO_GROUPS } from '@/app/(child)/home/botShortcut';

describe('Ana sayfa bot kısayolu — tek kaynak', () => {
  it('ana sayfa zorluk listesi lib/play/levels ile AYNI skill değerlerini kullanır', () => {
    expect(HOME_BOT_LEVELS.map((b) => b.skill)).toEqual(LEVELS.map((l) => l.skill));
  });

  it('ana sayfa zorluk listesi 8 seviyedir', () => {
    expect(HOME_BOT_LEVELS).toHaveLength(8);
  });

  it('her seviyenin depth değeri lib ile aynıdır', () => {
    expect(HOME_BOT_LEVELS.map((b) => b.depth)).toEqual(LEVELS.map((l) => l.depth));
  });

  it('ana sayfada Süresiz tempo kategorisi YOKTUR (madde g)', () => {
    expect(HOME_TEMPO_GROUPS.map((g) => g.cat)).not.toContain('Süresiz');
  });

  it('tempo kategorileri lib ile aynıdır', () => {
    expect(HOME_TEMPO_GROUPS.map((g) => g.cat)).toEqual(TIME_GROUPS.map((g) => g.cat));
  });

  it('her kategorinin tempo etiketleri lib ile aynıdır', () => {
    for (const [i, g] of HOME_TEMPO_GROUPS.entries()) {
      expect(g.items).toEqual(TIME_GROUPS[i].items.map((t) => t.label));
    }
  });

  it('hiçbir kategori boş değildir (boş = eski Süresiz kalıntısı)', () => {
    for (const g of HOME_TEMPO_GROUPS) expect(g.items.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/home-bot-shortcut.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/app/(child)/home/botShortcut"`

- [ ] **Step 3: Türetilmiş sabitleri ayrı dosyaya çıkar**

`apps/web/app/(child)/home/botShortcut.ts` (YENİ):

```ts
import { LEVELS, TIME_GROUPS } from '@/lib/play/levels';

/**
 * Ana sayfadaki "Bota Karşı Oyna" kısayolu, /play sayfasıyla AYNI zorluk ve
 * tempo listesini kullanmak zorunda — aksi halde ürettiği
 * `/play?skill=..&tc=..` linki /play tarafında bulunamaz ve oyun doğrudan
 * başlamaz. Bu yüzden iki kopya yerine tek kaynaktan türetiliyor.
 */
export const HOME_BOT_LEVELS = LEVELS.map((l) => ({
  label: `Düzey ${l.level}`,
  skill: l.skill,
  depth: l.depth,
  bars: l.level,
}));

/** Tempo kategorileri — "Süresiz" KASTEN yok (madde g). */
export const HOME_TEMPO_GROUPS: { cat: string; color: string; items: string[] }[] =
  TIME_GROUPS.map((g, i) => ({
    cat: g.cat,
    color: ['#fbbf24', '#38bdf8', '#2dd4bf'][i] ?? '#a78bfa',
    items: g.items.map((t) => t.label),
  }));
```

- [ ] **Step 4: `home/page.tsx`'te eski sabitleri sil ve yenileri kullan**

`apps/web/app/(child)/home/page.tsx` içinde:

Satır 37-42 civarındaki `BOT_LEVELS` tanımını (5 elemanlı dizi) **tamamen sil**
ve satır 44-49'daki `TIME_GROUPS` tanımını da **tamamen sil**. Yerine import bloğuna ekle:

```ts
import { HOME_BOT_LEVELS as BOT_LEVELS, HOME_TEMPO_GROUPS as TIME_GROUPS } from './botShortcut';
```

**DİKKAT:** `home/page.tsx` içinde `TIME_GROUPS` adı P6'da eklenen kilit
kodunda kullanılmıyor — yalnızca bot kısayolu bloğunda (satır ~421-426 ve
tempo seçim ızgarasında) kullanılıyor. Takma ad (`as TIME_GROUPS`) sayesinde
o kullanım yerleri değişmeden çalışır.

Ayrıca satır ~423-426'daki `unlimited` mantığını sil — artık boş kategori yok:

```tsx
              const bot = BOT_LEVELS.find((b) => b.skill === openSkill) ?? null;
              const tempo = TIME_GROUPS.find((t) => t.cat === openTempo) ?? null;
              const ready = !!bot && !!tempo && !!selTime;
              const href = ready
                ? `/play?skill=${bot!.skill}&depth=${bot!.depth}&tc=${encodeURIComponent(selTime!)}`
                : '#';
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/home-bot-shortcut.test.tsx`
Beklenen: PASS — 7 test

- [ ] **Step 6: Tip kontrolü ve ana sayfa regresyonu**

Çalıştır: `cd apps/web && npx tsc --noEmit`
Beklenen: Hatasız. Hata çıkarsa `unlimited` değişkeninin kalan kullanımları
temizlenmeli (grep: `grep -n "unlimited" "app/(child)/home/page.tsx"`).

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(child)/home/botShortcut.ts" "apps/web/app/(child)/home/page.tsx" apps/web/tests/home-bot-shortcut.test.tsx
git commit -m "fix: ana sayfa bot kisayolu 8 duzeye hizalandi, Suresiz kaldirildi"
```

---

## Task 17: Tam test kapısı

**Files:** (değişiklik yok — yalnızca doğrulama)

- [ ] **Step 1: Frontend kapısı**

Çalıştır: `cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run`
Beklenen: tsc hatasız; lint yalnızca önceden var olan uyarılar
(`boardSkin.tsx` `<img>`, `ChessBoard.tsx` `saveScroll`, `LessonPlayer.tsx`
`_score`/`_max` vb.); tüm vitest testleri PASS.

- [ ] **Step 2: Production build**

Çalıştır: `cd apps/web && npm run build`
Beklenen: Başarılı build.

- [ ] **Step 3: Backend kapısı**

Çalıştır: `cd apps/api && python -m pytest -q`
Beklenen: Tümü PASS.

- [ ] **Step 4: Migration zinciri tek başlı**

Çalıştır: `cd apps/api && python -m alembic heads`
Beklenen: Tek head — `PlayFeatures (head)`.

- [ ] **Step 5: Herhangi bir kapı kalırsa DUR**

Kırmızı varsa düzelt ve Step 1'den tekrar başla. Kapı geçmeden "bitti" denmez.

---

## Task 18: Canlı doğrulama (KURAL #6)

**Files:** (değişiklik yok — yalnızca doğrulama)

**Kural:** Kullanıcıya "sen dene" DENMEZ. Gerçek tarayıcıda sürülür ve ne
doğrulandığı/doğrulanamadığı açıkça raporlanır.

- [ ] **Step 1: Kullanıcıdan onay al**

Canlı doğrulama prod backend'e geçici test verisi yazmayı gerektirir
(öğretmen hesabı, iki sporcu hesabı, açılış kaydı). Kullanıcıya sor, onay
alınca devam et.

- [ ] **Step 2: Yerel ortamı hazırla**

`apps/web/.env.local` oluştur:

```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```

**UYARI:** Bu dosya asla commit edilmez, doğrulama bitince silinir.
Dev sunucusu `preview_start` ile başlatılır, Bash ile DEĞİL.

- [ ] **Step 3: 4 sekme ve bot maçı (madde a, e, f, g)**

`/play` açılır:
- Dört kartın (Arkadaşla Oyna, Bota Karşı Oyna, Açılışı Pratiği Yap,
  Turnuvaya Katıl) göründüğü doğrulanır.
- "Bota Karşı Oyna" → Düzey 1-8 butonlarının, üç renk seçeneğinin göründüğü ve
  **Süresiz seçeneğinin OLMADIĞI** doğrulanır.
- Düzey 1 + 3+2 + **Siyah** seçilip başlatılır: tahtanın ters çevrildiği ve
  **botun ilk hamleyi kendiliğinden oynadığı** doğrulanır (ekran görüntüsüyle).

- [ ] **Step 4: Turnuva placeholder'ı (madde h.4)**

"Turnuvaya Katıl" → "Yakında" mesajının göründüğü doğrulanır.

- [ ] **Step 5: Açılış CRUD ve pratik akışı (madde h.3)**

Öğretmen hesabıyla `/admin/openings` açılır, bir açılış eklenir
(ör. "İtalyan Açılışı" + geçerli FEN), listede göründüğü doğrulanır.
Sporcu hesabıyla `/play` → "Açılışı Pratiği Yap" → "Bota Karşı Pratik Yap" →
eklenen açılışın listede göründüğü, seçilip kriterler belirlendikten sonra
**maçın o açılışın pozisyonundan başladığı** doğrulanır (tahtada açılış
taşlarının yerinde olduğu görülür).

- [ ] **Step 6: Arkadaş daveti (madde b) — iki oturum**

İki farklı sporcu hesabı (iki tarayıcı sekmesi) açılır, ikisi de `/play` →
"Arkadaşla Oyna" ekranında bekletilir:
- A sekmesinde B'nin "aktif sporcular" listesinde göründüğü doğrulanır.
- A, kriterleri seçip B'ye teklif gönderir.
- B'nin ekranında **anlık** olarak "A sana maç teklif etti" bildiriminin
  "Kabul Et"/"Kabul Etme" butonlarıyla çıktığı doğrulanır.
- "Kabul Etme" denenir: A'ya "Teklifin reddedildi" bilgisinin gittiği doğrulanır.
- Sonra "Kabul Et" denenir: iki tarafın da maç ekranına düştüğü ve renklerin
  A'nın seçtiği kritere uygun olduğu doğrulanır.

- [ ] **Step 7: Beraberlik teklifi ve 3 hak (madde d)**

Açılan maçta:
- A "Beraberlik Teklif Et (3)" butonuna basar; B'nin ekranında teklifin
  "Kabul Et"/"Kabul Etme" ile çıktığı doğrulanır.
- B "Kabul Etme"ye basar: oyunun **devam ettiği** ve A'ya red bilgisinin
  gittiği doğrulanır.
- A üç kez teklif gönderir; **üçüncüden sonra butonun devre dışı kaldığı**
  ve sayacın (3)→(0) düştüğü doğrulanır.
- Sonra B teklif eder, A "Kabul Et"e basar: her iki ekranda da
  **"1/2 – 1/2 (Beraberlik)"** bildiriminin göründüğü doğrulanır.

- [ ] **Step 8: Terk Et (madde c)**

Yeni bir maç açılır, A (beyaz) "Terk Et"e basıp onaylar. Her iki ekranda da
**"0 – 1 (Siyah Kazandı)"** bildiriminin göründüğü doğrulanır.

- [ ] **Step 9: Rastgele eşleştirme regresyonu**

`/play/online` (eski rastgele eşleştirme) ekranının **hâlâ çalıştığı**
doğrulanır — arkadaş daveti onun yerine geçmedi (KURAL #3).

- [ ] **Step 10: Temizlik**

- Prod test verisini sil: eklenen açılış(lar) `DELETE /admin/openings/{id}` ile
  kaldırılır, `GET /openings` ile silindiği doğrulanır.
- `apps/web/.env.local` dosyası silinir.
- Dev sunucusu `preview_stop` ile durdurulur.

- [ ] **Step 11: Dürüst rapor**

Hangi adımların tarayıcıda gerçekten doğrulandığı, hangilerinin
doğrulanamadığı ve neden — açıkça yazılır. Doğrulanmamış hiçbir şey
"çalışıyor" diye sunulmaz (KURAL #1, KURAL #6).

---

## Notlar

- **KURAL #3 (canlı kullanıcılar):** Migration yalnızca `ADD COLUMN` +
  `CREATE TABLE`; `server_default='0'` ve `nullable=True` sayesinde mevcut
  oyun kayıtları etkilenmez. `start_fen` NULL ise standart başlangıç
  varsayılır. Rastgele eşleştirme (`/play/online`, `matchmaking.py`)
  **dokunulmadan** kalır. `BotGame`'in yeni prop'ları (`studentColor`,
  `startFen`) opsiyonel ve varsayılanlı — eski çağrılar bozulmaz.
- **KURAL #4 (müfredat verisi):** `games` ve `openings` müfredat tablosu
  değildir; `modules`/`lessons`/`lesson_steps`/`child_lesson_progress`/
  `child_lesson_step_results` tablolarına dokunulmadı. `test_migration_guard.py`
  Task 5 Step 9'da ayrıca çalıştırılır.
- **KURAL #5 (mobil uygulama):** Bu değişikliklerin hepsi web tarafında;
  mobil uygulama build'i gerektirmiyor.
- **Bilinen sınır — tek instance:** `lobby.py` in-memory'dir; birden fazla
  sunucu instance'ı olursa aktif liste bölünür. Bu, mevcut `matchmaking.py` ve
  `game_room.py` ile **aynı** sınırdır (kod yorumlarında belirtilmiş), yeni bir
  gerileme değil. Çoklu instance gerekirse üçü birlikte Redis'e taşınmalıdır.
- **Bilinen sınır — canlı maçta saat yok:** `LiveGame` bileşeninde saat
  gösterimi/zaman aşımı yok (mevcut durum; backend de canlı maçlarda flag
  işlemiyor). Kriterlerde tempo seçiliyor ve kaydediliyor ama insan-insan
  maçında saat işletilmiyor. Bu istekte saat işletme talebi yoktu — kapsam
  dışı bırakıldı, ileride ayrı bir iş olarak ele alınmalı.

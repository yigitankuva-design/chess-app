# Bot Zorluk — 10 Seviye Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bota karşı oynamada 8 sabit seviye yerine, 400-2200+ Elo aralığını kapsayan
10 seviyelik yeni bir sistem kurmak; alt 5 seviyede motor "kasıtlı hata" yaparak
gerçekten kolay oynasın.

**Architecture:** Yeni bir saf mantık dosyası (`blunder.ts`) hata yapıp yapmama
kararını verir. `stockfish.ts`'e Stockfish'in MultiPV özelliğini kullanan yeni bir
metod (`bestMoveCandidates`) eklenir — birden fazla aday hamle döner. `BotGame.tsx`
seviyenin hata ihtimaline göre ya tek en iyi hamleyi ya da adaylar arasından rastgele
zayıf birini oynar. `levels.ts`'teki `LEVELS` dizisi 8'den 10'a çıkar, her seviyeye
`blunderChance` alanı eklenir.

**Tech Stack:** TypeScript, React, Vitest + Testing Library, Stockfish (WASM, tarayıcı
worker'ı, `public/stockfish/stockfish.js`).

---

## Ön Doğrulama (kod yazmadan önce)

Bu motor derlemesinin (`public/stockfish/stockfish.js`) `setoption name MultiPV` UCI
seçeneğini gerçekten kabul ettiği zaten statik olarak doğrulandı (dosyada literal
`"setoption name MultiPV value "` metni bulundu). Ancak arama çıktısının gerçekten
`multipv N ... pv <hamle>` biçiminde birden fazla satır ürettiği CANLI TARAYICIDA
doğrulanmadı — bu, Task 8'de (canlı doğrulama) ilk kontrol edilecek şey olacak. Eğer
çalışmazsa, Task 2'deki `bestMoveCandidates` yerine yedek yöntem (adayları aramadan,
düşük derinlik + geniş rastgelelik) tasarlanıp kullanıcıya haber verilecek.

---

### Task 1: `blunder.ts` — saf hata-karar mantığı

**Files:**
- Create: `apps/web/lib/play/blunder.ts`
- Test: `apps/web/tests/blunder.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { shouldBlunder, pickBlunderMove } from '@/lib/play/blunder';

describe('blunder', () => {
  it('shouldBlunder: random ihtimalden küçükse true döner', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(shouldBlunder(0.5)).toBe(true);
    vi.restoreAllMocks();
  });

  it('shouldBlunder: random ihtimalden büyükse false döner', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(shouldBlunder(0.5)).toBe(false);
    vi.restoreAllMocks();
  });

  it('shouldBlunder: ihtimal 0 iken her zaman false', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(shouldBlunder(0)).toBe(false);
    vi.restoreAllMocks();
  });

  it('pickBlunderMove: tek aday varsa onu döner', () => {
    expect(pickBlunderMove(['e2e4'])).toBe('e2e4');
  });

  it('pickBlunderMove: en iyi adayı (0. sıra) HİÇ seçmez', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const picked = pickBlunderMove(['e2e4', 'd2d4', 'g1f3']);
    expect(picked).not.toBe('e2e4');
    expect(['d2d4', 'g1f3']).toContain(picked);
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/blunder.test.ts`
Expected: FAIL — modül bulunamadı

- [ ] **Step 3: Uygula**

```typescript
/** Belirli bir ihtimalle bot kasıtlı zayıf hamle yapsın mı? (0 = asla, 1 = her zaman) */
export function shouldBlunder(chance: number): boolean {
  return Math.random() < chance;
}

/**
 * Aday hamleler arasından (0. sıradaki en iyisi HARİÇ) rastgele birini seçer.
 * Tek aday varsa (alternatif bulunamadıysa) onu döner.
 */
export function pickBlunderMove(candidates: string[]): string {
  if (candidates.length <= 1) return candidates[0];
  const worse = candidates.slice(1);
  return worse[Math.floor(Math.random() * worse.length)];
}
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/blunder.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/blunder.ts apps/web/tests/blunder.test.ts
git commit -m "feat: blunder.ts — kasıtlı hata karar mantığı"
```

---

### Task 2: `stockfish.ts` — `bestMoveCandidates` (MultiPV)

**Files:**
- Modify: `apps/web/lib/chess/stockfish.ts`
- Test: `apps/web/tests/stockfish-candidates.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

Gerçek `Worker` jsdom'da yok — testte sahte bir Worker sınıfı kurulup `global.Worker`'a
atanacak. Sahte worker, `go depth` komutunu alınca birkaç `info ... multipv N ... pv ...`
satırı ve ardından `bestmove` satırı "gönderir" (senkron, `onmessage` çağrısıyla).

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StockfishEngine } from '@/lib/chess/stockfish';

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(cmd: string) {
    if (cmd === 'uci' || cmd === 'isready') return;
    if (cmd.startsWith('go depth')) {
      const lines = [
        'info depth 8 multipv 1 score cp 40 pv e2e4 e7e5',
        'info depth 8 multipv 2 score cp 20 pv d2d4 d7d5',
        'info depth 8 multipv 3 score cp -10 pv g1f3 g8f6',
        'bestmove e2e4',
      ];
      for (const line of lines) this.onmessage?.({ data: line } as MessageEvent);
    }
  }
  terminate() {}
}

beforeEach(() => {
  vi.stubGlobal('Worker', FakeWorker);
});

describe('StockfishEngine.bestMoveCandidates', () => {
  it('multipv sırasına göre aday hamle listesi döner', async () => {
    const eng = new StockfishEngine();
    await eng.init();
    const candidates = await eng.bestMoveCandidates('startpos', 8, 3);
    expect(candidates).toEqual(['e2e4', 'd2d4', 'g1f3']);
  });
});
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/stockfish-candidates.test.ts`
Expected: FAIL — `bestMoveCandidates` tanımlı değil

- [ ] **Step 3: `bestMoveCandidates`'i `StockfishEngine` sınıfına ekle**

`apps/web/lib/chess/stockfish.ts` içinde `bestMove` metodundan hemen sonra:

```typescript
  /**
   * Stockfish'in MultiPV özelliğiyle birden fazla aday hamle ister.
   * Dönen dizi güç sırasına göredir (0. indeks = en iyi hamle).
   * Kasıtlı hata (blunder) mekanizması için kullanılır — bkz. lib/play/blunder.ts.
   */
  async bestMoveCandidates(fen: string, depth = 8, multiPv = 4): Promise<string[]> {
    return new Promise((resolve) => {
      const candidates = new Map<number, string>();
      const listener = (line: string) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          const mpvMatch = line.match(/multipv (\d+)/);
          const pvMatch = line.match(/ pv (\S+)/);
          if (mpvMatch && pvMatch) {
            candidates.set(Number(mpvMatch[1]), pvMatch[1]);
          }
        } else if (line.startsWith('bestmove')) {
          this.listeners = this.listeners.filter((l) => l !== listener);
          this.send('setoption name MultiPV value 1');
          const ordered = Array.from(candidates.keys())
            .sort((a, b) => a - b)
            .map((k) => candidates.get(k)!);
          if (ordered.length > 0) {
            resolve(ordered);
          } else {
            const mv = line.split(' ')[1];
            resolve(mv && mv !== '(none)' ? [mv] : []);
          }
        }
      };
      this.listeners.push(listener);
      this.send(`setoption name MultiPV value ${multiPv}`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/stockfish-candidates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/chess/stockfish.ts apps/web/tests/stockfish-candidates.test.ts
git commit -m "feat: StockfishEngine.bestMoveCandidates — MultiPV aday hamle listesi"
```

---

### Task 3: `levels.ts` — 10 seviyelik tablo

**Files:**
- Modify: `apps/web/lib/play/levels.ts:1-26`
- Modify: `apps/web/tests/play-levels.test.ts`

- [ ] **Step 1: Testi güncelle (RED önce)**

`apps/web/tests/play-levels.test.ts` içindeki `describe('LEVELS', ...)` bloğunu
TAMAMEN değiştir:

```typescript
describe('LEVELS', () => {
  it('tam 10 seviye vardır', () => expect(LEVELS).toHaveLength(10));

  it('seviye numaraları 1..10 sıralıdır', () => {
    expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('skill_level 0..20 aralığındadır', () => {
    const skills = LEVELS.map((l) => l.skill);
    for (const s of skills) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(20);
    }
  });

  it('1-5. seviyelerde hata ihtimali VAR ve azalan sıradadır', () => {
    const chances = LEVELS.slice(0, 5).map((l) => l.blunderChance);
    expect(chances).toEqual([0.6, 0.45, 0.3, 0.15, 0.05]);
    for (let i = 1; i < chances.length; i++) expect(chances[i]).toBeLessThan(chances[i - 1]);
  });

  it('6-10. seviyelerde hata ihtimali YOKTUR (0)', () => {
    const chances = LEVELS.slice(5).map((l) => l.blunderChance);
    expect(chances).toEqual([0, 0, 0, 0, 0]);
  });

  it('6-10. seviyelerde skill artan sıradadır', () => {
    const skills = LEVELS.slice(5).map((l) => l.skill);
    for (let i = 1; i < skills.length; i++) expect(skills[i]).toBeGreaterThan(skills[i - 1]);
  });
});
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/play-levels.test.ts`
Expected: FAIL — 8 seviye var, `blunderChance` alanı yok

- [ ] **Step 3: `levels.ts`'i güncelle**

```typescript
import type { TimeControl } from '@/components/BotGame';

export interface PlayLevel {
  /** Sporcuya gösterilen düzey numarası (1 en kolay, 10 en zor). */
  level: number;
  /** Stockfish skill level (0-20) — backend de bu aralığı doğruluyor. */
  skill: number;
  /** Stockfish arama derinliği. */
  depth: number;
  /**
   * 0-1 arası: botun kasıtlı zayıf hamle yapma ihtimali (bkz. lib/play/blunder.ts).
   * 0 = hiç blunder yapmaz (Stockfish'in kendi gücüyle oynar).
   * Stockfish'in en düşük ayarı bile (skill 0) ~1320 Elo olduğu için, 1300 Elo
   * ALTINDAKİ seviyeler (1-5) bu mekanizma OLMADAN yapılamaz.
   */
  blunderChance: number;
}

/**
 * 10 zorluk düzeyi, ~400 Elo'dan 2200+ Elo'ya kadar (madde Zafer hoca kararı,
 * 2026-08-09). 1-5. seviyeler kasıtlı hata mekanizmasıyla, 6-10. seviyeler
 * motorun kendi skill/depth ayarıyla çalışır. 6-10. seviyelerin Elo karşılığı
 * TAHMİNİDİR — Stockfish skill 0 dışındaki seviyelerin Elo karşılığı resmi
 * olarak belgeli değildir (bkz. tasarım dosyası).
 */
export const LEVELS: PlayLevel[] = [
  { level: 1,  skill: 20, depth: 6,  blunderChance: 0.60 }, // ~400-600
  { level: 2,  skill: 20, depth: 6,  blunderChance: 0.45 }, // ~600-800
  { level: 3,  skill: 20, depth: 6,  blunderChance: 0.30 }, // ~800-1000
  { level: 4,  skill: 20, depth: 6,  blunderChance: 0.15 }, // ~1000-1200
  { level: 5,  skill: 20, depth: 6,  blunderChance: 0.05 }, // ~1200-1400
  { level: 6,  skill: 10, depth: 8,  blunderChance: 0 },    // ~1400-1600 (tahmini)
  { level: 7,  skill: 13, depth: 9,  blunderChance: 0 },    // ~1600-1800 (tahmini)
  { level: 8,  skill: 16, depth: 10, blunderChance: 0 },    // ~1800-2000 (tahmini)
  { level: 9,  skill: 18, depth: 11, blunderChance: 0 },    // ~2000-2200 (tahmini)
  { level: 10, skill: 20, depth: 12, blunderChance: 0 },    // 2200+ (tahmini)
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

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/play-levels.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/levels.ts apps/web/tests/play-levels.test.ts
git commit -m "feat: levels.ts — 10 seviyelik zorluk tablosu (blunderChance ile)"
```

---

### Task 4: `MatchCriteria`/`match-criteria-rows` testlerini 10'a güncelle

**Files:**
- Modify: `apps/web/tests/match-criteria.test.tsx:6-11`
- Modify: `apps/web/tests/match-criteria-rows.test.tsx:6-12`

Bileşenin kendisi (`apps/web/components/play/MatchCriteria.tsx`) `LEVELS.map(...)`
kullandığı için KOD DEĞİŞİKLİĞİ GEREKMİYOR — sadece testler 8 yerine 10 seviyeyi
beklemeli.

- [ ] **Step 1: `match-criteria.test.tsx` — "8 zorluk düzeyi" testini güncelle**

```typescript
  it('10 zorluk düzeyi butonu gösterir', () => {
    render(<MatchCriteria onStart={vi.fn()} startLabel="Oyuna Başla" />);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(screen.getByRole('button', { name: `Düzey ${n}` })).toBeInTheDocument();
    }
  });
```

- [ ] **Step 2: `match-criteria-rows.test.tsx` — "1. sırada 8 dairesel..." testini güncelle**

```typescript
  it('1. sırada 10 dairesel düzey kartı vardır, üzerlerinde sadece rakam', () => {
    render(<MatchCriteria startLabel="Maça Başla" onStart={vi.fn()} />);
    for (let n = 1; n <= 10; n++) {
      const btn = screen.getByRole('button', { name: `Düzey ${n}` });
      expect(btn).toHaveTextContent(String(n));
    }
  });
```

- [ ] **Step 3: Testleri çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/match-criteria.test.tsx tests/match-criteria-rows.test.tsx`
Expected: PASS (LEVELS zaten 10 öğeli olduğu için bileşen otomatik 10 buton basar)

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/match-criteria.test.tsx apps/web/tests/match-criteria-rows.test.tsx
git commit -m "test: MatchCriteria testleri 10 seviyeye güncellendi"
```

---

### Task 5: `BotGame.tsx` — blunder mekanizmasının bağlanması

**Files:**
- Modify: `apps/web/components/BotGame.tsx`
- Test: `apps/web/tests/bot-game-blunder.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
const bestMoveCandidates = vi.fn().mockResolvedValue(['e2e4', 'd2d4', 'g1f3']);
const bestMove = vi.fn().mockResolvedValue('(none)');
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove(...args: unknown[]) { return bestMove(...args); }
    async bestMoveCandidates(...args: unknown[]) { return bestMoveCandidates(...args); }
    destroy() {}
  },
}));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok', getAthleteName: () => 'Ahmet' }));
vi.mock('@/lib/avatars', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatars')>('@/lib/avatars');
  return { ...actual, getSavedAvatar: () => 'unicorn' };
});
vi.mock('@/lib/play/blunder', () => ({
  shouldBlunder: vi.fn(() => true),
  pickBlunderMove: vi.fn((c: string[]) => c[1]),
}));

import { BotGame } from '@/components/BotGame';

describe('BotGame — blunder mekanizması', () => {
  beforeEach(() => {
    sessionStorage.clear();
    bestMove.mockClear();
    bestMoveCandidates.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ game_id: 1 }) }));
  });

  it('blunderChance > 0 iken bestMoveCandidates çağrılır, bestMove ÇAĞRILMAZ', async () => {
    render(
      <BotGame skillLevel={20} depth={6} studentColor="w" blunderChance={0.6} onGameEnd={() => {}} />,
    );
    await screen.findByTestId('board');
    await waitFor(() => expect(bestMoveCandidates).toHaveBeenCalled());
    expect(bestMove).not.toHaveBeenCalled();
  });

  it('blunderChance verilmezse (0) eski bestMove akışı çalışır', async () => {
    render(<BotGame skillLevel={5} depth={5} studentColor="w" onGameEnd={() => {}} />);
    await screen.findByTestId('board');
    await waitFor(() => expect(bestMove).toHaveBeenCalled());
    expect(bestMoveCandidates).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/bot-game-blunder.test.tsx`
Expected: FAIL — `blunderChance` prop'u yok, her zaman `bestMove` çağrılıyor

- [ ] **Step 3: `BotGame.tsx`'i güncelle**

Props arayüzüne ekle (`apps/web/components/BotGame.tsx:33-44` civarı):

```typescript
interface Props {
  skillLevel: number;
  depth: number;
  timeControl?: TimeControl | null;
  studentColor?: 'w' | 'b';
  startFen?: string;
  /** 0-1 arası: botun kasıtlı zayıf hamle yapma ihtimali. Verilmezse/0 ise eski davranış. */
  blunderChance?: number;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
  onRematch?: () => void;
  practiceActions?: {
    onPlaySame: () => void;
    onPlayDifferent: () => void;
  };
}
```

İçe aktarma satırına ekle:

```typescript
import { shouldBlunder, pickBlunderMove } from '@/lib/play/blunder';
```

Fonksiyon imzasına `blunderChance = 0` ekle:

```typescript
export function BotGame({
  skillLevel, depth, timeControl, studentColor = 'w', startFen, blunderChance = 0,
  onGameEnd, onRematch, practiceActions,
}: Props) {
```

`engineRef` tanımından sonra (bileşenin gövdesinde, `applyStudentMove`'dan ÖNCE bir yere)
yeni bir yardımcı fonksiyon ekle:

```typescript
  /** Botun bu hamlede oynayacağı UCI hamleyi getirir — blunder mekanizması dahil. */
  async function pickBotMove(fen: string): Promise<string | undefined> {
    const eng = engineRef.current!;
    if (blunderChance > 0) {
      const candidates = await eng.bestMoveCandidates(fen, depth, 4);
      if (candidates.length === 0) return undefined;
      return shouldBlunder(blunderChance) ? pickBlunderMove(candidates) : candidates[0];
    }
    const mv = await eng.bestMove(fen, depth);
    return mv && mv !== '(none)' ? mv : undefined;
  }
```

İki çağrı noktasını değiştir. Birincisi (bot ilk hamleyi oynarken, init effect içinde,
`apps/web/components/BotGame.tsx:148-163` civarı):

```typescript
      if (!cancelled && movesRef.current.length === 0 && chessRef.current.turn() === botColor) {
        setThinking(true);
        try {
          const uci = await pickBotMove(chessRef.current.fen());
          if (uci) {
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

İkincisi (`applyStudentMove` içinde bot cevap verirken, `apps/web/components/BotGame.tsx:286-303`
civarı):

```typescript
      setThinking(true);
      const botUci = await pickBotMove(chess.fen());
      if (botUci) {
        try {
          chess.move({
            from: botUci.slice(0, 2) as Square,
            to: botUci.slice(2, 4) as Square,
            promotion: promotionFromUci(botUci),
          });
          setFen(chess.fen());
          playMoveSound();
          if (tc) {
            if (botColor === 'w') setWhiteTime((t) => t + tc.increment);
            else setBlackTime((t) => t + tc.increment);
          }
          await persistMove(botUci);
        } catch { /* ignore */ }
      }
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/bot-game-blunder.test.tsx`
Expected: PASS (2 test)

- [ ] **Step 5: Mevcut BotGame testlerini çalıştır (regresyon)**

Run: `cd apps/web && npx vitest run -t "BotGame"`
Expected: hepsi PASS (blunderChance varsayılan 0 olduğu için eski davranış korunuyor)

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/BotGame.tsx apps/web/tests/bot-game-blunder.test.tsx
git commit -m "feat: BotGame — blunderChance mekanizması bağlandı"
```

---

### Task 6: Çağıran bileşenler — `blunderChance` geçişi

**Files:**
- Modify: `apps/web/components/play/OpeningPractice.tsx:66-76`
- Modify: `apps/web/components/play/PositionPoolPractice.tsx` (BotGame çağrısı)
- Modify: `apps/web/app/(child)/play/page.tsx:203-210` civarı

Üç yerde de `<BotGame ... skillLevel={criteria.level.skill} depth={criteria.level.depth} ...>`
çağrısına `blunderChance={criteria.level.blunderChance}` satırı eklenecek (üç dosyada da
aynı `criteria` değişken adı kullanılıyor — `OpeningPractice.tsx`'te `criteria`,
`PositionPoolPractice.tsx`'te `criteria`, `play/page.tsx`'te `botCriteria`).

- [ ] **Step 1: `OpeningPractice.tsx`'i güncelle**

```tsx
      <BotGame
        key={matchKey}
        skillLevel={criteria.level.skill}
        depth={criteria.level.depth}
        blunderChance={criteria.level.blunderChance}
        timeControl={criteria.timeControl}
        studentColor={color}
        startFen={chosen.start_fen}
        onGameEnd={() => {}}
        onRematch={() => setMatchKey((k) => k + 1)}
      />
```

- [ ] **Step 2: `PositionPoolPractice.tsx`'i güncelle**

```tsx
    <BotGame
      key={matchKey}
      skillLevel={criteria.level.skill}
      depth={criteria.level.depth}
      blunderChance={criteria.level.blunderChance}
      timeControl={criteria.timeControl}
      studentColor={color}
      startFen={current.fen}
      onGameEnd={() => {}}
      practiceActions={{
        onPlaySame: () => setMatchKey((k) => k + 1),
        onPlayDifferent: () => {
          const next = pickDifferentPosition(positions, current.id);
          setCurrent(next);
          setColor(resolveColor(criteria.colorChoice));
          setMatchKey((k) => k + 1);
        },
      }}
    />
```

- [ ] **Step 3: `app/(child)/play/page.tsx`'i güncelle**

```tsx
      <BotGame
        key={gameKey}
        skillLevel={botCriteria.level.skill}
        depth={botCriteria.level.depth}
        blunderChance={botCriteria.level.blunderChance}
        timeControl={botCriteria.timeControl}
        studentColor={botColor}
```

(Bu satırdan sonraki mevcut prop'lara — `startFen`, `onGameEnd`, `onRematch` vb. —
DOKUNULMAZ, sadece `blunderChance` satırı eklenir.)

- [ ] **Step 4: tsc ile derleme kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: hata yok

- [ ] **Step 5: İlgili testleri çalıştır (regresyon)**

Run: `cd apps/web && npx vitest run -t "OpeningPractice|PositionPoolPractice|play page|Play Page"`
Expected: hepsi PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/play/OpeningPractice.tsx apps/web/components/play/PositionPoolPractice.tsx "apps/web/app/(child)/play/page.tsx"
git commit -m "feat: bot maç akışlarında blunderChance geçişi"
```

---

### Task 7: Tam test kapısı

**Files:** yok (sadece doğrulama)

- [ ] **Step 1: Frontend tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: hata yok

- [ ] **Step 2: Frontend lint**

Run: `cd apps/web && npx next lint`
Expected: hata yok (yeni dosyalarda)

- [ ] **Step 3: Frontend tüm testler**

Run: `cd apps/web && npx vitest run`
Expected: hepsi PASS

- [ ] **Step 4: Backend testleri (bu iş backend'e dokunmuyor ama yine de çalıştırılır)**

Run: `cd apps/api && python -m pytest -q`
Expected: hepsi PASS

- [ ] **Step 5: Herhangi bir adım kalırsa dur, düzelt, Step 1'den tekrar başla**

---

### Task 8: Canlı doğrulama — MultiPV gerçek testi + push onayı

**Files:** yok

- [ ] **Step 1: Kullanıcıya sor**

"Bunu canlı olarak test edeyim mi?" diye sor — onay gelmeden bu görev YAPILMAZ.

- [ ] **Step 2: Onay gelirse — MultiPV gerçekten çalışıyor mu kontrolü**

Dev sunucusunu (`preview_start`) aç, tarayıcı konsolunda gerçek Stockfish worker'ını
başlat (`new Worker('/stockfish/stockfish.js')`), `setoption name MultiPV value 4`,
`position startpos`, `go depth 8` gönder, gelen satırlarda birden fazla
`multipv N ... pv ...` satırı olduğunu doğrula (`javascript_tool` ile).

- [ ] **Step 3a: Çalışıyorsa — 1. seviyede gerçek bir bot maçı**

`/play` sayfasında Düzey 1 seçip bota karşı birkaç hamle oyna, botun en azından bazı
hamlelerde belirgin şekilde zayıf/hatalı oynadığını gözlemle (örn. taş bedavaya verme).
10. seviyede de kısa bir kontrol yap — botun hâlâ güçlü oynadığını doğrula.

- [ ] **Step 3b: Çalışmıyorsa — durumu kullanıcıya bildir**

MultiPV desteklenmiyorsa Task 2 ve Task 5'i yedek yönteme (adaysız, düşük derinlik +
rastgelelik) çevirmek gerekir — bunu YAPMADAN ÖNCE kullanıcıya durumu anlat ve onay al.

- [ ] **Step 4: Sonucu kullanıcıya kısa ve net raporla**

Ne test edildi, ne edilemedi, botun gerçekten zayıf oynayıp oynamadığı.

- [ ] **Step 5: Push onayı**

"Ana koda göndereyim mi?" diye sor — açık onay olmadan `git push` YAPILMAZ.

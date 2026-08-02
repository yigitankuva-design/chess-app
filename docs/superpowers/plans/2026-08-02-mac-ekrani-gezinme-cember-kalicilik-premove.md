# Maç Ekranı: Gezinme / Çember / Kalıcılık / Premove — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maç ve hamle-tabanlı pratik ekranlarına salt-okunur hamle geçmişi gezinmesi, çember biçimli kare işaretleme, bot maçında sayfa yenilemesine dayanıklılık ve premove eklemek.

**Architecture:** Tüm iş istemci tarafında. Yeni davranışların her biri önce saf mantık modülü olarak (`lib/`) yazılıp vitest ile test edilir, sonra `ChessBoard` / `MoveList` bileşenlerine **opsiyonel prop'larla** bağlanır; mevcut çağrı noktaları değişmeden çalışmaya devam eder. Backend'e, veritabanına ve WebSocket protokolüne dokunulmaz.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, chess.js 1.4, react-chessboard 5.10, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-02-mac-ekrani-gezinme-cember-kalicilik-premove-design.md`

**Tüm komutlar `C:\Users\muham\chess-app\apps\web` dizininden çalıştırılır.**

---

## Spec'ten Sapma (bilinçli, daha iyi)

Spec, `lib/play/sanTr.ts`'teki `turkishMovePairs` fonksiyonunun **dönüş tipini değiştirmeyi** ve `san-tr` / `move-list` testlerini güncellemeyi öngörüyordu. Bunun yerine **yeni** bir `turkishMoveRows` fonksiyonu eklenir; `turkishMovePairs` olduğu gibi kalır. Sonuç: `tests/san-tr.test.ts` ve `tests/move-list.test.ts` hiç değişmez, kırılma riski ortadan kalkar. `MoveList` yeni fonksiyona geçer ama **ürettiği metin birebir aynı kalır**, bu yüzden `tests/move-list-render.test.tsx` de değişmeden geçer.

---

## Dosya Yapısı

**Yeni saf mantık modülleri (React yok, DOM yok):**

| Dosya | Sorumluluk |
|---|---|
| `lib/play/moveNavigation.ts` | SAN listesinden ply başına FEN üretimi, görüntüleme indeksini sınırlama |
| `lib/play/botGameSession.ts` | Bot maçı durumunun sessionStorage'a yazılıp okunması |
| `lib/play/premove.ts` | Ön-hamlenin sıra gelince geçerli olup olmadığının çözümü |

**Yeni React birimleri:**

| Dosya | Sorumluluk |
|---|---|
| `lib/chess/useMoveHistoryNav.ts` | Görüntüleme indeksi durumu (canlı / geçmiş), ileri-geri adım |
| `components/play/HistoryBanner.tsx` | "Hamle N inceleniyor — Canlıya dön" şeridi (üç ekranda ortak) |

**Değiştirilecek dosyalar:**

| Dosya | Değişiklik |
|---|---|
| `lib/chess/useSquareAnnotations.ts` | Dolgu rengi → çember (`boxShadow` + `borderRadius`) |
| `lib/play/sanTr.ts` | `turkishMoveRows` eklenir (mevcut fonksiyonlar korunur) |
| `components/play/MoveList.tsx` | Opsiyonel `onSelectPly` / `activePly` |
| `components/ChessBoard.tsx` | Opsiyonel `onWheelStep`, `onPremove`, `premoveSquares`, `premoveColor` |
| `components/BotGame.tsx` | Oturum kalıcılığı + gezinme + premove |
| `components/LiveGame.tsx` | Gezinme + premove |
| `components/lesson-steps/MovePieceSolver.tsx` | Gezinme |

---

## Faz A — Madde 2: Çember işaretleme

### Task 1: useSquareAnnotations dolgu yerine çember çizer

**Files:**
- Modify: `lib/chess/useSquareAnnotations.ts:7-12` (renkler) ve `:73-76` (stil üretimi)
- Test: `tests/use-square-annotations.test.tsx`

- [ ] **Step 1: Mevcut testi yeni beklentiye çevir (başarısız olacak)**

`tests/use-square-annotations.test.tsx` içinde `backgroundColor` doğrulayan **8 satırı** aşağıdaki gibi değiştir. Beklenen davranış (renk seçimi, toggle, resetKey) aynen korunur; yalnız doğrulanan CSS özelliği değişir.

Dosyanın en üstüne, `import` satırlarının hemen altına yardımcı ekle:

```tsx
/** Çember stili: kare sınırına oturan iç gölge. Renk karşılaştırması bu
 *  yardımcı üzerinden yapılır ki beklenen değer tek yerde dursun. */
function ring(color: string): string {
  return `inset 0 0 0 3px ${color}`;
}
```

Sonra assert'leri şu şekilde değiştir (satır satır karşılık):

```tsx
// 'sade sağ-tık kareyi yeşil yapar'
expect(result.current.squareStyles.e4?.boxShadow).toBe(ring('rgb(34, 197, 94)'));

// 'Ctrl+sağ-tık kareyi kırmızı yapar'
expect(result.current.squareStyles.e4?.boxShadow).toBe(ring('rgb(220, 38, 38)'));

// 'Alt+sağ-tık kareyi mavi yapar'
expect(result.current.squareStyles.e4?.boxShadow).toBe(ring('rgb(37, 99, 235)'));

// 'Ctrl+Alt+sağ-tık kareyi sarı yapar'
expect(result.current.squareStyles.e4?.boxShadow).toBe(ring('rgb(234, 179, 8)'));

// 'farklı renkle tekrar sağ-tık üzerine yazar (temizlemez)'
expect(result.current.squareStyles.e4?.boxShadow).toBe(ring('rgb(220, 38, 38)'));

// 'birden fazla kare bağımsız işaretlenebilir'
expect(result.current.squareStyles.e4?.boxShadow).toBe(ring('rgb(34, 197, 94)'));
expect(result.current.squareStyles.d5?.boxShadow).toBe(ring('rgb(220, 38, 38)'));
```

`toBeDefined()` / `toBeUndefined()` / `toBeTruthy()` kullanan testler (toggle, resetKey, clearAnnotations) **DEĞİŞMEZ**.

Ayrıca dosyanın sonuna, çemberin kare dışına taşmadığını kilitleyen yeni bir test ekle:

```tsx
describe('çember biçimi (madde 2)', () => {
  it('işaret kareyi DOLDURMAZ, kare sınırına oturan çember çizer', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    const style = result.current.squareStyles.e4!;
    // Dolgu YOK: kare kendi zemin rengini korur.
    expect(style.backgroundColor).toBeUndefined();
    // Gölge ICERI dogru: kare disina tasmaz.
    expect(String(style.boxShadow)).toContain('inset');
    expect(style.borderRadius).toBe('50%');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/use-square-annotations.test.tsx`
Expected: FAIL — `boxShadow` `undefined` geliyor, `backgroundColor` hâlâ dolu.

- [ ] **Step 3: Hook'u çembere çevir**

`lib/chess/useSquareAnnotations.ts` içinde `COLORS` sabitini ve stil üretimini değiştir.

`COLORS` (satır 7-12) yerine:

```ts
/** Çember TAM OPAK: ince bir çizgi yarı saydam olduğunda tahtada zor
 *  seçiliyor (dolgu döneminde 0.55 uygundu, çemberde değil). */
const COLORS: Record<AnnotationColor, string> = {
  green: 'rgb(34, 197, 94)',
  red: 'rgb(220, 38, 38)',
  blue: 'rgb(37, 99, 235)',
  yellow: 'rgb(234, 179, 8)',
};

/** Kare sınırına oturan çember. `inset` gölge kutunun İÇİNE çizilir —
 *  kare dışına ASLA taşmaz (madde 2). */
const RING_WIDTH_PX = 3;
```

Stil üretimini (satır 73-76) şu şekilde değiştir:

```ts
  const squareStyles: Record<string, CSSProperties> = {};
  for (const [sq, color] of Object.entries(marks)) {
    // backgroundColor VERILMEZ: karenin kendi zemin rengi korunur, üstüne
    // yalnızca çember biner.
    squareStyles[sq] = {
      boxShadow: `inset 0 0 0 ${RING_WIDTH_PX}px ${COLORS[color]}`,
      borderRadius: '50%',
    };
  }
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/use-square-annotations.test.tsx`
Expected: PASS (9 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/chess/useSquareAnnotations.ts apps/web/tests/use-square-annotations.test.tsx
git commit -m "feat(madde2): kare isaretlemesi dolgu yerine cember cizer"
```

---

### Task 2: ChessBoard entegrasyon testi çemberi doğrular

**Files:**
- Test: `tests/chess-board-annotations.test.tsx`

Bu görevde **üretim kodu değişmez** — Task 1'deki değişiklik `ChessBoard` üzerinden de görünür olmalı. Test bunu kilitler.

- [ ] **Step 1: Testi yeni beklentiye çevir**

`tests/chess-board-annotations.test.tsx` dosyasını tamamen şu içerikle değiştir:

```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

describe('ChessBoard — sağ-tık işaretleme (madde 2: çember)', () => {
  it('bir kareye Ctrl+sağ-tık o kareye KIRMIZI ÇEMBER çizer, kareyi doldurmaz', () => {
    const { container } = render(
      <ChessBoard fen="8/8/8/8/8/8/8/8 w - - 0 1" />,
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    const square = container.querySelector('[data-square="d5"]') as HTMLElement;
    fireEvent.contextMenu(square);
    const overlay = square.querySelector('div');
    expect(overlay?.style.boxShadow).toContain('inset');
    expect(overlay?.style.boxShadow).toContain('rgb(220, 38, 38)');
    expect(overlay?.style.borderRadius).toBe('50%');
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
  });

  it('fen değişince işaretler temizlenir', () => {
    const { container, rerender } = render(
      <ChessBoard fen="8/8/8/8/8/8/8/8 w - - 0 1" />,
    );
    const square = container.querySelector('[data-square="d5"]') as HTMLElement;
    fireEvent.contextMenu(square);
    rerender(<ChessBoard fen="8/8/8/8/8/8/8/8 b - - 0 1" />);
    const squareAfter = container.querySelector('[data-square="d5"]') as HTMLElement;
    const overlay = squareAfter.querySelector('div');
    expect(overlay?.style.boxShadow).not.toContain('inset');
  });
});
```

- [ ] **Step 2: Testi çalıştır**

Run: `npx vitest run tests/chess-board-annotations.test.tsx`
Expected: PASS (2 test). Kırmızı gelirse Task 1'deki hook değişikliği `ChessBoard`'a ulaşmıyor demektir — `ChessBoard.tsx:199-201`'deki `annotationStyles` birleştirmesini kontrol et.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/chess-board-annotations.test.tsx
git commit -m "test(madde2): ChessBoard cember isaretlemesini dogrular"
```

---

## Faz B — Madde 3: Bot maçı sayfa yenilemesine dayanıklı

### Task 3: botGameSession.ts saf modül

**Files:**
- Create: `lib/play/botGameSession.ts`
- Test: `tests/bot-game-session.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`tests/bot-game-session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  botGameKey, loadBotGame, saveBotGame, clearBotGame,
} from '@/lib/play/botGameSession';

beforeEach(() => sessionStorage.clear());

const SAMPLE = {
  gameId: 42,
  moves: ['e2e4', 'e7e5'],
  whiteTime: 297,
  blackTime: 299,
  drawOffersUsed: 1,
};

describe('botGameSession — anahtar', () => {
  it('seviye/renk/başlangıç konumu farklıysa anahtar da farklıdır', () => {
    expect(botGameKey(3, 'w')).not.toBe(botGameKey(5, 'w'));
    expect(botGameKey(3, 'w')).not.toBe(botGameKey(3, 'b'));
    expect(botGameKey(3, 'w')).not.toBe(botGameKey(3, 'w', '8/8/8/8/8/8/8/8 w - - 0 1'));
  });

  it('aynı girdiler aynı anahtarı üretir', () => {
    expect(botGameKey(3, 'w')).toBe(botGameKey(3, 'w'));
  });
});

describe('botGameSession — kaydet/oku/temizle', () => {
  it('kayıt yoksa null döner', () => {
    expect(loadBotGame(botGameKey(1, 'w'))).toBeNull();
  });

  it('kaydedilen oyun aynen geri okunur', () => {
    const key = botGameKey(1, 'w');
    saveBotGame(key, SAMPLE);
    expect(loadBotGame(key)).toEqual(SAMPLE);
  });

  it('temizlenen oyun bir daha okunmaz', () => {
    const key = botGameKey(1, 'w');
    saveBotGame(key, SAMPLE);
    clearBotGame(key);
    expect(loadBotGame(key)).toBeNull();
  });

  it('farklı seviyedeki kayıtlar birbirine karışmaz', () => {
    saveBotGame(botGameKey(1, 'w'), SAMPLE);
    expect(loadBotGame(botGameKey(2, 'w'))).toBeNull();
  });
});

describe('botGameSession — bozuk kayıtlar ekranı kilitlemez', () => {
  it('JSON olmayan kayıt null döner', () => {
    const key = botGameKey(1, 'w');
    sessionStorage.setItem(key, 'bu JSON değil');
    expect(loadBotGame(key)).toBeNull();
  });

  it('moves dizi değilse kayıt geçersiz sayılır', () => {
    const key = botGameKey(1, 'w');
    sessionStorage.setItem(key, JSON.stringify({ ...SAMPLE, moves: 'e2e4' }));
    expect(loadBotGame(key)).toBeNull();
  });

  it('eksik sayısal alanlar güvenli varsayılana düşer', () => {
    const key = botGameKey(1, 'w');
    sessionStorage.setItem(key, JSON.stringify({ moves: ['e2e4'] }));
    expect(loadBotGame(key)).toEqual({
      gameId: null, moves: ['e2e4'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
    });
  });

  it('hamlesi olmayan kayıt geçersizdir (yeni oyun açılsın)', () => {
    const key = botGameKey(1, 'w');
    sessionStorage.setItem(key, JSON.stringify({ ...SAMPLE, moves: [] }));
    expect(loadBotGame(key)).toBeNull();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/bot-game-session.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/play/botGameSession"`.

- [ ] **Step 3: Modülü yaz**

`lib/play/botGameSession.ts`:

```ts
/** Bot maçının sayfa yenilemesine dayanıklı saklanması (madde 3).
 *
 *  Neden sessionStorage: `lib/play/practiceSession.ts` ile AYNI gerekçe —
 *  sekmeye özeldir, sekme kapanınca temizlenir, F5'te korunur. Sporcu
 *  yenileme yaptığında bot maçı SIFIRDAN başlamaz.
 *
 *  Neden UCI listesi saklanır (FEN değil): tahta hamleler tekrar oynatılarak
 *  kurulunca chess.js'in hamle geçmişi de geri gelir — notasyon kartı ve
 *  hamle gezinmesi (madde 1) çalışmaya devam eder. Sadece FEN saklansaydı
 *  geçmiş kaybolurdu.
 */

export interface StoredBotGame {
  /** Backend'deki oyun kimliği; çevrimdışı başlandıysa null olabilir. */
  gameId: number | null;
  /** Oynanmış hamleler, UCI ('e2e4'). Tahta bunlardan yeniden kurulur. */
  moves: string[];
  whiteTime: number;
  blackTime: number;
  drawOffersUsed: number;
}

export function botGameKey(
  skillLevel: number,
  studentColor: 'w' | 'b',
  startFen?: string,
): string {
  // startFen açılış pratiğinde farklıdır; anahtara girmezse sporcu farklı
  // açılışa geçtiğinde eski maçla karşılaşır.
  return `bsa:botmac:${skillLevel}:${studentColor}:${startFen ?? 'std'}`;
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function loadBotGame(key: string): StoredBotGame | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBotGame>;
    // Hamlesi olmayan kayıt işe yaramaz — yeni oyun açılsın.
    if (!Array.isArray(parsed.moves) || parsed.moves.length === 0) return null;
    if (parsed.moves.some((m) => typeof m !== 'string')) return null;
    return {
      gameId: typeof parsed.gameId === 'number' ? parsed.gameId : null,
      moves: parsed.moves,
      whiteTime: toCount(parsed.whiteTime),
      blackTime: toCount(parsed.blackTime),
      drawOffersUsed: toCount(parsed.drawOffersUsed),
    };
  } catch {
    return null;
  }
}

export function saveBotGame(key: string, data: StoredBotGame): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* kota dolu olabilir — maç yine oynanır, sadece yenilemede sıfırlanır */
  }
}

export function clearBotGame(key: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(key); } catch { /* yok say */ }
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/bot-game-session.test.ts`
Expected: PASS (9 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/botGameSession.ts apps/web/tests/bot-game-session.test.ts
git commit -m "feat(madde3): botGameSession saf modulu"
```

---

### Task 4: BotGame oturumu geri yükler, kaydeder ve bitince temizler

**Files:**
- Modify: `components/BotGame.tsx`
- Test: `tests/bot-game-persistence.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/bot-game-persistence.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { botGameKey, saveBotGame, loadBotGame } from '@/lib/play/botGameSession';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e2e4'; }
    destroy() {}
  },
}));

// Gercek react-chessboard happy-dom'da "Square width not found" firlatir
// (P5'te olculdu). Test edilen sey tahta cizimi degil, FEN mantigi.
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));

import { BotGame } from '@/components/BotGame';

const board = () => screen.getByTestId('board');

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

describe('BotGame — sayfa yenilemesi (madde 3)', () => {
  it('kayıtlı oturum varsa tahta o pozisyondan devam eder, sıfırlanmaz', async () => {
    saveBotGame(botGameKey(0, 'w'), {
      gameId: 7, moves: ['e2e4', 'e7e5'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
    });

    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);

    await waitFor(() => {
      const fen = board().getAttribute('data-fen') ?? '';
      // e4 ve e5 oynanmis: baslangic pozisyonu DEGIL, sira beyazda.
      expect(fen.split(' ')[0]).not.toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
      expect(fen).toContain(' w ');
    });
  });

  it('kayıt varken yeni oyun açmak için sunucuya BAŞVURMAZ', async () => {
    saveBotGame(botGameKey(0, 'w'), {
      gameId: 7, moves: ['e2e4', 'e7e5'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
    });
    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);

    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board()).toBeInTheDocument());

    const startCalls = fetchMock.mock.calls
      .filter((c) => String(c[0]).includes('/games/bot/start'));
    expect(startCalls).toHaveLength(0);
  });

  it('kayıt yoksa bugünkü davranış korunur: yeni oyun açılır', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);

    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => {
      const startCalls = fetchMock.mock.calls
        .filter((c) => String(c[0]).includes('/games/bot/start'));
      expect(startCalls.length).toBeGreaterThan(0);
    });
  });

  it('BOZUK kayıt ekranı kilitlemez, yeni oyun açılır', async () => {
    sessionStorage.setItem(botGameKey(0, 'w'), 'bu JSON değil');
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => {
      expect(board().getAttribute('data-fen'))
        .toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    });
  });

  it('maç terk edilince kayıt silinir (bitmiş maç geri gelmez)', async () => {
    const key = botGameKey(0, 'w');
    saveBotGame(key, {
      gameId: 7, moves: ['e2e4', 'e7e5'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
    });
    vi.stubGlobal('confirm', () => true);

    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    const terk = await screen.findByText('Terk Et');
    terk.click();

    await waitFor(() => expect(loadBotGame(key)).toBeNull());
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/bot-game-persistence.test.tsx`
Expected: FAIL — ilk test başlangıç pozisyonu görüyor, ikinci testte `/games/bot/start` çağrısı yapılıyor.

- [ ] **Step 3: BotGame'i kalıcılığa bağla**

`components/BotGame.tsx` içinde şu değişiklikleri yap.

**(a) İçe aktarma** — mevcut import bloğunun sonuna ekle:

```ts
import {
  botGameKey, loadBotGame, saveBotGame, clearBotGame,
} from '@/lib/play/botGameSession';
```

**(b) Oturum anahtarı ve hamle listesi** — `const chessRef = useRef(new Chess(startFen));` satırının HEMEN ÜSTÜNE ekle:

```ts
  // Oturum anahtarı render'lar arasında sabittir; prop'lardan türetilir.
  const sessionKeyStr = botGameKey(skillLevel, studentColor, startFen);
  /** Kayıttan okunan hamleler — ilk render'da tahtayı kurmak için kullanılır.
   *  useRef DEĞİL useState DEĞİL: yalnız ilk kurulumda okunur, sonra
   *  chessRef gerçeğin kaynağıdır. */
  const restoredRef = useRef(loadBotGame(sessionKeyStr));
```

**(c) chessRef kurulumu** — `const chessRef = useRef(new Chess(startFen));` satırını şununla değiştir:

```ts
  const chessRef = useRef((() => {
    // Kayıtlı hamleler tekrar oynatılır: hem pozisyon hem chess.js geçmişi
    // (notasyon kartı için gerekli) geri gelir.
    const board = new Chess(startFen);
    for (const uci of restoredRef.current?.moves ?? []) {
      try {
        board.move({
          from: uci.slice(0, 2) as Square,
          to: uci.slice(2, 4) as Square,
          promotion: promotionFromUci(uci) ?? 'q',
        });
      } catch {
        break; // bozuk kayıt — oynatılabildiği yere kadar
      }
    }
    return board;
  })());
  /** Backend'e yazılmış UCI hamleleri — sessionStorage kaydının içeriği. */
  const movesRef = useRef<string[]>([...(restoredRef.current?.moves ?? [])]);
```

**(d) Saat ve teklif hakkı başlangıcı** — mevcut satırları değiştir:

```ts
  const [drawOffersUsed, setDrawOffersUsed] = useState(restoredRef.current?.drawOffersUsed ?? 0);
```

```ts
  const [whiteTime, setWhiteTime] = useState(restoredRef.current?.whiteTime ?? (tc ? tc.base : 0));
  const [blackTime, setBlackTime] = useState(restoredRef.current?.blackTime ?? (tc ? tc.base : 0));
```

> DİKKAT: `const tc = timeControl ?? null;` satırı bu iki satırdan ÖNCE gelmeli. Dosyada zaten öyle (satır 53) — sırayı bozma.

**(e) Yeni oyun açma çağrısını koşullu yap** — `useEffect` içindeki `try { const token = getToken(); ... }` bloğunu şununla değiştir:

```ts
      // Kayıtlı oyun varsa YENİ OYUN AÇILMAZ — sayfa yenilemesi maçı
      // sıfırlıyordu (madde 3).
      if (restoredRef.current?.gameId != null) {
        gameIdRef.current = restoredRef.current.gameId;
      } else {
        try {
          const token = getToken();
          const res = await fetch(`${API_BASE}/games/bot/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ skill_level: skillLevel }),
          });
          if (res.ok) {
            const data = await res.json();
            gameIdRef.current = data.game_id;
          }
        } catch { /* offline OK */ }
      }
```

Aynı `useEffect` içindeki "sporcu siyahsa bot başlar" bloğunun koşulunu değiştir — kayıttan devam ediliyorsa bot ilk hamleyi TEKRAR oynamamalı:

```ts
      // Kayıttan devam ediliyorsa açılış hamlesi zaten oynanmıştır.
      if (!cancelled && movesRef.current.length === 0 && chessRef.current.turn() === botColor) {
```

**(f) Kaydetme yardımcısı** — `persistMove` fonksiyonunun HEMEN ÜSTÜNE ekle:

```ts
  /** Oyunun o anki durumunu sekmeye yazar. Her hamleden sonra çağrılır. */
  function saveSession() {
    saveBotGame(sessionKeyStr, {
      gameId: gameIdRef.current,
      moves: movesRef.current,
      whiteTime,
      blackTime,
      drawOffersUsed,
    });
  }
```

> DİKKAT: `whiteTime` / `blackTime` / `drawOffersUsed` state değerleri closure'dan okunur. Hamle sonrası çağrıldığı için bir tık eski olabilirler; saatler zaten saniyede bir güncellendiği için bu fark önemsizdir ve kabul edilir.

**(g) persistMove hamleyi listeye eklesin** — `persistMove` gövdesinin İLK satırı olarak ekle (mevcut `const gid = ...` satırından önce):

```ts
    movesRef.current = [...movesRef.current, uci];
    saveSession();
```

**(h) Oyun bitince temizle** — `finish()` ve `resignToBot()` fonksiyonlarının içine, `setStatus('over');` satırının hemen ALTINA ekle:

```ts
    clearBotGame(sessionKeyStr);
```

`offerDrawToBot()` içinde bot beraberliği kabul ettiğinde de aynı satırı `setStatus('over');` altına ekle.

Süre bitimi `useEffect`'i içinde iki `setStatus('over');` satırının her birinin altına da ekle:

```ts
      clearBotGame(sessionKeyStr);
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/bot-game-persistence.test.tsx`
Expected: PASS (5 test).

- [ ] **Step 5: Regresyon — mevcut BotGame testleri hâlâ geçiyor mu**

Run: `npx vitest run tests/bot-game-color.test.tsx`
Expected: PASS (5 test). Kırılırsa `restoredRef` null iken davranışın birebir eskisi gibi olduğunu kontrol et.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/BotGame.tsx apps/web/tests/bot-game-persistence.test.tsx
git commit -m "fix(madde3): bot macinda sayfa yenilemesi oyunu sifirlamaz"
```

---

## Faz C — Madde 1: Hamle geçmişinde salt-okunur gezinme

### Task 5: moveNavigation.ts saf mantık

**Files:**
- Create: `lib/play/moveNavigation.ts`
- Test: `tests/move-navigation.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`tests/move-navigation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fensFromSan, clampViewIndex } from '@/lib/play/moveNavigation';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('fensFromSan', () => {
  it('hamle yoksa yalnız başlangıç konumunu döndürür', () => {
    const fens = fensFromSan(undefined, []);
    expect(fens).toHaveLength(1);
    expect(fens[0].split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  });

  it('her yarı-hamle için bir konum üretir (uzunluk = hamle + 1)', () => {
    expect(fensFromSan(START, ['e4', 'e5', 'Nf3'])).toHaveLength(4);
  });

  it('0. eleman BAŞLANGIÇ konumudur, hamle uygulanmamıştır', () => {
    const fens = fensFromSan(START, ['e4']);
    expect(fens[0]).toBe(START);
  });

  it('i. eleman i. hamleden SONRAKİ konumdur', () => {
    const fens = fensFromSan(START, ['e4', 'e5']);
    expect(fens[1]).toContain('4P3');     // beyaz piyon e4'te
    expect(fens[1]).toContain(' b ');     // sıra siyahta
    expect(fens[2]).toContain(' w ');     // sıra tekrar beyazda
  });

  it('startFen verilmezse standart başlangıç kullanılır', () => {
    expect(fensFromSan(null, ['e4'])[0].split(' ')[0])
      .toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  });

  it('açılış konumundan başlayan maçta o konumdan devam eder', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(fensFromSan(fen, ['Nf3'])[0]).toBe(fen);
  });

  it('TUZAK: ŞAHSIZ öğretim pozisyonu çökmeye yol açmaz', () => {
    // Zafer Hoca'nin pozisyonlari KASTEN sahsizdir; skipValidation olmadan
    // chess.js "missing white king" firlatir ve notasyon gorunmez.
    const fen = '8/8/8/8/4P3/8/8/8 w - - 0 1';
    expect(() => fensFromSan(fen, [])).not.toThrow();
    expect(fensFromSan(fen, [])).toHaveLength(1);
  });

  it('TUZAK: bozuk SAN gelirse oynatılabildiği yere kadar üretir, çökmez', () => {
    const fens = fensFromSan(START, ['e4', 'zzz', 'Nf3']);
    expect(fens).toHaveLength(2);  // baslangic + e4
  });
});

describe('clampViewIndex', () => {
  it('sınır içindeki değeri aynen döndürür', () => {
    expect(clampViewIndex(2, 5)).toBe(2);
  });

  it('negatif değeri sıfıra çeker', () => {
    expect(clampViewIndex(-3, 5)).toBe(0);
  });

  it('taşan değeri son sıraya çeker', () => {
    expect(clampViewIndex(99, 5)).toBe(4);
  });

  it('boş listede sıfır döndürür (ekran kilitlenmez)', () => {
    expect(clampViewIndex(3, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/move-navigation.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/play/moveNavigation"`.

- [ ] **Step 3: Modülü yaz**

`lib/play/moveNavigation.ts`:

```ts
/** Hamle geçmişinde gezinme — saf mantık (madde 1). React yok, DOM yok.
 *
 *  Bu modül YALNIZCA GÖRÜNTÜ üretir: hamle geri almaz, hamle değiştirmez.
 *  Sporcu geçmişe baktığında tahtanın salt-okunur olması çağıran bileşenin
 *  sorumluluğudur (ChessBoard `interactive={false}` alır).
 */
import { Chess } from 'chess.js';

/**
 * Başlangıç konumu + SAN hamlelerinden her yarı-hamle sonrası FEN üretir.
 * Dönen dizinin 0. elemanı BAŞLANGIÇ konumu, i. elemanı i. hamleden sonraki
 * konumdur; uzunluk `san.length + 1`.
 *
 * ŞAHSIZ POZİSYON DESTEĞİ — `skipValidation` ZORUNLU. Zafer Hoca'nın öğretim
 * pozisyonları kasten şahsızdır; bu seçenek olmadan chess.js
 * `Invalid FEN: missing white king` ile çöker (bkz. lib/chess/movePlayer.ts).
 */
export function fensFromSan(startFen: string | undefined | null, san: string[]): string[] {
  const board = startFen
    ? new Chess(startFen, { skipValidation: true })
    : new Chess();
  const out: string[] = [board.fen()];
  for (const move of san) {
    try {
      board.move(move);
    } catch {
      break; // bozuk kayıt — oynatılabildiği yere kadar
    }
    out.push(board.fen());
  }
  return out;
}

/** Görüntüleme sırasını listenin sınırlarına çeker. Bozuk/taşan değer
 *  ekranı kilitlemesin diye her okumada uygulanır. */
export function clampViewIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/move-navigation.test.ts`
Expected: PASS (12 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/moveNavigation.ts apps/web/tests/move-navigation.test.ts
git commit -m "feat(madde1): moveNavigation saf mantigi"
```

---

### Task 6: sanTr'ye tıklanabilir hamle satırları eklenir

**Files:**
- Modify: `lib/play/sanTr.ts` (mevcut fonksiyonlara DOKUNULMAZ, yeni fonksiyon eklenir)
- Test: `tests/san-tr-rows.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`tests/san-tr-rows.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { turkishMoveRows } from '@/lib/play/sanTr';

describe('turkishMoveRows — tıklanabilir hamleler için yapı (madde 1)', () => {
  it('hamleleri beyaz/siyah olarak AYIRIR ve Türkçeleştirir', () => {
    expect(turkishMoveRows(['e4', 'e5', 'Nf3'])).toEqual([
      { no: 1, white: { san: 'e4', ply: 1 }, black: { san: 'e5', ply: 2 } },
      { no: 2, white: { san: 'Af3', ply: 3 }, black: null },
    ]);
  });

  it('ply, fensFromSan dizisindeki indeksle eşleşir (1 tabanlı)', () => {
    const rows = turkishMoveRows(['e4', 'e5']);
    expect(rows[0].white!.ply).toBe(1);   // fens[1] = e4 sonrası
    expect(rows[0].black!.ply).toBe(2);   // fens[2] = e5 sonrası
  });

  it('siyah başlıyorsa ilk satırın beyaz hanesi boştur, numara kaymaz', () => {
    expect(turkishMoveRows(['Nf6'], { whiteStarts: false, firstNo: 3 })).toEqual([
      { no: 3, white: null, black: { san: 'Af6', ply: 1 } },
    ]);
  });

  it('rok yazımı olduğu gibi kalır', () => {
    expect(turkishMoveRows(['O-O'])[0].white).toEqual({ san: 'O-O', ply: 1 });
  });

  it('hamle yoksa boş dizi döner', () => {
    expect(turkishMoveRows([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/san-tr-rows.test.ts`
Expected: FAIL — `turkishMoveRows is not a function`.

- [ ] **Step 3: Fonksiyonu ekle**

`lib/play/sanTr.ts` dosyasının SONUNA ekle (mevcut `toTurkishSan` ve `turkishMovePairs` **değiştirilmez**):

```ts
export interface TurkishMove {
  /** Türkçeleştirilmiş SAN. */
  san: string;
  /** 1 tabanlı yarı-hamle sırası. `fensFromSan(...)[ply]` bu hamleden
   *  SONRAKİ konumu verir — notasyona tıklanınca kullanılır (madde 1). */
  ply: number;
}

export interface TurkishMoveRow {
  no: number;
  white: TurkishMove | null;
  black: TurkishMove | null;
}

/** `turkishMovePairs` ile aynı numaralandırma, ama hamleler AYRI AYRI
 *  döner — böylece her hamle tek tek tıklanabilir. Metin birleştirme işi
 *  görüntüleyen bileşene (MoveList) kalır. */
export function turkishMoveRows(
  san: string[],
  start: { whiteStarts: boolean; firstNo: number } = { whiteStarts: true, firstNo: 1 },
): TurkishMoveRow[] {
  const rows: TurkishMoveRow[] = [];
  let i = 0;
  let no = start.firstNo;

  if (!start.whiteStarts && san.length > 0) {
    rows.push({ no, white: null, black: { san: toTurkishSan(san[0]), ply: 1 } });
    i = 1;
    no += 1;
  }

  for (; i < san.length; i += 2) {
    rows.push({
      no,
      white: { san: toTurkishSan(san[i]), ply: i + 1 },
      black: san[i + 1] ? { san: toTurkishSan(san[i + 1]), ply: i + 2 } : null,
    });
    no += 1;
  }
  return rows;
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/san-tr-rows.test.ts tests/san-tr.test.ts`
Expected: PASS — yeni 5 test + mevcut `san-tr` testleri (değişmediler).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/sanTr.ts apps/web/tests/san-tr-rows.test.ts
git commit -m "feat(madde1): turkishMoveRows tiklanabilir hamle yapisi"
```

---

### Task 7: MoveList hamleleri tıklanabilir yapar

**Files:**
- Modify: `components/play/MoveList.tsx`
- Test: `tests/move-list-click.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/move-list-click.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveList } from '@/components/play/MoveList';

describe('MoveList — hamleye tıklayarak gezinme (madde 1)', () => {
  it('onSelectPly verilmezse hamleler DÜZ METİN kalır (eski davranış)', () => {
    render(<MoveList san={['e4', 'e5']} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('onSelectPly verilirse her hamle ayrı ayrı tıklanabilir', () => {
    render(<MoveList san={['e4', 'e5']} onSelectPly={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'e5' })).toBeInTheDocument();
  });

  it('beyazın 1. hamlesine tıklayınca ply 1 bildirilir', () => {
    const onSelect = vi.fn();
    render(<MoveList san={['e4', 'e5', 'Nf3']} onSelectPly={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'e4' }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('siyahın 2. hamlesine tıklayınca ply 4 bildirilir', () => {
    const onSelect = vi.fn();
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6']} onSelectPly={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ac6' }));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('aktif hamle işaretlenir', () => {
    render(<MoveList san={['e4', 'e5']} onSelectPly={vi.fn()} activePly={2} />);
    expect(screen.getByRole('button', { name: 'e5' }))
      .toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'e4' }))
      .not.toHaveAttribute('aria-current');
  });

  it('tıklanabilir haldeyken de yazım aynı kalır (Türkçe, virgüllü)', () => {
    render(<MoveList san={['e4', 'e5', 'Nf3', 'Nc6']} onSelectPly={vi.fn()} />);
    const metin = screen.getByLabelText('Hamleler').textContent!
      .replace(/\s+/g, ' ').replace(/^\s*Hamleler\s*/, '').trim();
    expect(metin).toBe('1. e4 – e5, 2. Af3 – Ac6');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/move-list-click.test.tsx`
Expected: FAIL — `onSelectPly` prop'u yok, buton bulunamıyor.

- [ ] **Step 3: MoveList'i güncelle**

`components/play/MoveList.tsx` dosyasını tamamen şu içerikle değiştir:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { parseFenStart } from '@/lib/play/moveList';
import { turkishMoveRows } from '@/lib/play/sanTr';
import type { TurkishMove } from '@/lib/play/sanTr';

interface Props {
  /** Oynanan hamleler (SAN, chess.js'ten İngilizce gelir). */
  san: string[];
  /** Macin basladigi konum — acilis pratiginde standart degildir. */
  startFen?: string | null;
  /** Verilirse hamleler TIKLANABILIR olur ve secilen yari-hamle sirasi
   *  bildirilir (madde 1). Verilmezse hamleler duz metin kalir. */
  onSelectPly?: (ply: number) => void;
  /** O anda tahtada gosterilen yari-hamle — gorsel olarak isaretlenir. */
  activePly?: number;
}

/** Tahtanin ALTINDA duran hamle notasyonu (madde 1/3).
 *  Hamleler YAN YANA akar, satir bitince alt satirdan devam eder:
 *  "1. e4 – e5, 2. Af3 – Ac6, 3. Fc4 – Fc5 …"  Yazim TURKCEDIR. */
export function MoveList({ san, startFen, onSelectPly, activePly }: Props) {
  const rows = turkishMoveRows(san, parseFenStart(startFen));
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [san.length]);

  /** Tek bir hamle. onSelectPly yoksa buton URETILMEZ — eski ekranlarda
   *  notasyon aynen duz metin kalir. */
  function move(m: TurkishMove | null, fallback: string) {
    if (!m) return <>{fallback}</>;
    if (!onSelectPly) return <>{m.san}</>;
    const active = activePly === m.ply;
    return (
      <button
        type="button"
        onClick={() => onSelectPly(m.ply)}
        aria-current={active ? 'true' : undefined}
        className="underline-offset-2 hover:underline"
        style={active ? { fontWeight: 700, textDecoration: 'underline' } : undefined}
      >
        {m.san}
      </button>
    );
  }

  return (
    <section aria-label="Hamleler"
      /* Genislik TAHTAYLA AYNI: notasyon tahta hizasini gecmez. */
      className="t-card-i mt-3 p-3 w-full max-w-[600px] mx-auto">
      <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-2">
        Hamleler
      </p>
      {rows.length === 0 ? (
        <p className="text-sm t-muted">Henüz hamle yapılmadı.</p>
      ) : (
        <div ref={boxRef} className="max-h-32 overflow-y-auto overflow-x-hidden">
          {/* Akici yazi: satir dolunca kendiliginden alt satira gecer. */}
          <p className="text-sm font-mono leading-relaxed break-words">
            {rows.map((r, i) => (
              <span key={r.no}>
                <span className="whitespace-nowrap">
                  <span className="t-muted">{r.no}.</span>{' '}
                  {move(r.white, '…')}
                  {r.black ? <>{' – '}{move(r.black, '')}</> : null}
                  {i < rows.length - 1 ? ',' : ''}
                </span>
                {/* Ayirici bosluk nowrap DISINDA ve GERCEK bosluk:
                    once bolunmez bosluk (U+00A0) vardi, bu yuzden satir
                    hic bolunmuyor ve yazi yatay akiyordu. */}
                {i < rows.length - 1 ? ' ' : ''}
              </span>
            ))}
          </p>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Yeni testi çalıştır**

Run: `npx vitest run tests/move-list-click.test.tsx`
Expected: PASS (6 test).

- [ ] **Step 5: Regresyon — mevcut render testleri hâlâ geçiyor**

Run: `npx vitest run tests/move-list-render.test.tsx tests/move-list.test.ts`
Expected: PASS. Üretilen metin birebir korunduğu için bu dosyalar DEĞİŞMEZ. Kırılırsa boşluk yerleşimini (`{' '}` ve `{' – '}`) kontrol et — `nowrap` span'ının metni tam olarak `1. e4 – e5,` olmalı.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/play/MoveList.tsx apps/web/tests/move-list-click.test.tsx
git commit -m "feat(madde1): notasyondaki hamleler tiklanabilir"
```

---

### Task 8: useMoveHistoryNav hook'u

**Files:**
- Create: `lib/chess/useMoveHistoryNav.ts`
- Test: `tests/use-move-history-nav.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/use-move-history-nav.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';

const FENS = ['f0', 'f1', 'f2', 'f3'];

describe('useMoveHistoryNav — geçmişte gezinme (madde 1)', () => {
  it('başlangıçta CANLI konumu gösterir', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    expect(result.current.isLive).toBe(true);
    expect(result.current.viewFen).toBe('f3');
    expect(result.current.viewIndex).toBe(3);
  });

  it('bir adım geri gidince canlıdan çıkar', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.step(-1));
    expect(result.current.isLive).toBe(false);
    expect(result.current.viewFen).toBe('f2');
  });

  it('goTo ile belirli bir hamleye atlar', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.goTo(1));
    expect(result.current.viewFen).toBe('f1');
  });

  it('goLive canlı konuma döndürür', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.goTo(0));
    expect(result.current.isLive).toBe(false);
    act(() => result.current.goLive());
    expect(result.current.isLive).toBe(true);
    expect(result.current.viewFen).toBe('f3');
  });

  it('başlangıcın gerisine gidilemez', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.goTo(0));
    act(() => result.current.step(-1));
    expect(result.current.viewIndex).toBe(0);
  });

  it('son konumun ilerisine adım atınca CANLIYA döner', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.goTo(2));
    act(() => result.current.step(1));
    expect(result.current.isLive).toBe(true);
  });

  it('KARAR: geçmişe bakarken yeni hamle gelirse tahta GEÇMİŞTE KALIR', () => {
    // Kullanici bunu acikca secti: rakip hamle yapinca ekran zorla
    // canliya SICRAMAZ; sporcu kendisi doner.
    const { result, rerender } = renderHook(
      ({ fens }) => useMoveHistoryNav(fens),
      { initialProps: { fens: FENS } },
    );
    act(() => result.current.goTo(1));
    rerender({ fens: [...FENS, 'f4'] });
    expect(result.current.viewFen).toBe('f1');
    expect(result.current.isLive).toBe(false);
  });

  it('canlıyken yeni hamle gelirse canlı kalmaya devam eder', () => {
    const { result, rerender } = renderHook(
      ({ fens }) => useMoveHistoryNav(fens),
      { initialProps: { fens: FENS } },
    );
    rerender({ fens: [...FENS, 'f4'] });
    expect(result.current.isLive).toBe(true);
    expect(result.current.viewFen).toBe('f4');
  });

  it('TUZAK: liste kısalırsa taşan sıra sınıra çekilir, ekran kilitlenmez', () => {
    const { result, rerender } = renderHook(
      ({ fens }) => useMoveHistoryNav(fens),
      { initialProps: { fens: FENS } },
    );
    act(() => result.current.goTo(3));
    rerender({ fens: ['f0', 'f1'] });
    expect(result.current.viewFen).toBe('f1');
  });

  it('boş listede çökmez', () => {
    const { result } = renderHook(() => useMoveHistoryNav([]));
    expect(result.current.viewFen).toBeUndefined();
    expect(result.current.isLive).toBe(true);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/use-move-history-nav.test.tsx`
Expected: FAIL — `Failed to resolve import "@/lib/chess/useMoveHistoryNav"`.

- [ ] **Step 3: Hook'u yaz**

`lib/chess/useMoveHistoryNav.ts`:

```ts
'use client';
import { useCallback, useState } from 'react';
import { clampViewIndex } from '@/lib/play/moveNavigation';

export interface MoveHistoryNav {
  /** Tahtada gösterilen yarı-hamle sırası (0 = başlangıç konumu). */
  viewIndex: number;
  /** Son (canlı) konumda mıyız? */
  isLive: boolean;
  /** Gösterilecek FEN. */
  viewFen: string;
  /** Belirli bir sıraya atlar. */
  goTo: (index: number) => void;
  /** Canlı konuma döner. */
  goLive: () => void;
  /** İleri (+1) / geri (-1) tek adım. Tekerlek buna bağlanır. */
  step: (delta: number) => void;
}

/**
 * Hamle geçmişinde gezinme durumu (madde 1). SALT OKUNUR: hiçbir hamleyi
 * geri almaz, değiştirmez — yalnız hangi konumun gösterileceğini söyler.
 *
 * Durum `number | null` tutulur: `null` "canlıyı takip et" demektir. Böylece
 * yeni hamle geldiğinde canlıdaki sporcu otomatik ilerler, geçmişe bakan
 * sporcu ise BULUNDUĞU YERDE KALIR (kullanıcı kararı).
 */
export function useMoveHistoryNav(fens: string[]): MoveHistoryNav {
  const [pinned, setPinned] = useState<number | null>(null);

  const last = Math.max(fens.length - 1, 0);
  // Clamp HER OKUMADA uygulanir: liste kisalsa bile sira disari tasmaz.
  const viewIndex = pinned === null ? last : clampViewIndex(pinned, fens.length);
  const isLive = viewIndex === last;

  const goTo = useCallback((index: number) => setPinned(index), []);
  const goLive = useCallback(() => setPinned(null), []);

  const step = useCallback((delta: number) => {
    setPinned((prev) => {
      const current = prev === null ? Math.max(fens.length - 1, 0) : prev;
      const next = clampViewIndex(current + delta, fens.length);
      // Son konuma gelindiyse tekrar CANLIYI TAKIP moduna geç.
      return next >= fens.length - 1 ? null : next;
    });
  }, [fens.length]);

  return { viewIndex, isLive, viewFen: fens[viewIndex], goTo, goLive, step };
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/use-move-history-nav.test.tsx`
Expected: PASS (10 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/chess/useMoveHistoryNav.ts apps/web/tests/use-move-history-nav.test.tsx
git commit -m "feat(madde1): useMoveHistoryNav gezinme durumu"
```

---

### Task 9: ChessBoard tekerlekle adım atar (kaydırma regresyonu korunur)

**Files:**
- Modify: `components/ChessBoard.tsx`
- Test: `tests/chess-board-wheel.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/chess-board-wheel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';

/** Tahtanin kendi kapsayicisi — tekerlek dinleyicisi buraya baglanir. */
function boardBox(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-bsa-board]') as HTMLElement;
}

describe('ChessBoard — tekerlekle hamle gezinme (madde 1)', () => {
  it('tekerlek AŞAĞI çevrilince ileri adım bildirilir', () => {
    const onWheelStep = vi.fn();
    const { container } = render(<ChessBoard fen={EMPTY} onWheelStep={onWheelStep} />);
    fireEvent.wheel(boardBox(container), { deltaY: 120 });
    expect(onWheelStep).toHaveBeenCalledWith(1);
  });

  it('tekerlek YUKARI çevrilince geri adım bildirilir', () => {
    const onWheelStep = vi.fn();
    const { container } = render(<ChessBoard fen={EMPTY} onWheelStep={onWheelStep} />);
    fireEvent.wheel(boardBox(container), { deltaY: -120 });
    expect(onWheelStep).toHaveBeenCalledWith(-1);
  });

  it('tahtadaki tekerlek olayı sayfayı KAYDIRMAZ (preventDefault)', () => {
    const { container } = render(<ChessBoard fen={EMPTY} onWheelStep={vi.fn()} />);
    const evt = new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true });
    boardBox(container).dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('REGRESYON: onWheelStep verilmezse tekerlek engellenmez (sayfa kaydırılabilir)', () => {
    // ChessBoard.tsx'te tekerlek, kaydirma kilidini BILEREK serbest birakiyor
    // (telefonda/farede "sayfa kaydirilamiyor" sikayeti bu sekilde
    // duzeltilmisti). Gezinme kapaliyken o davranis AYNEN kalmali.
    const { container } = render(<ChessBoard fen={EMPTY} />);
    const evt = new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true });
    boardBox(container).dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(false);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/chess-board-wheel.test.tsx`
Expected: FAIL — `data-bsa-board` elemanı bulunamıyor (`boardBox` null döner).

- [ ] **Step 3: ChessBoard'a tekerlek desteği ekle**

`components/ChessBoard.tsx` içinde:

**(a)** `ChessBoardProps` arayüzüne ekle:

```ts
  /** Verilirse tahta üzerindeki fare tekerleği hamle geçmişinde adım atar
   *  (madde 1). +1 ileri, -1 geri. Verilmezse tekerlek ENGELLENMEZ —
   *  sayfa kaydırma davranışı aynen korunur. */
  onWheelStep?: (delta: 1 | -1) => void;
```

ve fonksiyon parametrelerine `onWheelStep,` ekle.

**(b)** Bileşenin en üstündeki ref tanımlarının yanına ekle:

```ts
  const boardBoxRef = useRef<HTMLDivElement>(null);
```

**(c)** `lockScroll` tanımından SONRA yeni bir efekt ekle:

```ts
  // Tekerlek dinleyicisi YALNIZCA tahta kutusuna baglanir ve
  // { passive: false } ile eklenir — React'in onWheel'i preventDefault
  // garantisi vermiyor. Sayfa govdesindeki kaydirma ve lockScroll'un
  // wheel'de serbest birakma mantigi DEGISMEZ (regresyon riski).
  useEffect(() => {
    const el = boardBoxRef.current;
    if (!el || !onWheelStep) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      onWheelStep(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [onWheelStep]);
```

**(d)** Tahta kutusuna ref ve test kancası ekle — `<div className="aspect-square flex-1 relative"` ile başlayan elemana:

```tsx
        <div
          ref={boardBoxRef}
          data-bsa-board=""
          className="aspect-square flex-1 relative"
```

(Elemanın diğer prop'ları — `style`, `onPointerDown`, `onPointerUp`, `onContextMenu` — aynen kalır.)

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/chess-board-wheel.test.tsx`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ChessBoard.tsx apps/web/tests/chess-board-wheel.test.tsx
git commit -m "feat(madde1): tahtada tekerlekle adim atma (kaydirma regresyonu korunur)"
```

---

### Task 10: HistoryBanner bileşeni

**Files:**
- Create: `components/play/HistoryBanner.tsx`
- Test: `tests/history-banner.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/history-banner.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryBanner } from '@/components/play/HistoryBanner';

describe('HistoryBanner — geçmiş uyarı şeridi (madde 1)', () => {
  it('canlıyken hiçbir şey göstermez', () => {
    const { container } = render(
      <HistoryBanner isLive viewIndex={3} onGoLive={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('geçmişteyken kaçıncı hamlenin incelendiğini söyler', () => {
    render(<HistoryBanner isLive={false} viewIndex={2} onGoLive={vi.fn()} />);
    expect(screen.getByText(/2\. hamle/)).toBeInTheDocument();
  });

  it('başlangıç konumunda özel metin gösterir', () => {
    render(<HistoryBanner isLive={false} viewIndex={0} onGoLive={vi.fn()} />);
    expect(screen.getByText(/Başlangıç konumu/)).toBeInTheDocument();
  });

  it('Canlıya dön butonu geri çağırıyı tetikler', () => {
    const onGoLive = vi.fn();
    render(<HistoryBanner isLive={false} viewIndex={2} onGoLive={onGoLive} />);
    fireEvent.click(screen.getByRole('button', { name: 'Canlıya dön' }));
    expect(onGoLive).toHaveBeenCalledTimes(1);
  });

  it('taşlar oynatılamayacağını AÇIKÇA söyler', () => {
    render(<HistoryBanner isLive={false} viewIndex={2} onGoLive={vi.fn()} />);
    expect(screen.getByText(/taş oynatamazsın/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/history-banner.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/play/HistoryBanner"`.

- [ ] **Step 3: Bileşeni yaz**

`components/play/HistoryBanner.tsx`:

```tsx
'use client';

interface Props {
  /** Canlı konumdaysak şerit GÖSTERİLMEZ. */
  isLive: boolean;
  /** İncelenen yarı-hamle sırası (0 = başlangıç konumu). */
  viewIndex: number;
  onGoLive: () => void;
}

/** Sporcu geçmiş bir konuma baktığında tahtanın altında çıkan şerit
 *  (madde 1). Amaç: sporcunun "taşlarım oynamıyor" diye takılmasını
 *  önlemek — durum AÇIKÇA yazılır ve tek tıkla canlıya dönülür. */
export function HistoryBanner({ isLive, viewIndex, onGoLive }: Props) {
  if (isLive) return null;
  return (
    <div className="t-card-i mt-2 p-2 w-full max-w-[600px] mx-auto flex items-center justify-between gap-2">
      <span className="text-xs t-muted">
        {viewIndex === 0
          ? 'Başlangıç konumu inceleniyor — burada taş oynatamazsın.'
          : `${viewIndex}. hamle inceleniyor — burada taş oynatamazsın.`}
      </span>
      <button type="button" onClick={onGoLive} className="t-btn px-3 py-1 text-xs shrink-0">
        Canlıya dön
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/history-banner.test.tsx`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/play/HistoryBanner.tsx apps/web/tests/history-banner.test.tsx
git commit -m "feat(madde1): HistoryBanner gecmis uyari seridi"
```

---

### Task 11: BotGame'e gezinme bağlanır

**Files:**
- Modify: `components/BotGame.tsx`
- Test: `tests/bot-game-history.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/bot-game-history.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { botGameKey, saveBotGame } from '@/lib/play/botGameSession';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e2e4'; }
    destroy() {}
  },
}));

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, interactive }: { fen: string; interactive?: boolean }) => (
    <div data-testid="board" data-fen={fen} data-interactive={String(!!interactive)} />
  ),
}));

import { BotGame } from '@/components/BotGame';

const board = () => screen.getByTestId('board');

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  // Kayittan 2 hamlelik gecmisle basla: gezinilecek bir sey olsun.
  saveBotGame(botGameKey(0, 'w'), {
    gameId: 7, moves: ['e2e4', 'e7e5'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
  });
});

describe('BotGame — hamle geçmişinde gezinme (madde 1)', () => {
  it('notasyondaki ilk hamleye tıklayınca tahta o konuma döner', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    const e4 = await screen.findByRole('button', { name: 'e4' });
    fireEvent.click(e4);
    await waitFor(() => {
      const fen = board().getAttribute('data-fen') ?? '';
      expect(fen).toContain(' b ');   // e4 sonrasi: sira siyahta
    });
  });

  it('geçmişe bakarken tahta ETKİLEŞİMSİZ olur (taş oynatılamaz)', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    const e4 = await screen.findByRole('button', { name: 'e4' });
    fireEvent.click(e4);
    await waitFor(() => expect(board().getAttribute('data-interactive')).toBe('false'));
  });

  it('Canlıya dön butonu güncel konuma geri getirir', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'e4' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Canlıya dön' }));
    await waitFor(() => {
      expect(board().getAttribute('data-interactive')).toBe('true');
      expect(board().getAttribute('data-fen')).toContain(' w ');
    });
  });

  it('canlıyken uyarı şeridi görünmez', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board()).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Canlıya dön' })).toBeNull();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/bot-game-history.test.tsx`
Expected: FAIL — notasyonda buton yok (`onSelectPly` bağlanmamış).

- [ ] **Step 3: BotGame'i gezinmeye bağla**

`components/BotGame.tsx` içinde:

**(a)** Dosyanın 2. satırındaki react import'una `useMemo` EKLE (yeni bir import satırı AÇMA — aynı modülden ikinci import lint hatası verir):

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
```

Diğer içe aktarmaları import bloğunun sonuna ekle:

```ts
import { fensFromSan } from '@/lib/play/moveNavigation';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';
import { HistoryBanner } from '@/components/play/HistoryBanner';
```

**(b)** `const tc = timeControl ?? null;` satırının ÜSTÜNE ekle:

```ts
  // Notasyon ve gezinme AYNI kaynaktan beslenir: chess.js geçmişi.
  // `fen` state'i her hamlede değiştiği için bağımlılık olarak yeterlidir.
  const sanHistory = useMemo(() => chessRef.current.history(), [fen]);
  const fens = useMemo(() => fensFromSan(startFen, sanHistory), [startFen, sanHistory]);
  const nav = useMoveHistoryNav(fens);
```

> `useMemo` bağımlılığında `fen` kullanılıyor ama gövdede geçmiyor; ESLint uyarısı çıkarsa satırın üstüne `// eslint-disable-next-line react-hooks/exhaustive-deps` ekle. Bu bilinçli: `chessRef` bir ref olduğu için bağımlılık olamaz, `fen` ise her hamlede değişen tetikleyicidir.

**(c)** `<ChessBoard ... />` çağrısını değiştir:

```tsx
      <ChessBoard
        fen={nav.viewFen}
        interactive={status === 'playing' && !thinking && nav.isLive}
        onPieceDrop={handleDrop}
        boardOrientation={studentColor === 'w' ? 'white' : 'black'}
        onWheelStep={nav.step}
      />

      <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
```

**(d)** `<MoveList ... />` çağrısını değiştir:

```tsx
      <MoveList
        san={sanHistory}
        startFen={startFen}
        onSelectPly={nav.goTo}
        activePly={nav.isLive ? undefined : nav.viewIndex}
      />
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/bot-game-history.test.tsx`
Expected: PASS (4 test).

- [ ] **Step 5: Regresyon**

Run: `npx vitest run tests/bot-game-color.test.tsx tests/bot-game-persistence.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/BotGame.tsx apps/web/tests/bot-game-history.test.tsx
git commit -m "feat(madde1): bot macinda hamle gecmisi gezinmesi"
```

---

### Task 12: LiveGame ve MovePieceSolver'a gezinme bağlanır

**Files:**
- Modify: `components/LiveGame.tsx`
- Modify: `components/lesson-steps/MovePieceSolver.tsx`
- Test: `tests/move-piece-solver-history.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/move-piece-solver-history.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    async bestMove() { return 'e7e5'; }
    destroy() {}
  },
}));

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, interactive, onWheelStep }: {
    fen: string; interactive?: boolean; onWheelStep?: (d: 1 | -1) => void;
  }) => (
    <div
      data-testid="board"
      data-fen={fen}
      data-interactive={String(!!interactive)}
      data-has-wheel={String(!!onWheelStep)}
    />
  ),
}));

import { MovePieceSolver } from '@/components/lesson-steps/MovePieceSolver';

const EXERCISE = {
  type: 'move_piece' as const,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e4', 'e5'],
  instruction: 'e4 oyna',
};

describe('MovePieceSolver — geçmiş gezinme bağlı (madde 1)', () => {
  it('tahtaya tekerlek gezinmesi bağlanmıştır', () => {
    render(
      <MovePieceSolver
        exercise={EXERCISE}
        disabled={false}
        onSolved={vi.fn()}
        onWrong={vi.fn()}
      />,
    );
    expect(screen.getByTestId('board').getAttribute('data-has-wheel')).toBe('true');
  });

  it('hamle oynanmadan önce canlı konumdadır ve tahta etkileşimlidir', () => {
    render(
      <MovePieceSolver
        exercise={EXERCISE}
        disabled={false}
        onSolved={vi.fn()}
        onWrong={vi.fn()}
      />,
    );
    expect(screen.getByTestId('board').getAttribute('data-interactive')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Canlıya dön' })).toBeNull();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/move-piece-solver-history.test.tsx`
Expected: FAIL — `data-has-wheel` `"false"` geliyor.

- [ ] **Step 3: MovePieceSolver'ı bağla**

`components/lesson-steps/MovePieceSolver.tsx` içinde:

**(a)** Dosyanın 2. satırındaki react import'una `useMemo` EKLE (yeni import satırı AÇMA):

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
```

Diğer içe aktarmaları import bloğunun sonuna ekle:

```ts
import { fensFromSan } from '@/lib/play/moveNavigation';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';
import { HistoryBanner } from '@/components/play/HistoryBanner';
```

**(b)** `const state = playerState(exercise.fen, playedMoves);` satırının ALTINA ekle:

```ts
  // playedMoves SAN tutar (bkz. lib/chess/movePlayer.ts) — dogrudan beslenir.
  const fens = useMemo(
    () => fensFromSan(exercise.fen, playedMoves),
    [exercise.fen, playedMoves],
  );
  const nav = useMoveHistoryNav(fens);
```

**(c)** `return` bloğunu değiştir:

```tsx
  return (
    <div className="space-y-2">
      <ChessBoard
        fen={nav.isLive ? state.fen : nav.viewFen}
        interactive={!disabled && !thinking && nav.isLive}
        onPieceDrop={handleMove}
        boardOrientation={studentSide === 'w' ? 'white' : 'black'}
        onWheelStep={nav.step}
      />
      <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
      {thinking && (
        <p className="text-xs" style={{ color: 'var(--t-muted)' }}>Rakip düşünüyor…</p>
      )}
    </div>
  );
```

- [ ] **Step 4: LiveGame'i bağla**

`components/LiveGame.tsx` içinde:

**(a)** Dosyanın 2. satırındaki react import'una `useMemo` EKLE (yeni import satırı AÇMA):

```ts
import { useState, useRef, useEffect, useMemo } from 'react';
```

Diğer içe aktarmaları import bloğunun sonuna ekle:

```ts
import { fensFromSan } from '@/lib/play/moveNavigation';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';
import { HistoryBanner } from '@/components/play/HistoryBanner';
```

**(b)** `const token = ...` satırının ÜSTÜNE ekle:

```ts
  // LiveGame'de chess.load() gecmisi siler; bu yuzden gezinme SUNUCUDAN
  // gelen sanList uzerinden yeniden kurulur (chessRef.history() KULLANILMAZ).
  const fens = useMemo(() => fensFromSan(startFen, sanList), [startFen, sanList]);
  const nav = useMoveHistoryNav(fens);
```

**(c)** `<ChessBoard ... />` çağrısını ve altındaki `<MoveList ... />` çağrısını değiştir:

```tsx
      <ChessBoard
        fen={nav.isLive ? fen : nav.viewFen}
        interactive={status === 'active' && nav.isLive}
        onPieceDrop={handleDrop}
        boardOrientation={myColor}
        onWheelStep={nav.step}
      />

      <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />

      {/* Madde 1: tum hamleler tahtanin ALTINDA. */}
      <MoveList
        san={sanList}
        startFen={startFen}
        onSelectPly={nav.goTo}
        activePly={nav.isLive ? undefined : nav.viewIndex}
      />
```

- [ ] **Step 5: Testleri çalıştır**

Run: `npx vitest run tests/move-piece-solver-history.test.tsx tests/live-game-controls.test.tsx`
Expected: PASS. `live-game-controls` kırılırsa `nav.isLive` başlangıçta `true` olduğundan davranışın değişmemesi gerekir — `fens` boş dizi gelmediğini kontrol et (`fensFromSan` en az 1 eleman döndürür).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/LiveGame.tsx apps/web/components/lesson-steps/MovePieceSolver.tsx apps/web/tests/move-piece-solver-history.test.tsx
git commit -m "feat(madde1): insan maci ve pratik sorularinda gecmis gezinmesi"
```

---

## Faz D — Madde 5: Premove

### Task 13: premove.ts saf mantık

**Files:**
- Create: `lib/play/premove.ts`
- Test: `tests/premove.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`tests/premove.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolvePremove } from '@/lib/play/premove';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('resolvePremove — sıra gelince ön-hamle çözümü (madde 5)', () => {
  it('ön-hamle yoksa null döner', () => {
    expect(resolvePremove(START, null)).toBeNull();
  });

  it('geçerli ön-hamle aynen döner', () => {
    expect(resolvePremove(START, { from: 'e2', to: 'e4' }))
      .toEqual({ from: 'e2', to: 'e4' });
  });

  it('KURAL DIŞI ön-hamle sessizce iptal edilir (null)', () => {
    expect(resolvePremove(START, { from: 'e2', to: 'e5' })).toBeNull();
  });

  it('taşı olmayan kareden ön-hamle iptal edilir', () => {
    expect(resolvePremove(START, { from: 'e4', to: 'e5' })).toBeNull();
  });

  it('sıra rakipteyken (kendi taşı değilken) iptal edilir', () => {
    // Sira BEYAZDA; siyah tasla hamle denenirse gecersizdir.
    expect(resolvePremove(START, { from: 'e7', to: 'e5' })).toBeNull();
  });

  it('TUZAK: araya giren hamle ön-hamleyi geçersiz kılarsa iptal edilir', () => {
    // Beyaz sah cekiliyor; Af3 artik oynanamaz.
    const check = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(resolvePremove(check, { from: 'g1', to: 'f3' })).toBeNull();
  });

  it('TUZAK: bozuk FEN çökmeye yol açmaz', () => {
    expect(() => resolvePremove('bu FEN değil', { from: 'e2', to: 'e4' })).not.toThrow();
    expect(resolvePremove('bu FEN değil', { from: 'e2', to: 'e4' })).toBeNull();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/premove.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/play/premove"`.

- [ ] **Step 3: Modülü yaz**

`lib/play/premove.ts`:

```ts
/** Ön-hamle (premove) — saf mantık (madde 5).
 *
 *  Sporcu rakibi beklerken hamlesini önceden seçer. Sıra kendisine geldiğinde
 *  bu hamle GEÇERLİYSE oynanır; değilse SESSİZCE iptal edilir (kullanıcı
 *  kararı — uyarı gösterilmez, akış bozulmaz).
 *
 *  Bu modül tahtayı DEĞİŞTİRMEZ; yalnız "oynanabilir mi" sorusunu yanıtlar.
 *  Hamleyi uygulamak çağıran bileşenin işidir (ses, saat, sunucuya yazma
 *  oradaki normal akışla çalışsın diye).
 */
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

export interface Premove {
  from: Square;
  to: Square;
}

/** Geçerliyse ön-hamlenin kendisini, değilse null döndürür. */
export function resolvePremove(fen: string, pm: Premove | null): Premove | null {
  if (!pm) return null;
  try {
    // Terfi her zaman vezir — BotGame/LiveGame/movePlayer ile tutarlı.
    const board = new Chess(fen, { skipValidation: true });
    const move = board.move({ from: pm.from, to: pm.to, promotion: 'q' });
    return move ? pm : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/premove.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/premove.ts apps/web/tests/premove.test.ts
git commit -m "feat(madde5): premove saf mantigi"
```

---

### Task 14: ChessBoard ön-hamle seçimini kabul eder

**Files:**
- Modify: `components/ChessBoard.tsx`
- Test: `tests/chess-board-premove.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/chess-board-premove.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

function square(container: HTMLElement, name: string): HTMLElement {
  return container.querySelector(`[data-square="${name}"]`) as HTMLElement;
}

describe('ChessBoard — ön-hamle seçimi (madde 5)', () => {
  it('sıra rakipteyken KENDİ taşına tıklayıp hedefe tıklayınca ön-hamle bildirilir', () => {
    const onPremove = vi.fn();
    const { container } = render(
      <ChessBoard fen={START} interactive={false} onPremove={onPremove} premoveColor="w" />,
    );
    fireEvent.click(square(container, 'e2'));
    fireEvent.click(square(container, 'e4'));
    expect(onPremove).toHaveBeenCalledWith('e2', 'e4');
  });

  it('RAKİBİN taşıyla ön-hamle verilemez', () => {
    const onPremove = vi.fn();
    const { container } = render(
      <ChessBoard fen={START} interactive={false} onPremove={onPremove} premoveColor="w" />,
    );
    fireEvent.click(square(container, 'e7'));
    fireEvent.click(square(container, 'e5'));
    expect(onPremove).not.toHaveBeenCalled();
  });

  it('onPremove verilmezse sıra rakipteyken hiçbir şey olmaz (eski davranış)', () => {
    const onSquareClick = vi.fn();
    const { container } = render(
      <ChessBoard fen={START} interactive={false} onSquareClick={onSquareClick} />,
    );
    fireEvent.click(square(container, 'e2'));
    fireEvent.click(square(container, 'e4'));
    expect(onSquareClick).not.toHaveBeenCalled();
  });

  it('seçilmiş ön-hamlenin iki karesi işaretlenir', () => {
    const { container } = render(
      <ChessBoard
        fen={START}
        interactive={false}
        onPremove={vi.fn()}
        premoveColor="w"
        premoveSquares={{ from: 'e2', to: 'e4' }}
      />,
    );
    const from = square(container, 'e2').querySelector('div');
    const to = square(container, 'e4').querySelector('div');
    expect(from?.style.backgroundColor).toBe('rgba(255, 170, 0, 0.55)');
    expect(to?.style.backgroundColor).toBe('rgba(255, 170, 0, 0.55)');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/chess-board-premove.test.tsx`
Expected: FAIL — `onPremove` prop'u yok, çağrılmıyor.

- [ ] **Step 3: ChessBoard'a ön-hamle desteği ekle**

`components/ChessBoard.tsx` içinde:

**(a)** `ChessBoardProps` arayüzüne ekle:

```ts
  /** Sıra rakipteyken (interactive=false) sporcunun ÖN-HAMLE seçmesine izin
   *  verir (madde 5). Hamle OYNANMAZ — yalnız seçim bildirilir. */
  onPremove?: (from: Square, to: Square) => void;
  /** Ön-hamle verebilecek tarafın rengi. Yalnız bu renkteki taşlar seçilir. */
  premoveColor?: 'w' | 'b';
  /** Seçilmiş ön-hamle — iki karesi işaretlenir. */
  premoveSquares?: { from: Square; to: Square } | null;
```

ve fonksiyon parametrelerine `onPremove, premoveColor, premoveSquares = null,` ekle.

**(b)** `handleSquareClick` fonksiyonunun başındaki `if (!interactive) return;` satırını şununla değiştir:

```ts
    // ÖN-HAMLE: sıra rakipteyken sporcu hamlesini önceden seçebilir (madde 5).
    // Hamle OYNANMAZ; yalnız seçim yukarı bildirilir.
    if (!interactive) {
      if (!onPremove || !premoveColor) return;
      if (selectedSquare) {
        // Ikinci tik: hedef kare. Kendi tasina tekrar tiklarsa secim degisir.
        if (getPieceColor(square, fen) === premoveColor) {
          setSelectedSquare(square);
          return;
        }
        onPremove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }
      // Ilk tik: yalnizca KENDI tasi secilebilir.
      if (getPieceColor(square, fen) === premoveColor) setSelectedSquare(square);
      return;
    }
    lockScroll();
```

> DİKKAT: `clearAnnotations()` ve `clearArrows()` çağrıları bu bloktan ÖNCE kalmalı (mevcut satır 129) — sporcu tahtaya dokununca çemberler her durumda kalkar (madde 2).

**(c)** Ön-hamle karelerinin işaretlenmesi — `if (lastMove) { ... }` bloğunun ALTINA ekle:

```ts
  // Ön-hamle kareleri belirgin turuncuyla işaretlenir (madde 5).
  if (premoveSquares) {
    [premoveSquares.from, premoveSquares.to].forEach((sq) => {
      overrides[sq] = {
        ...overrides[sq],
        backgroundColor: 'rgba(255, 170, 0, 0.55)',
      };
    });
  }
```

**(d)** Sürükleyerek ön-hamle — `Chessboard` seçeneklerinde `allowDragging` satırını değiştir:

```ts
              allowDragging: interactive || !!onPremove,
```

ve `onPieceDrop` sarmalayıcısını şu şekilde değiştir:

```ts
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                lockScroll(400);
                // Sıra rakipteyse gerçek hamle YAPILMAZ; seçim ön-hamle
                // olarak alınır ve taş yerine geri döner (false).
                if (!interactive) {
                  if (onPremove && premoveColor
                      && getPieceColor(sourceSquare as Square, fen) === premoveColor) {
                    onPremove(sourceSquare as Square, targetSquare as Square);
                  }
                  return false;
                }
                return onPieceDrop
                  ? onPieceDrop(sourceSquare as Square, targetSquare as Square)
                  : false;
              },
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/chess-board-premove.test.tsx`
Expected: PASS (4 test).

- [ ] **Step 5: Regresyon — tahta testleri**

Run: `npx vitest run tests/chess-board-annotations.test.tsx tests/chess-board-wheel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/ChessBoard.tsx apps/web/tests/chess-board-premove.test.tsx
git commit -m "feat(madde5): ChessBoard on-hamle secimini kabul eder"
```

---

### Task 15: BotGame ve LiveGame ön-hamleyi uygular

**Files:**
- Modify: `components/BotGame.tsx`
- Modify: `components/LiveGame.tsx`
- Test: `tests/bot-game-premove.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`tests/bot-game-premove.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e7e5'; }
    destroy() {}
  },
}));

/** Tahta stub'i: ust bilesenin verdigi ON-HAMLE geri cagrisini disari acar,
 *  boylece test rakip dusunurken hamle secebilir. */
let firePremove: ((from: string, to: string) => void) | null = null;
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, onPremove, onPieceDrop }: {
    fen: string;
    onPremove?: (f: string, t: string) => void;
    onPieceDrop?: (f: string, t: string) => boolean;
  }) => {
    firePremove = onPremove ?? null;
    return (
      <div data-testid="board" data-fen={fen}>
        <button type="button" onClick={() => onPieceDrop?.('e2', 'e4')}>oyna-e4</button>
      </div>
    );
  },
}));

import { BotGame } from '@/components/BotGame';

const board = () => screen.getByTestId('board');

beforeEach(() => {
  sessionStorage.clear();
  firePremove = null;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

describe('BotGame — ön-hamle (madde 5)', () => {
  it('bot düşünürken verilen ön-hamle, sıra gelince kendiliğinden oynanır', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    // Sporcu e4 oynar → bot dusunmeye baslar.
    (await screen.findByText('oyna-e4')).click();
    // Bot dusunurken sporcu on-hamle verir: Af3.
    await waitFor(() => expect(firePremove).not.toBeNull());
    firePremove!('g1', 'f3');
    // Bot e5 oynayinca sira sporcuya gelir ve Af3 KENDILIGINDEN oynanir.
    await waitFor(() => {
      const fen = board().getAttribute('data-fen') ?? '';
      expect(fen).toContain('5N2');   // at f3'te
    }, { timeout: 3000 });
  });

  it('GEÇERSİZ ön-hamle sessizce iptal edilir, oyun devam eder', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    (await screen.findByText('oyna-e4')).click();
    await waitFor(() => expect(firePremove).not.toBeNull());
    firePremove!('a1', 'a8');   // kural disi
    await waitFor(() => {
      const fen = board().getAttribute('data-fen') ?? '';
      expect(fen).toContain(' w ');    // sira sporcuda, oyun kilitlenmedi
      expect(fen).not.toContain('R7');  // kale a8'e GITMEDI
    }, { timeout: 3000 });
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/bot-game-premove.test.tsx`
Expected: FAIL — `firePremove` null kalıyor (`onPremove` bağlanmamış).

- [ ] **Step 3: BotGame'e ön-hamle ekle**

`components/BotGame.tsx` içinde:

**(a)** İçe aktarmalara ekle:

```ts
import { resolvePremove } from '@/lib/play/premove';
import type { Premove } from '@/lib/play/premove';
```

**(b)** State ve ref ekle — `const [pending, setPending] = useState(...)` satırının ALTINA:

```ts
  const [premove, setPremove] = useState<Premove | null>(null);
  /** Bot cevabı async akışta okunur; state closure'ı eski kalabildiği için
   *  ref ile ikizlenir. */
  const premoveRef = useRef<Premove | null>(null);

  function choosePremove(from: Square, to: Square) {
    const pm = { from, to };
    premoveRef.current = pm;
    setPremove(pm);
  }

  function clearPremove() {
    premoveRef.current = null;
    setPremove(null);
  }
```

**(c)** Bot hamlesinden sonra ön-hamleyi uygula — `applyStudentMove` içindeki async bloğun sonunu değiştir. Mevcut son iki satır:

```ts
      setThinking(false);
      if (chess.isGameOver()) finish();
```

şununla değiştirilir:

```ts
      setThinking(false);
      if (chess.isGameOver()) { finish(); return; }

      // Madde 5: sıra sporcuya geldi — ön-hamle varsa şimdi oynanır.
      // Geçersizse SESSİZCE iptal edilir (uyarı yok, sıra sporcuda kalır).
      const pm = resolvePremove(chess.fen(), premoveRef.current);
      clearPremove();
      if (pm) applyStudentMove(pm.from, pm.to);
```

**(d)** Sporcu kendi hamlesini yaparsa bekleyen ön-hamle iptal olur — `applyStudentMove` içinde `setFen(chess.fen());` satırının ALTINA ekle:

```ts
    clearPremove(); // yeni hamle yapıldı, eski ön-hamle geçersiz.
```

**(e)** `ChessBoard` çağrısına ekle (Task 11'de güncellenmiş hali):

```tsx
        onPremove={choosePremove}
        premoveColor={studentColor}
        premoveSquares={premove}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/bot-game-premove.test.tsx`
Expected: PASS (2 test).

- [ ] **Step 5: LiveGame'e ön-hamle ekle**

`components/LiveGame.tsx` içinde:

**(a)** İçe aktarmalara ekle:

```ts
import { resolvePremove } from '@/lib/play/premove';
import type { Premove } from '@/lib/play/premove';
```

**(b)** State ve ref ekle — `const [pending, setPending] = useState(...)` satırının ALTINA:

```ts
  const [premove, setPremove] = useState<Premove | null>(null);
  /** WebSocket geri çağrısı eski closure'ı görebilir; ref ile ikizlenir. */
  const premoveRef = useRef<Premove | null>(null);

  function choosePremove(from: Square, to: Square) {
    const pm = { from, to };
    premoveRef.current = pm;
    setPremove(pm);
  }

  function clearPremove() {
    premoveRef.current = null;
    setPremove(null);
  }
```

**(c)** Rakip hamlesinden sonra ön-hamleyi uygula — `move_made` dalındaki `if (msg.fen_after && chess.fen() !== msg.fen_after) { ... }` bloğunun İÇİNDE, `playMoveSound();` satırının ALTINA ekle:

```ts
          // Madde 5: rakip oynadı, sıra bana geldi — ön-hamle varsa oynanır.
          const myTurnNow = (chess.turn() === 'w' && myColor === 'white')
            || (chess.turn() === 'b' && myColor === 'black');
          if (myTurnNow) {
            const pm = resolvePremove(chess.fen(), premoveRef.current);
            clearPremove();
            if (pm) applyMyMove(pm.from, pm.to);
          }
```

**(d)** Kendi hamlemde bekleyen ön-hamle iptal olur — `applyMyMove` içinde `setFen(chess.fen());` satırının ALTINA ekle:

```ts
    clearPremove(); // yeni hamle yapıldı, eski ön-hamle geçersiz.
```

**(e)** `ChessBoard` çağrısına ekle (Task 12'de güncellenmiş hali):

```tsx
        onPremove={choosePremove}
        premoveColor={myColor === 'white' ? 'w' : 'b'}
        premoveSquares={premove}
```

- [ ] **Step 6: Regresyon**

Run: `npx vitest run tests/live-game-controls.test.tsx tests/bot-game-color.test.tsx tests/bot-game-history.test.tsx tests/bot-game-persistence.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/BotGame.tsx apps/web/components/LiveGame.tsx apps/web/tests/bot-game-premove.test.tsx
git commit -m "feat(madde5): maclarda on-hamle (premove)"
```

---

## Kapanış

### Task 16: Tam test kapısı

**Files:** yok (yalnız doğrulama)

- [ ] **Step 1: Tip denetimi**

Run: `npx tsc --noEmit`
Expected: Hata yok. Hata çıkarsa DÜZELT — atlanmaz.

- [ ] **Step 2: Lint**

Run: `npx next lint`
Expected: Hata yok. `react-hooks/exhaustive-deps` uyarısı çıkarsa Task 11'deki `eslint-disable` notunu uygula.

- [ ] **Step 3: Tüm web testleri**

Run: `npx vitest run`
Expected: Tüm testler PASS. (Bu plan öncesi taban 719 test; bu plan ~60 test ekler.)

- [ ] **Step 4: Backend regresyonu**

Backend'e hiç dokunulmadı; yine de zincirin sağlam olduğunu doğrula.

Run: `cd ../../apps/api && python -m pytest -q`
Expected: Tüm testler PASS.

- [ ] **Step 5: Commit (değişiklik varsa)**

```bash
git add -A
git commit -m "test: mac ekrani gezinme/cember/kalicilik/premove test kapisi"
```

### Task 17: Canlı doğrulama (KURAL #6) ve teslim

**Files:** yok

- [ ] **Step 1: Değişikliklerin tarayıcıda gözlemlenebilir olduğunu doğrula**

Bu iş TAMAMEN ön yüz. KURAL #6 gereği "sen dene" DENMEZ. `.claude/launch.json` üzerinden
önizleme sunucusu başlat, tarayıcıda şunları gerçekten sür:

1. Bot maçı aç, iki hamle oyna, **sayfayı yenile** → maç aynı pozisyondan devam etmeli.
2. Notasyondaki bir hamleye tıkla → tahta o konuma dönmeli, taş sürüklenememeli,
   "Canlıya dön" şeridi çıkmalı.
3. Tahtanın üzerinde fare tekerleğini çevir → hamleler arasında gezinmeli, **sayfa
   kaymamalı**. Tahtanın DIŞINDA çevir → sayfa normal kaymalı.
4. Bir kareye sağ-tıkla → dolgu değil **çember** çıkmalı, kare dışına taşmamalı;
   bir hamle yapınca veya bir kareye sol-tıklayınca kaybolmalı.
5. Bot düşünürken bir taş sürükle → ön-hamle işaretlenmeli; bot oynayınca hamle
   kendiliğinden gerçekleşmeli.

- [ ] **Step 2: Sonucu dürüstçe raporla**

Neyin doğrulandığını ve neyin doğrulanamadığını AÇIKÇA yaz (KURAL #1). Doğrulanamayan
bir madde varsa "çalışıyor" DENMEZ.

- [ ] **Step 3: Push için kullanıcı onayı al**

Bu projede dal stratejisi yok; iş doğrudan `main`'e gider ve canlıya deploy olur
(KURAL #3 — canlı kullanıcılar var). Push ETMEDEN ÖNCE kullanıcıya sor ve açık onay al.

```bash
git push origin main
```

# Taşı Oynat — Sporcu Tarafı (P5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sporcunun, Zafer Hoca'nın P4'te kaydettiği hamle dizisini tıkla-tıkla veya sürükle ile oynayabilmesi; rakibin cevabının cevap anahtarından (yoksa Stockfish motorundan) otomatik gelmesi.

**Architecture:** Tüm karar mantığı `movePlayer.ts` içindeki saf fonksiyonlara çıkarılır (dnd-kit sürüklemesi test ortamında güvenilir simüle edilemediği için) — P4'teki `moveRecorder.ts` ile aynı desen. UI ince bir `MovePieceSolver` bileşenidir ve mevcut `ChessBoard`'u kullanır; `ChessBoard`'daki şahsız-pozisyon hatası da bu iş kapsamında düzeltilir.

**Tech Stack:** React/TypeScript, chess.js, react-chessboard, Stockfish (web worker), vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-25-tasi-oynat-sporcu-design.md`

---

## Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `apps/web/components/ChessBoard.tsx` | Değişiklik — 3 `new Chess()` çağrısına `skipValidation` (şahsız pozisyon hatası) |
| `apps/web/lib/chess/movePlayer.ts` | **Yeni** — saf mantık: sıra, beklenen hamle, hamle deneme, tamamlanma, UCI→SAN |
| `apps/web/components/lesson-steps/MovePieceSolver.tsx` | **Yeni** — sporcu arayüzü (ChessBoard + motor çağrısı) |
| `apps/web/components/lesson-steps/BoardExercise.tsx` | Değişiklik — `MovePieceEx` ayrık birleşime bölünür, placeholder yerine gerçek çözücü |

---

## Ölçülmüş gerçekler (plan yazılmadan önce doğrulandı)

Bu plan aşağıdakileri **varsaymıyor** — gerçek ortamda çalıştırılarak ölçüldü:

1. **Stockfish şahsız pozisyonlarda ÇALIŞIYOR** (tarayıcıda gerçek worker ile):
   `8/8/8/8/8/8/4P3/8 w` → `bestmove e2e4` ✓,
   `8/4p3/8/8/8/8/4P3/8 b` → `bestmove e7e6` ✓.
   `bestmove (none)` yalnızca gerçekten legal hamle yokken dönüyor — çökme yok.
2. **`ChessBoard` şahsız pozisyonda tıkla-oynatı sessizce kaybediyor**:
   `onPieceDrop` şahsız FEN'de **0 kez**, şahlı FEN'de **1 kez** çağrıldı.
3. **`chess.js` şahsız FEN'i `skipValidation` olmadan reddediyor**
   (`Invalid FEN: missing white king`) — P4'te ölçüldü.
4. **`ChessBoard` tek callback kullanıyor**: tıkla-tıkla akışı
   `ChessBoard.tsx:110`'da `onPieceDrop?.(selectedSquare, square)` çağırıyor,
   sürükleme de aynı prop'a bağlı → tek işleyici her iki yöntemi karşılar.
5. **`ChessBoard` sağlayıcısız test edilebiliyor**: mevcut `chess-board.test.tsx`
   (2 test) hiçbir Provider sarmalayıcısı olmadan geçiyor.

---

## Task 1: `ChessBoard` şahsız pozisyon düzeltmesi

**Files:**
- Modify: `apps/web/components/ChessBoard.tsx:72-100`
- Test: `apps/web/tests/chess-board-kingless.test.tsx` (yeni)

- [ ] **Step 1: Regresyon testini yaz (FAIL bekleniyor)**

`apps/web/tests/chess-board-kingless.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

const KINGLESS = '8/8/8/8/8/8/4P3/8 w - - 0 1';    // Zafer'in öğretim pozisyonu
const WITH_KINGS = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1'; // gerçek prod pozisyonu

function clickSquare(container: HTMLElement, square: string) {
  fireEvent.click(container.querySelector(`[data-square="${square}"]`)!);
}

describe('ChessBoard — şahsız pozisyonlarda tıkla-oynat', () => {
  it('ŞAHSIZ pozisyonda tıkla-oynat onPieceDrop çağırır (düzeltmenin kanıtı)', () => {
    const onPieceDrop = vi.fn(() => true);
    const { container } = render(
      <ChessBoard fen={KINGLESS} interactive onPieceDrop={onPieceDrop} />,
    );
    clickSquare(container, 'e2'); // taşı seç
    clickSquare(container, 'e4'); // hedefe tıkla
    expect(onPieceDrop).toHaveBeenCalledWith('e2', 'e4');
  });

  it('REGRESYON: şahlı pozisyonda tıkla-oynat eskisi gibi çalışır', () => {
    const onPieceDrop = vi.fn(() => true);
    const { container } = render(
      <ChessBoard fen={WITH_KINGS} interactive onPieceDrop={onPieceDrop} />,
    );
    clickSquare(container, 'f4'); // kaleyi seç
    clickSquare(container, 'h4'); // hedefe tıkla
    expect(onPieceDrop).toHaveBeenCalledWith('f4', 'h4');
  });

  it('REGRESYON: interactive=false iken tıklama hamle üretmez', () => {
    const onPieceDrop = vi.fn(() => true);
    const { container } = render(
      <ChessBoard fen={WITH_KINGS} onPieceDrop={onPieceDrop} />,
    );
    clickSquare(container, 'f4');
    clickSquare(container, 'h4');
    expect(onPieceDrop).not.toHaveBeenCalled();
  });

  it('REGRESYON: karşı tarafın taşına tıklamak onu seçmez', () => {
    const onPieceDrop = vi.fn(() => true);
    const { container } = render(
      <ChessBoard fen={WITH_KINGS} interactive onPieceDrop={onPieceDrop} />,
    );
    clickSquare(container, 'g8'); // siyah şah — sıra beyazda
    clickSquare(container, 'f8');
    expect(onPieceDrop).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, ilk testin FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/chess-board-kingless.test.tsx`
Expected: 1. test FAIL (`onPieceDrop` hiç çağrılmadı — şahsız pozisyonda `getValidDestinations` boş dönüyor). Diğer 3 regresyon testi PASS.

- [ ] **Step 3: Üç `new Chess()` çağrısına `skipValidation` ekle**

`apps/web/components/ChessBoard.tsx`'te şu üç fonksiyonu değiştir:

```ts
  function getValidDestinations(square: Square, chessFen: string): Square[] {
    try {
      const chess = new Chess(chessFen);
      return chess
        .moves({ square, verbose: true })
        .map((m) => m.to as Square);
    } catch {
      return [];
    }
  }

  function getPieceColor(square: Square, chessFen: string): 'w' | 'b' | null {
    try {
      const chess = new Chess(chessFen);
      const piece = chess.get(square);
      return piece ? piece.color : null;
    } catch {
      return null;
    }
  }

  function getTurnColor(chessFen: string): 'w' | 'b' {
    try {
      const chess = new Chess(chessFen);
      return chess.turn();
    } catch {
      return 'w';
    }
  }
```

şununla:

```ts
  // ŞAHSIZ POZİSYON DESTEĞİ: Zafer Hoca'nın öğretim pozisyonları kasten şahsızdır
  // (boş tahta + tek piyon). skipValidation olmadan chess.js "Invalid FEN: missing
  // white king" fırlatır, catch bloğu boş liste döndürür ve tıkla-oynat SESSİZCE
  // çalışmaz (ölçüldü: onPieceDrop 0 kez çağrılıyordu). skipValidation yalnızca FEN
  // doğrulamasını atlar — geçerli pozisyonlarda davranış birebir aynı kalır.
  function getValidDestinations(square: Square, chessFen: string): Square[] {
    try {
      const chess = new Chess(chessFen, { skipValidation: true });
      return chess
        .moves({ square, verbose: true })
        .map((m) => m.to as Square);
    } catch {
      return [];
    }
  }

  function getPieceColor(square: Square, chessFen: string): 'w' | 'b' | null {
    try {
      const chess = new Chess(chessFen, { skipValidation: true });
      const piece = chess.get(square);
      return piece ? piece.color : null;
    } catch {
      return null;
    }
  }

  function getTurnColor(chessFen: string): 'w' | 'b' {
    try {
      const chess = new Chess(chessFen, { skipValidation: true });
      return chess.turn();
    } catch {
      return 'w';
    }
  }
```

`try/catch` blokları **kaldırılmaz** — başka bir sebeple (tamamen bozuk FEN) fırlarsa yine güvenli varsayılana düşülür.

- [ ] **Step 4: Testleri tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/chess-board-kingless.test.tsx`
Expected: 4 test PASS.

- [ ] **Step 5: Mevcut ChessBoard testleri hâlâ geçiyor mu**

Run: `cd apps/web && npx vitest run tests/chess-board.test.tsx`
Expected: 2 test PASS.

- [ ] **Step 6: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/ChessBoard.tsx apps/web/tests/chess-board-kingless.test.tsx
git commit -m "fix: ChessBoard şahsız pozisyonlarda tıkla-oynatı sessizce kaybediyordu (skipValidation)"
```

---

## Task 2: `movePlayer.ts` — saf çözüm mantığı

**Files:**
- Create: `apps/web/lib/chess/movePlayer.ts`
- Test: `apps/web/tests/move-player.test.ts` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor — modül yok)**

`apps/web/tests/move-player.test.ts` oluştur:

```ts
import { describe, it, expect } from 'vitest';
import {
  playerState, expectedStudentMove, tryStudentMove,
  opponentKeyMove, isSequenceComplete, appendUciMove,
} from '@/lib/chess/movePlayer';

const KINGLESS = '8/8/8/8/8/8/4P3/8 w - - 0 1';       // öğretim pozisyonu
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';   // gerçek prod pozisyonu
const CASTLING = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
const EN_PASSANT = '8/8/8/3pP3/8/8/8/8 w - d6 0 2';
const PROMOTION = 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1';

describe('playerState', () => {
  it('ŞAHSIZ pozisyonda çökmez (skipValidation kanıtı)', () => {
    const s = playerState(KINGLESS, []);
    expect(s.turn).toBe('w');
    expect(s.isStudentTurn).toBe(true);
  });

  it('hamlelerden sonraki güncel pozisyonu döner', () => {
    expect(playerState(TWO_SIDED, ['Rh4']).fen).toContain('7R');
  });

  it('tek hamleden sonra sıra rakibe geçer', () => {
    expect(playerState(TWO_SIDED, ['Rh4']).isStudentTurn).toBe(false);
  });

  it('iki hamleden sonra sıra tekrar sporcuda', () => {
    expect(playerState(TWO_SIDED, ['Rh4', 'Kf8']).isStudentTurn).toBe(true);
  });
});

describe('expectedStudentMove', () => {
  it('çift indekste sporcunun hamlesini döner', () => {
    expect(expectedStudentMove(['Rh4', 'Kf8', 'Rh8'], [])).toBe('Rh4');
    expect(expectedStudentMove(['Rh4', 'Kf8', 'Rh8'], ['Rh4', 'Kf8'])).toBe('Rh8');
  });

  it('rakip sırasındayken null döner', () => {
    expect(expectedStudentMove(['Rh4', 'Kf8'], ['Rh4'])).toBeNull();
  });

  it('anahtar bittiyse null döner', () => {
    expect(expectedStudentMove(['Rh4'], ['Rh4', 'Kf8'])).toBeNull();
  });
});

describe('tryStudentMove', () => {
  it('doğru hamle correct döner ve diziye eklenir', () => {
    const r = tryStudentMove(TWO_SIDED, ['Rh4', 'Kf8'], [], 'f4', 'h4');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['Rh4'] });
  });

  it('legal ama anahtardan farklı hamle wrong döner', () => {
    const r = tryStudentMove(TWO_SIDED, ['Rh4'], [], 'f4', 'f5');
    expect(r.kind).toBe('wrong');
  });

  it('kural dışı hamle illegal döner (ceza değil, geçersiz hareket)', () => {
    const r = tryStudentMove(TWO_SIDED, ['Rh4'], [], 'f4', 'e5');
    expect(r).toEqual({ kind: 'illegal' });
  });

  it('ŞAHSIZ pozisyonda doğru hamle çalışır', () => {
    const r = tryStudentMove(KINGLESS, ['e4'], [], 'e2', 'e4');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['e4'] });
  });

  it('ROK hamlesi SAN olarak doğru eşleşir', () => {
    const r = tryStudentMove(CASTLING, ['O-O'], [], 'e1', 'g1');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['O-O'] });
  });

  it('GEÇERKEN ALMA hamlesi SAN olarak doğru eşleşir', () => {
    const r = tryStudentMove(EN_PASSANT, ['exd6'], [], 'e5', 'd6');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['exd6'] });
  });

  it('TERFİ hamlesi vezire yapılır ve SAN eşleşir (şah eki dahil)', () => {
    // Ölçüldü: chess.js bu pozisyonda 'e8=Q+' üretiyor (şah eki SAN'ın parçası).
    const r = tryStudentMove(PROMOTION, ['e8=Q+'], [], 'e7', 'e8');
    expect(r.kind).toBe('correct');
  });

  it('MAT eki (#) olan hamle doğru eşleşir', () => {
    // Ölçüldü: 6k1/... pozisyonunda Rh4, Kf8 sonrası h4->h8 SAN'ı 'Rh8#' (mat).
    const r = tryStudentMove(TWO_SIDED, ['Rh4', 'Kf8', 'Rh8#'], ['Rh4', 'Kf8'], 'h4', 'h8');
    expect(r).toEqual({ kind: 'correct', playedMoves: ['Rh4', 'Kf8', 'Rh8#'] });
  });

  it('ŞAH/MAT EKİ EKSİK anahtar eşleşmez (kanonik SAN zorunlu)', () => {
    // Anahtar 'Rh8' (eksik #) ise sporcunun 'Rh8#' hamlesi eşleşmez.
    // Pratikte sorun değil: P4'teki MoveRecorderBoard anahtarı chess.js'in
    // move.san'ından ürettiği için her zaman kanonik formda kaydediyor.
    const r = tryStudentMove(TWO_SIDED, ['Rh4', 'Kf8', 'Rh8'], ['Rh4', 'Kf8'], 'h4', 'h8');
    expect(r.kind).toBe('wrong');
  });
});

describe('opponentKeyMove', () => {
  it('rakip sırasında anahtarda hamle varsa onu döner', () => {
    expect(opponentKeyMove(['Rh4', 'Kf8'], ['Rh4'])).toBe('Kf8');
  });

  it('rakip sırasında anahtarda hamle yoksa null döner (motor sinyali)', () => {
    expect(opponentKeyMove(['Rh4'], ['Rh4'])).toBeNull();
  });

  it('sporcu sırasındayken null döner', () => {
    expect(opponentKeyMove(['Rh4', 'Kf8'], [])).toBeNull();
  });
});

describe('isSequenceComplete', () => {
  it('hiç hamle oynanmadıysa tamamlanmamıştır', () => {
    expect(isSequenceComplete(['Rh4'], [])).toBe(false);
  });

  it('rakip sırasındayken tamamlanmamıştır', () => {
    expect(isSequenceComplete(['Rh4'], ['Rh4'])).toBe(false);
  });

  it('sporcunun başka hamlesi kalmadıysa tamamlanmıştır', () => {
    expect(isSequenceComplete(['Rh4', 'Kf8'], ['Rh4', 'Kf8'])).toBe(true);
  });

  it('3 hamlelik anahtarda motor cevabından sonra tamamlanır', () => {
    expect(isSequenceComplete(['Rh4', 'Kf8', 'Rh8'], ['Rh4', 'Kf8', 'Rh8'])).toBe(false);
    expect(isSequenceComplete(['Rh4', 'Kf8', 'Rh8'], ['Rh4', 'Kf8', 'Rh8', 'Kg7'])).toBe(true);
  });
});

describe('appendUciMove', () => {
  it('motorun UCI cevabını SAN olarak ekler', () => {
    expect(appendUciMove(TWO_SIDED, ['Rh4'], 'g8f8')).toEqual(['Rh4', 'Kf8']);
  });

  it('"(none)" cevabında null döner (motorun hamlesi yok)', () => {
    expect(appendUciMove(TWO_SIDED, ['Rh4'], '(none)')).toBeNull();
  });

  it('boş cevapta null döner', () => {
    expect(appendUciMove(TWO_SIDED, ['Rh4'], '')).toBeNull();
  });

  it('kural dışı UCI cevabında null döner', () => {
    expect(appendUciMove(TWO_SIDED, ['Rh4'], 'a1a8')).toBeNull();
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/move-player.test.ts`
Expected: FAIL — `@/lib/chess/movePlayer` modülü bulunamadı.

- [ ] **Step 3: Modülü oluştur**

`apps/web/lib/chess/movePlayer.ts`:

```ts
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

/**
 * ŞAHSIZ POZİSYON DESTEĞİ — `skipValidation` ZORUNLU.
 * Zafer Hoca'nın öğretim pozisyonları kasten şahsızdır; bu seçenek olmadan
 * chess.js `Invalid FEN: missing white king` ile çöker (ölçüldü).
 */
function newPlayerChess(fen: string): Chess {
  return new Chess(fen, { skipValidation: true });
}

/** Başlangıç pozisyonundan itibaren oynanmış SAN hamlelerini uygular. */
function replay(fen: string, playedMoves: string[]): Chess {
  const board = newPlayerChess(fen);
  for (const san of playedMoves) {
    try {
      board.move(san);
    } catch {
      break; // bozuk kayıt — oynatılabildiği yere kadar
    }
  }
  return board;
}

export interface PlayerState {
  /** Oynanan hamlelerden sonraki güncel pozisyon. */
  fen: string;
  /** Sırası gelen taraf. */
  turn: 'w' | 'b';
  /** Sıra sporcuda mı? (çift sayıda hamle oynanmışsa evet) */
  isStudentTurn: boolean;
}

export function playerState(fen: string, playedMoves: string[]): PlayerState {
  const board = replay(fen, playedMoves);
  return {
    fen: board.fen(),
    turn: board.turn(),
    isStudentTurn: playedMoves.length % 2 === 0,
  };
}

/**
 * Sporcunun sırasıysa cevap anahtarında beklenen SAN hamlesi; rakibin
 * sırasıysa veya anahtar bittiyse null.
 */
export function expectedStudentMove(
  answerKey: string[],
  playedMoves: string[],
): string | null {
  if (playedMoves.length % 2 !== 0) return null; // rakip sırası
  return answerKey[playedMoves.length] ?? null;
}

export type StudentMoveResult =
  | { kind: 'illegal' }
  | { kind: 'wrong'; san: string }
  | { kind: 'correct'; playedMoves: string[] };

/**
 * Sporcunun oynamak istediği hamleyi değerlendirir:
 *  - `illegal`: satranç kurallarına aykırı → taş yerine döner, YANLIŞ CEVAP SAYILMAZ
 *  - `wrong`:   legal ama cevap anahtarındaki hamle değil → yanlış cevap
 *  - `correct`: anahtarla eşleşiyor → güncellenmiş hamle dizisi
 */
export function tryStudentMove(
  fen: string,
  answerKey: string[],
  playedMoves: string[],
  from: string,
  to: string,
): StudentMoveResult {
  const board = replay(fen, playedMoves);
  let san: string;
  try {
    // Terfi her zaman vezir — BotGame/LiveGame/MoveRecorderBoard ile tutarlı.
    const move = board.move({ from: from as Square, to: to as Square, promotion: 'q' });
    san = move.san;
  } catch {
    return { kind: 'illegal' };
  }
  const expected = expectedStudentMove(answerKey, playedMoves);
  if (expected === null || san !== expected) {
    return { kind: 'wrong', san };
  }
  return { kind: 'correct', playedMoves: [...playedMoves, san] };
}

/**
 * Rakibin sırasıysa cevap anahtarındaki hamlesi; anahtarda yoksa null
 * (bu durumda çağıran taraf motora sorar).
 */
export function opponentKeyMove(
  answerKey: string[],
  playedMoves: string[],
): string | null {
  if (playedMoves.length % 2 === 0) return null; // sporcu sırası
  return answerKey[playedMoves.length] ?? null;
}

/** Sporcunun cevap anahtarında oynayacağı başka hamle kalmadı mı? */
export function isSequenceComplete(
  answerKey: string[],
  playedMoves: string[],
): boolean {
  return playedMoves.length % 2 === 0 && answerKey[playedMoves.length] === undefined;
}

/**
 * Motorun UCI cevabını ('g8f8') SAN'a çevirip diziye ekler.
 * '(none)', boş cevap veya kural dışı hamlede null döner — çağıran taraf
 * bunu "rakibin hamlesi yok" olarak yorumlar ve soruyu tamamlar.
 */
export function appendUciMove(
  fen: string,
  playedMoves: string[],
  uci: string,
): string[] | null {
  if (!uci || uci === '(none)' || uci.length < 4) return null;
  const board = replay(fen, playedMoves);
  try {
    const move = board.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: 'q',
    });
    return [...playedMoves, move.san];
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/move-player.test.ts`
Expected: 22 test PASS.

- [ ] **Step 5: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/chess/movePlayer.ts apps/web/tests/move-player.test.ts
git commit -m "feat: movePlayer.ts — sporcu hamle çözüm mantığı (şahsız pozisyon + rok/geçerken alma/terfi)"
```

---

## Task 3: `MovePieceEx` tipini ayrık birleşime böl

Bu görev **kod davranışını değiştirmez**, sadece tip modelini düzeltir ve
Task 4'ün üzerine inşa edeceği zemini hazırlar.

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx:22-32` (tip) ve `:247` (guard)
- Test: `apps/web/tests/board-exercise-move-piece-placeholder.test.tsx` (mevcut, değişmez)

- [ ] **Step 1: `MovePieceEx` tipini ikiye böl**

`apps/web/components/lesson-steps/BoardExercise.tsx`'te mevcut:

```ts
export interface MovePieceEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  piece_square: string;
  target_squares: string[];
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}
```

şununla değiştir:

```ts
/** Eski format: "şu taşı şu karelerden birine taşı" (tek hamle). */
export interface MovePieceLegacyEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  piece_square: string;
  target_squares: string[];
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}

/** Yeni format (P4): SAN hamle dizisi — sporcu çizgiyi oynar. */
export interface MovePieceSequenceEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  moves: string[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
}

/**
 * İki format tek `type` değerini paylaşıyor; TypeScript bunları `in` operatörüyle
 * ayırır: `'moves' in exercise` pozitif dalda MovePieceSequenceEx'e, negatif dalda
 * MovePieceLegacyEx'e daraltır. Böylece eski format kodu tip güvenli kalır.
 */
export type MovePieceEx = MovePieceLegacyEx | MovePieceSequenceEx;
```

- [ ] **Step 2: Tip kontrolü çalıştır, `onSquareClick`'te hata bekleniyor**

Run: `cd apps/web && npx tsc --noEmit`
Expected: `BoardExercise.tsx` içinde `Property 'piece_square' does not exist on type 'MovePieceSequenceEx'` benzeri hatalar (satır ~249, ~255, ~259). Bu beklenen — bir sonraki adım düzeltiyor.

- [ ] **Step 3: `onSquareClick`'teki eski format dalına daraltma ekle**

`BoardExercise.tsx`'te mevcut:

```ts
    if (exercise.type === 'move_piece') {
      if (!selected) {
        if (square === exercise.piece_square) {
```

satırını şununla değiştir (yeni format soruların tahtası burada hiç render
edilmiyor — MovePieceSolver kendi tahtasını çiziyor — ama TypeScript'in
bunu bilmesi için açık daraltma gerekiyor):

```ts
    if (exercise.type === 'move_piece' && !('moves' in exercise)) {
      if (!selected) {
        if (square === exercise.piece_square) {
```

- [ ] **Step 4: Tip kontrolü tekrar**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 5: Mevcut testler bozulmadı mı**

Run: `cd apps/web && npx vitest run tests/board-exercise-move-piece-placeholder.test.tsx tests/board-exercise-click-square.test.tsx tests/board-exercise-render.test.tsx`
Expected: Hepsi PASS (placeholder 4, click_square 13, render 5).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx
git commit -m "refactor: MovePieceEx ayrık birleşime bölündü (eski/yeni format tip güvenliği)"
```

---

## Task 4: `MovePieceSolver` bileşeni

**Files:**
- Create: `apps/web/components/lesson-steps/MovePieceSolver.tsx`
- Test: `apps/web/tests/move-piece-solver.test.tsx` (yeni)

- [ ] **Step 1: Testi yaz (FAIL bekleniyor — modül yok)**

`apps/web/tests/move-piece-solver.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MovePieceSolver } from '@/components/lesson-steps/MovePieceSolver';
import type { MovePieceSequenceEx } from '@/components/lesson-steps/BoardExercise';

const TWO_SIDED: MovePieceSequenceEx = {
  type: 'move_piece',
  instruction: 'Taktigi oyna',
  fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
  moves: ['Rh4', 'Kf8'],
};

const KINGLESS: MovePieceSequenceEx = {
  type: 'move_piece',
  instruction: 'Piyonu ilerlet',
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  moves: ['e4'],
};

function clickSquare(container: HTMLElement, square: string) {
  fireEvent.click(container.querySelector(`[data-square="${square}"]`)!);
}

describe('MovePieceSolver', () => {
  it('tahtayı 64 kareyle render eder', () => {
    const { container } = render(
      <MovePieceSolver exercise={TWO_SIDED} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('ŞAHSIZ öğretim pozisyonunda çökmeden render eder', () => {
    const { container } = render(
      <MovePieceSolver exercise={KINGLESS} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('YANLIŞ hamlede onWrong çağrılır, onSolved çağrılmaz', () => {
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <MovePieceSolver exercise={TWO_SIDED} disabled={false} onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'f4'); // kaleyi seç
    clickSquare(container, 'f5'); // legal ama anahtarda yok
    expect(onWrong).toHaveBeenCalledTimes(1);
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('KURAL DIŞI hamlede ne onWrong ne onSolved çağrılır (ceza yok)', () => {
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <MovePieceSolver exercise={TWO_SIDED} disabled={false} onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'f4'); // kaleyi seç
    clickSquare(container, 'e5'); // kale çapraz gidemez → ChessBoard geçerli hedef saymaz
    expect(onWrong).not.toHaveBeenCalled();
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('disabled iken tıklama hiçbir callback tetiklemez', () => {
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <MovePieceSolver exercise={TWO_SIDED} disabled onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'f4');
    clickSquare(container, 'h4');
    expect(onWrong).not.toHaveBeenCalled();
    expect(onSolved).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/move-piece-solver.test.tsx`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: Bileşeni oluştur**

`apps/web/components/lesson-steps/MovePieceSolver.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { StockfishEngine } from '@/lib/chess/stockfish';
import {
  playerState, tryStudentMove, opponentKeyMove, isSequenceComplete, appendUciMove,
} from '@/lib/chess/movePlayer';
import type { MovePieceSequenceEx } from './BoardExercise';

/** Rakibin cevabı gözle takip edilebilsin diye kısa gecikme (PuzzleSolver ile aynı). */
const OPPONENT_DELAY_MS = 450;
/** Çocuk dostu hız için düşük derinlik (BotGame ile aynı varsayılan). */
const ENGINE_DEPTH = 8;

interface Props {
  exercise: MovePieceSequenceEx;
  /** Soru cevaplanmışsa tahta etkileşimsiz olur. */
  disabled: boolean;
  onSolved: () => void;
  onWrong: (msg: string) => void;
}

export function MovePieceSolver({ exercise, disabled, onSolved, onWrong }: Props) {
  const [playedMoves, setPlayedMoves] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const engineRef = useRef<StockfishEngine | null>(null);

  // Bileşen kaldırılırken motoru kapat — worker sızıntısı olmasın.
  useEffect(() => () => {
    engineRef.current?.destroy();
    engineRef.current = null;
  }, []);

  const state = playerState(exercise.fen, playedMoves);
  const studentSide = playerState(exercise.fen, []).turn;

  /** Rakibin cevabı: önce cevap anahtarı, yoksa motor. */
  async function playOpponentReply(afterStudent: string[]) {
    const keyMove = opponentKeyMove(exercise.moves, afterStudent);
    if (keyMove) {
      const next = [...afterStudent, keyMove];
      setPlayedMoves(next);
      if (isSequenceComplete(exercise.moves, next)) onSolved();
      return;
    }

    // Anahtarda rakip cevabı yok → motora sor.
    setThinking(true);
    try {
      if (!engineRef.current) {
        engineRef.current = new StockfishEngine();
        await engineRef.current.init();
      }
      const fenNow = playerState(exercise.fen, afterStudent).fen;
      const uci = await engineRef.current.bestMove(fenNow, ENGINE_DEPTH);
      const next = appendUciMove(exercise.fen, afterStudent, uci);
      if (next) {
        setPlayedMoves(next);
        if (isSequenceComplete(exercise.moves, next)) onSolved();
      } else {
        // Motor hamle üretemedi ("(none)") → rakibin hamlesi yok, soru tamamlandı.
        onSolved();
      }
    } catch {
      // Motor yüklenemedi/hata verdi → soruyu güvenle tamamla, çökme yok.
      onSolved();
    } finally {
      setThinking(false);
    }
  }

  /** ChessBoard hem sürüklemeyi hem tıkla-tıkla akışını buraya yönlendirir. */
  function handleMove(from: Square, to: Square): boolean {
    if (disabled || thinking) return false;

    const result = tryStudentMove(exercise.fen, exercise.moves, playedMoves, from, to);

    if (result.kind === 'illegal') return false; // taş yerine döner, ceza yok
    if (result.kind === 'wrong') {
      onWrong(exercise.fail_msg ?? 'Bu hamle doğru değil.');
      return false;
    }

    setPlayedMoves(result.playedMoves);
    if (isSequenceComplete(exercise.moves, result.playedMoves)) {
      onSolved();
      return true;
    }
    setTimeout(() => { void playOpponentReply(result.playedMoves); }, OPPONENT_DELAY_MS);
    return true;
  }

  return (
    <div className="space-y-2">
      <ChessBoard
        fen={state.fen}
        interactive={!disabled && !thinking}
        onPieceDrop={handleMove}
        boardOrientation={studentSide === 'w' ? 'white' : 'black'}
      />
      {thinking && (
        <p className="text-xs" style={{ color: 'var(--t-muted)' }}>Rakip düşünüyor…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/move-piece-solver.test.tsx`
Expected: 5 test PASS.

- [ ] **Step 5: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/MovePieceSolver.tsx apps/web/tests/move-piece-solver.test.tsx
git commit -m "feat: MovePieceSolver — sporcu hamle çözüm ekranı (anahtar + motor yedeği)"
```

---

## Task 5: `BoardExercise` entegrasyonu — placeholder yerine gerçek çözücü

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-move-piece-placeholder.test.tsx` (mevcut, güncellenir)

- [ ] **Step 1: Mevcut placeholder testini yeni davranışa göre güncelle**

`apps/web/tests/board-exercise-move-piece-placeholder.test.tsx` dosyasında,
ilk iki testi (placeholder bekleyenler) şununla değiştir — dosyanın geri
kalanı (eski format regresyon testleri) **aynen kalır**:

```tsx
describe('BoardExercise — yeni format move_piece gerçek çözücüyle render edilir', () => {
  it('yeni format (moves alanlı) soru için çözüm tahtası render edilir', () => {
    const { container } = render(
      <BoardExercise exercises={[newFormat]} done={false} onCorrect={vi.fn()} />,
    );
    // Artık placeholder değil, gerçek tahta çiziliyor
    expect(screen.queryByText(/yakında aktif olacak/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('yeni format soru render edilirken çökmez (styles guard)', () => {
    expect(() =>
      render(<BoardExercise exercises={[newFormat]} done={false} onCorrect={vi.fn()} />),
    ).not.toThrow();
  });
```

(Dosyanın başındaki `newFormat`/`oldFormat` tanımları ve son iki regresyon
testi değişmez. `newFormat`'taki `as unknown as BoardExerciseConfig` cast'i
artık gereksiz — Task 3'te tip düzeltildi — ama kaldırmak zorunlu değil;
kaldırılırsa `as BoardExerciseConfig` yeterli olur.)

- [ ] **Step 2: Testi çalıştır, FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/board-exercise-move-piece-placeholder.test.tsx`
Expected: 1. test FAIL (hâlâ placeholder gösteriliyor, 0 kare). Diğerleri PASS.

- [ ] **Step 3: `MovePieceSolver`'ı import et**

`apps/web/components/lesson-steps/BoardExercise.tsx`'in import bloğuna ekle:

```ts
import { MovePieceSolver } from './MovePieceSolver';
```

- [ ] **Step 4: Placeholder dalını gerçek çözücüyle değiştir**

Mevcut:

```tsx
      {exercise.type === 'move_piece' && 'moves' in exercise ? (
        <div className="flex items-center gap-3 py-3 px-4 rounded-xl"
          style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
          <span className="text-xl leading-none flex-shrink-0">🚧</span>
          <p className="text-sm font-semibold flex-1">Bu soru türü yakında aktif olacak.</p>
        </div>
      ) : isBoardExercise(exercise) ? (
```

şununla değiştir:

```tsx
      {exercise.type === 'move_piece' && 'moves' in exercise ? (
        <>
          <MovePieceSolver
            exercise={exercise}
            disabled={status !== 'idle'}
            onSolved={() => succeed()}
            onWrong={(msg) => failNoRetry(msg)}
          />
          {/* Talimat — tahtanın altında kart olarak (diğer tiplerle aynı stil) */}
          <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
            style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
            <span className="text-xl leading-none flex-shrink-0">🎯</span>
            <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
          </div>
        </>
      ) : isBoardExercise(exercise) ? (
```

`succeed()` ve `failNoRetry()` P3'te yazılmış mevcut fonksiyonlardır —
**değiştirilmez**. Böylece ilerleme noktaları, "Sonraki Soru" butonu, soru
kodu rozeti ve terminal ekran davranışı diğer soru tipleriyle aynı kalır.

- [ ] **Step 5: Testleri tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/board-exercise-move-piece-placeholder.test.tsx`
Expected: 4 test PASS.

- [ ] **Step 6: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-move-piece-placeholder.test.tsx
git commit -m "feat: Taşı Oynat sporcu tarafı aktif — placeholder yerine gerçek çözücü"
```

---

## Task 6: Tam test kapısı

**Files:** Yok (sadece doğrulama)

- [ ] **Step 1: Frontend tüm testler**

Run: `cd apps/web && npx vitest run`
Expected: Tüm test dosyaları PASS (P1-P4'ten kalan 129 test + bu işin ~31 yeni testi).

- [ ] **Step 2: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 3: Lint**

Run: `cd apps/web && npx next lint`
Expected: `Error:` satırı yok (mevcut önceden var olan uyarılar kabul edilebilir).

- [ ] **Step 4: Production build**

Run: `cd apps/web && npm run build`
Expected: `Compiled successfully`, hata yok.

- [ ] **Step 5: Backend testleri (dokunulmadı ama regresyon kontrolü)**

Run: `cd apps/api && python -m pytest -q`
Expected: 195 test PASS.

- [ ] **Step 6: Herhangi bir adım başarısız olursa**

İlgili göreve dön, düzelt, o görevin testlerini tekrar çalıştır, sonra bu görevi baştan çalıştır.

---

## Task 7: Canlı doğrulama (KURAL #6)

**Files:** Yok (tarayıcı + prod API doğrulaması)

- [ ] **Step 1: Yerel dev sunucuyu prod API'ye karşı başlat**

`apps/web/.env.local` oluştur:
```
NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app
```
Dev sunucuyu `mcp__Claude_Browser__preview_start` (`chess-web`) ile başlat.

- [ ] **Step 2: Geçici test verisi + iki soru oluştur**

```bash
API=https://chess-app-production-1dab.up.railway.app
EMAIL="verifyp5_$(date +%s)@gmail.com"
SIGNUP=$(curl -s -X POST "$API/auth/teacher/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Verify P5\"}")
TOKEN=$(python -c "import json,sys;print(json.loads(sys.argv[1])['access_token'])" "$SIGNUP")
MOD=$(curl -s -X POST "$API/admin/modules" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"TEST_P5_DUZEY","description":"gecici","icon":"T"}')
MODID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$MOD")
LES=$(curl -s -X POST "$API/admin/modules/$MODID/lessons" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"TEST_P5_DERS","estimated_minutes":5}')
LESID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$LES")
STEP=$(curl -s -X POST "$API/admin/lessons/$LESID/steps" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"explanation","content_json":{"title":"Test Alt Konu","body":"test"}}')
STEPID=$(python -c "import json,sys;print(json.loads(sys.argv[1])['id'])" "$STEP")
echo "TOKEN=$TOKEN"; echo "MODID=$MODID LESID=$LESID STEPID=$STEPID"
```

Ardından iki soru yaz (biri iki taraflı çoklu hamle, biri şahsız tek hamle —
motor yedeğini tetiklemek için). `chess-app` kök dizininde:

```bash
# DİKKAT: SAN'lar chess.js'in ürettiği KANONİK formda olmalı — şah (+) ve mat (#)
# ekleri dahil. Ölçüldü: bu dizinin son hamlesi 'Rh8' DEĞİL 'Rh8#' (mat).
# Eksik ek yazılırsa sporcunun hamlesi eşleşmez ve yanlış sayılır.
cat > p5_sorular.json << 'EOF'
{"content_json":{"title":"Test Alt Konu","body":"test","board_exercises":[
  {"type":"move_piece","instruction":"Kaleyi h4'e getir, sonra mat et","fen":"6k1/8/5K2/8/5R2/8/8/8 w - - 0 1","moves":["Rh4","Kf8","Rh8#"]},
  {"type":"move_piece","instruction":"Piyonu iki kare ilerlet","fen":"8/4p3/8/8/8/8/4P3/8 w - - 0 1","moves":["e4"]}
]}}
EOF
curl -s -o /dev/null -w "HTTP:%{http_code}\n" -X PATCH "$API/admin/steps/$STEPID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" --data-binary @p5_sorular.json
rm -f p5_sorular.json
```
Expected: `HTTP:200`

- [ ] **Step 3: Tarayıcıda sporcu ekranını aç ve çoklu hamleyi TIKLAYARAK çöz**

`localStorage.setItem('chess_app_token', TOKEN)` ile giriş yapıp
`/pratik/suresiz?step={STEPID}&ders={LESID}&konu=Test` adresine git.
İlk soruda kaleye tıkla, sonra `h4` karesine tıkla → hamlenin oynandığını
ve kısa süre sonra **rakibin (siyah şah) otomatik cevap verdiğini** doğrula.
Sonra kaleye tıklayıp `h8`'e tıkla → "Aferin" ve "Sonraki Soru" butonunun
çıktığını doğrula.

- [ ] **Step 4: ŞAHSIZ pozisyon + MOTOR yedeğini doğrula**

"Sonraki Soru" ile ikinci soruya geç (şahsız pozisyon, tek hamlelik anahtar).
Beyaz piyona tıkla → `e4`'e tıkla. Doğrula:
- Tıkla-oynat **çalışıyor** (ChessBoard düzeltmesinin kanıtı — düzeltme
  olmasaydı piyon hiç seçilemezdi)
- "Rakip düşünüyor…" yazısı görünüp kayboluyor ve **siyah piyon otomatik
  oynuyor** (motor yedeğinin kanıtı — anahtarda siyahın cevabı yoktu)
- Ardından "Aferin" görünüyor

- [ ] **Step 5: YANLIŞ hamle davranışını doğrula**

Sayfayı yenile (soru havuzu yeniden karışır; gerekirse ilk soruya gel).
Kaleyi anahtarda olmayan bir kareye götür → geri bildirim mesajının
çıktığını ve **"Sonraki Soru" butonunun göründüğünü** (tekrar deneme
olmadığını) doğrula.

- [ ] **Step 6: REGRESYON — Bota Karşı Oyna bozulmadı mı**

`/play` sayfasına git, bota karşı bir oyun başlat ve **bir hamle oyna**.
Hamlenin çalıştığını ve botun cevap verdiğini doğrula. (Bu, `ChessBoard`
düzeltmesinin mevcut özellikleri bozmadığının canlı kanıtıdır — spec'te
belirtildiği gibi bu üç bileşenin otomatik testi yok.)

- [ ] **Step 7: REGRESYON — eski format Taşı Oynat sorusu**

Canlıdaki mevcut eski formatlı `move_piece` sorusunun (Temel Düzey →
Tahta ve Taşlar) hâlâ eskisi gibi çalıştığını doğrula.

- [ ] **Step 8: Test verisini temizle**

```bash
curl -s -X DELETE "$API/admin/lessons/$LESID" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "$API/admin/modules/$MODID" -H "Authorization: Bearer $TOKEN"
curl -s "$API/modules" | python -c "
import json,sys
d=json.load(sys.stdin)
print('TEST_P5_DUZEY hala var mi:', any(m.get('name')=='TEST_P5_DUZEY' for m in d))
"
```
Expected: `False`

- [ ] **Step 9: Yerel ortamı temizle**

`apps/web/.env.local` dosyasını sil, dev sunucuyu durdur.

- [ ] **Step 10: Sonucu kullanıcıya raporla**

Ne test edildi, ne doğrulandı, **neyi doğrulayamadın** — açıkça yaz (KURAL #6).

---

## Self-Review Notu (plan yazarı için)

- **Spec kapsaması:** ChessBoard düzeltmesi (Task 1), saf mantık + rok/geçerken
  alma/terfi (Task 2), tip modeli ayrık birleşim (Task 3), sporcu arayüzü +
  motor yedeği (Task 4), BoardExercise entegrasyonu (Task 5), test kapısı
  (Task 6), canlı doğrulama (Task 7) — spec'in tüm bölümleri karşılanıyor.
- **Ölçülmüş varsayımlar:** 5 teknik gerçek (Stockfish'in şahsız pozisyonda
  çalışması, ChessBoard'un sessiz hatası, chess.js skipValidation zorunluluğu,
  ChessBoard'un tek callback kullanması, sağlayıcısız test edilebilirliği)
  plan yazılmadan ÖNCE gerçek ortamda çalıştırılarak doğrulandı.
- **Tip tutarlılığı:** `playerState`/`expectedStudentMove`/`tryStudentMove`/
  `opponentKeyMove`/`isSequenceComplete`/`appendUciMove`/`StudentMoveResult`/
  `PlayerState` isimleri Task 2'de tanımlanıp Task 4'te aynen kullanılıyor.
  `MovePieceSequenceEx`/`MovePieceLegacyEx` Task 3'te tanımlanıp Task 4-5'te
  aynen kullanılıyor.
- **Sıra bağımlılığı:** Task 1 (ChessBoard düzeltmesi) EN BAŞTA — Task 4'teki
  tıkla-oynat şahsız pozisyonlarda onsuz çalışmaz. Task 3 (tip) Task 4'ten
  önce gelmeli, aksi halde `MovePieceSequenceEx` tipi mevcut olmaz.
- **Bilinen sınır (dürüstlük):** Sürükle-bırak (dnd-kit) test ortamında
  güvenilir simüle edilemiyor; bu yüzden testler **tıkla-tıkla** yolunu
  kullanıyor (ikisi de aynı `onPieceDrop` callback'ine gittiği için mantık
  kapsanıyor — `ChessBoard.tsx:110` ile doğrulandı). Gerçek sürükleme Task 7'de
  tarayıcıda elle denenir.
- **Bilinen sınır (dürüstlük):** `MovePieceSolver`'ın motor yolu birim testinde
  kapsanmıyor (Stockfish worker'ı jsdom/happy-dom'da çalışmaz). Motor mantığı
  `appendUciMove` üzerinden saf fonksiyon olarak test ediliyor; gerçek motor
  entegrasyonu Task 7 Step 4'te canlıda doğrulanıyor.

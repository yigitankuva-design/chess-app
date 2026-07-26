# Admin "Yeni Soru" İyileştirmeleri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panelindeki "Yeni Soru" formunda ve sporcunun gördüğü tahtada 7 bağımsız küçük iyileştirme: sağ-tık kare renklendirme (odaklanma aracı), hizalama/boyut düzeltmeleri, zorluk düzeyi etiketleri, Ctrl+V ile görsel yapıştırma.

**Architecture:** Sağ-tık renklendirme paylaşılan bir saf hook (`useSquareAnnotations`) olarak yazılır ve hem `BoardEditor.tsx` (admin) hem `ChessBoard.tsx` (sporcu, tüm kullanım yerlerine otomatik yayılır) içinde kullanılır. Diğer maddeler (c, d, e, f, g) birbirinden bağımsız, tek dosyalık CSS/UI değişiklikleridir.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind, react-chessboard, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-26-yeni-soru-admin-polish-design.md`

---

## Dosya yapısı

| Dosya | Değişiklik |
|---|---|
| `apps/web/lib/chess/useSquareAnnotations.ts` (YENİ) | Sağ-tık renklendirme saf hook'u |
| `apps/web/components/BoardEditor.tsx` | Hook entegrasyonu + buton ortalama (c) |
| `apps/web/components/ChessBoard.tsx` | Hook entegrasyonu |
| `apps/web/components/admin/ExerciseForm.tsx` | Kare isimleri büyütme (d) + zorluk Kolay/Orta/Zor (e) |
| `apps/web/components/admin/ChoiceExerciseFields.tsx` | Zorluk Kolay/Orta/Zor (e) + Ctrl+V yapıştırma (g) |
| `apps/web/app/admin/content/lesson/[lessonId]/page.tsx` | Dairesel kart küçültme (f) |

**Sıra:** Önce hook + testleri (Task 1), sonra iki tahtaya entegrasyon (Task 2-3), sonra bağımsız CSS/UI maddeleri (Task 4-7), en son Ctrl+V (Task 8, en karmaşık DOM etkileşimi).

---

## Ölçülen gerçekler (varsayım değil)

Bu plan yazılırken aşağıdakiler `react-chessboard` kaynağı okunarak ve happy-dom
içinde gerçek bir sonda testiyle **ölçüldü**; implementer bunlara güvenebilir:

1. **`fireEvent.contextMenu(square)` gerçekten `onSquareRightClick` tetikliyor.**
   Ölçüm çıktısı: `onSquareRightClick calls: [[{"piece":null,"square":"e4"}]]`
2. **`squareStyles` kareye değil, karenin İÇİNDEKİ overlay div'e uygulanıyor.**
   Ölçülen DOM: `<div data-square="e4" style="...background-color: #F0D9B5;"><div style="width:100%;height:100%;background-color: rgba(74, 222, 128, 0.55);"></div></div>`
   → testlerde `square.querySelector('div')` hedeflenmeli, `square`'in kendisi değil.
3. **happy-dom `rgba(74, 222, 128, 0.55)` değerini aynen koruyor** (yeniden
   biçimlendirmiyor) → tam string eşitliği (`toBe`) güvenli.
4. **Ok çizme özelliği sağ-tıkı yutmuyor.** Kütüphanede `isDrawingArrow`
   yalnızca sağ-tık **farklı bir kareye sürüklendiğinde** true oluyor
   (`index.esm.js:5431-5437`); aynı kareye sade sağ-tıkta `onSquareRightClick`
   normal çalışıyor.

---

## Task 1: `useSquareAnnotations` — saf hook

**Files:**
- Create: `apps/web/lib/chess/useSquareAnnotations.ts`
- Test: `apps/web/tests/use-square-annotations.test.tsx`

**Not:** Bu bir React hook'u olduğu için saf birim testi `@testing-library/react`'in
`renderHook` yardımcısıyla yazılır (projede zaten `@testing-library/react`
kurulu).

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/use-square-annotations.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSquareAnnotations } from '@/lib/chess/useSquareAnnotations';

/** Ctrl/Alt tuşlarını BASILI TUTAR (sağ tık ayrı çağrılır). Hook bu durumu
 *  window keydown/keyup ile takip ediyor. */
function holdModifiers(mods: { ctrlKey?: boolean; altKey?: boolean } = {}) {
  if (mods.ctrlKey) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
  if (mods.altKey) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
}

function releaseModifiers() {
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
}

describe('useSquareAnnotations', () => {
  afterEach(() => releaseModifiers());

  it('sade sağ-tık kareyi yeşil yapar', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(74, 222, 128, 0.55)');
  });

  it('Ctrl+sağ-tık kareyi kırmızı yapar', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    holdModifiers({ ctrlKey: true });
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(248, 113, 113, 0.55)');
  });

  it('Alt+sağ-tık kareyi mavi yapar', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    holdModifiers({ altKey: true });
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(96, 165, 250, 0.55)');
  });

  it('Ctrl+Alt+sağ-tık kareyi sarı yapar', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    holdModifiers({ ctrlKey: true, altKey: true });
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(250, 204, 21, 0.55)');
  });

  it('aynı kareye aynı renkle tekrar sağ-tık işareti temizler (toggle)', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4).toBeDefined();
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4).toBeUndefined();
  });

  it('farklı renkle tekrar sağ-tık üzerine yazar (temizlemez)', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' })); // yeşil
    holdModifiers({ ctrlKey: true });
    act(() => result.current.onSquareRightClick({ square: 'e4' })); // kırmızı
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(248, 113, 113, 0.55)');
  });

  it('resetKey değişince tüm işaretler temizlenir', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useSquareAnnotations(key),
      { initialProps: { key: 'r1' } },
    );
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4).toBeDefined();
    rerender({ key: 'r2' });
    expect(result.current.squareStyles.e4).toBeUndefined();
  });

  it('birden fazla kare bağımsız işaretlenebilir', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    holdModifiers({ ctrlKey: true });
    act(() => result.current.onSquareRightClick({ square: 'd5' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(74, 222, 128, 0.55)');
    expect(result.current.squareStyles.d5?.backgroundColor).toBe('rgba(248, 113, 113, 0.55)');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/use-square-annotations.test.tsx`
Beklenen: FAIL — `Failed to resolve import "@/lib/chess/useSquareAnnotations"`

- [ ] **Step 3: Hook'u yaz**

`apps/web/lib/chess/useSquareAnnotations.ts`:

```ts
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export type AnnotationColor = 'green' | 'red' | 'blue' | 'yellow';

const COLORS: Record<AnnotationColor, string> = {
  green: 'rgba(74, 222, 128, 0.55)',
  red: 'rgba(248, 113, 113, 0.55)',
  blue: 'rgba(96, 165, 250, 0.55)',
  yellow: 'rgba(250, 204, 21, 0.55)',
};

function colorForModifiers(ctrl: boolean, alt: boolean): AnnotationColor {
  if (ctrl && alt) return 'yellow';
  if (ctrl) return 'red';
  if (alt) return 'blue';
  return 'green';
}

/**
 * Sağ-tık ile kare renklendirme — Zafer Hoca ve sporcunun tahtada hesap
 * yaparken odaklanmak için kullandığı TAMAMEN GEÇİCİ bir görsel araç.
 * Hiçbir yere kaydedilmez, hiçbir soru verisini etkilemez.
 *
 * Sade sağ-tık: yeşil · Ctrl+sağ-tık: kırmızı · Alt+sağ-tık: mavi ·
 * Ctrl+Alt+sağ-tık: sarı. Aynı kareye aynı renkle tekrar tıklamak temizler.
 *
 * resetKey değiştiğinde (örn. FEN değişince/yeni soru açılınca) tüm
 * işaretler otomatik temizlenir — eski işaretler yeni bağlamı yanıltmasın.
 */
export function useSquareAnnotations(resetKey: unknown): {
  squareStyles: Record<string, CSSProperties>;
  onSquareRightClick: (args: { square: string }) => void;
} {
  const [marks, setMarks] = useState<Record<string, AnnotationColor>>({});
  const ctrlDown = useRef(false);
  const altDown = useRef(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Control') ctrlDown.current = true;
      if (e.key === 'Alt') altDown.current = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Control') ctrlDown.current = false;
      if (e.key === 'Alt') altDown.current = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMarks({}); }, [resetKey]);

  const onSquareRightClick = useCallback(({ square }: { square: string }) => {
    const color = colorForModifiers(ctrlDown.current, altDown.current);
    setMarks((prev) => {
      if (prev[square] === color) {
        const next = { ...prev };
        delete next[square];
        return next;
      }
      return { ...prev, [square]: color };
    });
  }, []);

  const squareStyles: Record<string, CSSProperties> = {};
  for (const [sq, color] of Object.entries(marks)) {
    squareStyles[sq] = { backgroundColor: COLORS[color] };
  }

  return { squareStyles, onSquareRightClick };
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/use-square-annotations.test.tsx`
Beklenen: PASS — 8 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/chess/useSquareAnnotations.ts apps/web/tests/use-square-annotations.test.tsx
git commit -m "feat: sag-tik kare renklendirme saf hook'u (odaklanma araci)"
```

---

## Task 2: `BoardEditor.tsx` — sağ-tık entegrasyonu + buton ortalama (c)

**Files:**
- Modify: `apps/web/components/BoardEditor.tsx`
- Test: `apps/web/tests/board-editor-annotations.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/board-editor-annotations.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { BoardEditor } from '@/components/BoardEditor';

describe('BoardEditor — sağ-tık renklendirme', () => {
  it('bir kareye sağ tıklamak o kareyi yeşil boyar', () => {
    const { container } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()} />,
    );
    const square = container.querySelector('[data-square="e4"]') as HTMLElement;
    fireEvent.contextMenu(square);
    // squareStyles inner overlay div'e uygulanıyor (P3'te ölçülmüş react-chessboard davranışı)
    const overlay = square.querySelector('div');
    expect(overlay?.style.backgroundColor).toBe('rgba(74, 222, 128, 0.55)');
  });
});

describe('BoardEditor — buton ortalama', () => {
  it('Başlangıç konumu/Tahtayı temizle satırı justify-center içerir', () => {
    const { container } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()} />,
    );
    const row = [...container.querySelectorAll('div')].find(
      (d) => d.textContent === 'Başlangıç konumuTahtayı temizle',
    );
    expect(row?.className).toMatch(/justify-center/);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/board-editor-annotations.test.tsx`
Beklenen: FAIL — sağ-tık testi `overlay?.style.backgroundColor` boş string bekler ama gerçek değer `undefined`/boş olacak; ortalama testi `justify-center` bulamaz

- [ ] **Step 3: `BoardEditor.tsx`'i güncelle**

Import satırının (satır 8) ALTINA ekle:

```ts
import { useSquareAnnotations } from '@/lib/chess/useSquareAnnotations';
```

`BoardEditor` fonksiyonu içinde `const [selectedPaletteKey, setSelectedPaletteKey] = useState<string | null>(null);`
satırının (satır 87) ALTINA ekle:

```ts
  const { squareStyles: annotationStyles, onSquareRightClick } = useSquareAnnotations(fen);
```

`ChessboardProvider` options objesine (satır 141-153), `onSquareClick: handleSquareClick,`
satırının ALTINA ekle:

```ts
        onSquareRightClick,
        squareStyles: annotationStyles,
```

Buton satırını (satır 214) değiştir:

```tsx
      <div className="flex flex-wrap items-center gap-2">
```
→
```tsx
      <div className="flex flex-wrap items-center justify-center gap-2" style={{ maxWidth: 440 }}>
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/board-editor-annotations.test.tsx`
Beklenen: PASS — 2 test

- [ ] **Step 5: Mevcut BoardEditor testlerinin bozulmadığını doğrula (regresyon)**

Çalıştır: `cd apps/web && npx vitest run tests/board-editor.test.ts tests/board-editor-click-add.test.tsx`
Beklenen: Tümü PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/BoardEditor.tsx apps/web/tests/board-editor-annotations.test.tsx
git commit -m "feat: BoardEditor sag-tik renklendirme + buton ortalama"
```

---

## Task 3: `ChessBoard.tsx` — sağ-tık entegrasyonu

**Files:**
- Modify: `apps/web/components/ChessBoard.tsx`
- Test: `apps/web/tests/chess-board-annotations.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/chess-board-annotations.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

describe('ChessBoard — sağ-tık renklendirme', () => {
  it('bir kareye Ctrl+sağ-tık o kareyi kırmızı boyar', () => {
    const { container } = render(
      <ChessBoard fen="8/8/8/8/8/8/8/8 w - - 0 1" />,
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    const square = container.querySelector('[data-square="d5"]') as HTMLElement;
    fireEvent.contextMenu(square);
    const overlay = square.querySelector('div');
    expect(overlay?.style.backgroundColor).toBe('rgba(248, 113, 113, 0.55)');
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
    expect(overlay?.style.backgroundColor).not.toBe('rgba(74, 222, 128, 0.55)');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/chess-board-annotations.test.tsx`
Beklenen: FAIL

- [ ] **Step 3: `ChessBoard.tsx`'i güncelle**

Import satırının (satır 12) ALTINA ekle:

```ts
import { useSquareAnnotations } from '@/lib/chess/useSquareAnnotations';
```

`ChessBoard` fonksiyonu içinde `const scrollLockRef = useRef<ReturnType<typeof setTimeout> | null>(null);`
satırının (satır 43) ALTINA ekle:

```ts
  const { squareStyles: annotationStyles, onSquareRightClick } = useSquareAnnotations(fen);
```

`const squareStyles = buildSquareStyles(theme, overrides, { light: boardColors.light, dark: boardColors.dark });`
satırını (satır 173) şu hale getir — anotasyonlar EN ÜSTTE, kullanıcının bilinçli
işareti diğer otomatik vurgulardan (son hamle, geçerli hamle noktaları vb.) önce
görünsün:

```ts
  const squareStyles = {
    ...buildSquareStyles(theme, overrides, { light: boardColors.light, dark: boardColors.dark }),
  };
  for (const [sq, style] of Object.entries(annotationStyles)) {
    squareStyles[sq] = { ...squareStyles[sq], ...style };
  }
```

`<Chessboard options={{` içindeki `squareStyles,` satırının (satır 219) ÜSTÜNE ekle:

```ts
              onSquareRightClick,
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/chess-board-annotations.test.tsx`
Beklenen: PASS — 2 test

- [ ] **Step 5: Mevcut ChessBoard testlerinin bozulmadığını doğrula (regresyon)**

Çalıştır: `cd apps/web && npx vitest run tests/chess-board.test.tsx tests/chess-board-kingless.test.tsx`
Beklenen: Tümü PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/ChessBoard.tsx apps/web/tests/chess-board-annotations.test.tsx
git commit -m "feat: ChessBoard sag-tik renklendirme (tum sporcu ekranlarina yayilir)"
```

---

## Task 4: "Doğru kare(ler)" isimlerini %50 büyüt (madde d)

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Test: `apps/web/tests/exercise-form-square-picker-size.test.tsx`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/exercise-form-square-picker-size.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — SquarePicker kare boyutu', () => {
  it('kare butonları text-[15px] class ile render edilir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={{ type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: [] }} />);
    const btn = screen.getByText('e4');
    expect(btn.className).toMatch(/text-\[15px\]/);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/exercise-form-square-picker-size.test.tsx`
Beklenen: FAIL — class `text-[10px]` içeriyor, `text-[15px]` değil

- [ ] **Step 3: `ExerciseForm.tsx`'i güncelle**

Satır 64'teki class'ı değiştir:

```tsx
                className={`text-[10px] py-1 rounded transition-colors ${
```
→
```tsx
                className={`text-[15px] py-1.5 rounded transition-colors ${
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/exercise-form-square-picker-size.test.tsx`
Beklenen: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/exercise-form-square-picker-size.test.tsx
git commit -m "feat: Dogru kare(ler) isimlerini %50 buyut"
```

---

## Task 5: Zorluk düzeyi — Kolay/Orta/Zor (madde e)

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Create: `apps/web/lib/difficultyLabels.ts`
- Test: `apps/web/tests/difficulty-labels.test.ts`
- Test: `apps/web/tests/difficulty-buttons.test.tsx`

- [ ] **Step 1: Saf mantık testini yaz (başarısız olacak)**

`apps/web/tests/difficulty-labels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DIFFICULTY_LABELS, nearestDifficultyValue } from '@/lib/difficultyLabels';

describe('DIFFICULTY_LABELS', () => {
  it('üç etiket içerir: Kolay(1), Orta(3), Zor(5)', () => {
    expect(DIFFICULTY_LABELS).toEqual([[1, 'Kolay'], [3, 'Orta'], [5, 'Zor']]);
  });
});

describe('nearestDifficultyValue', () => {
  it('1 ve 2 → Kolay(1)', () => {
    expect(nearestDifficultyValue(1)).toBe(1);
    expect(nearestDifficultyValue(2)).toBe(1);
  });
  it('3 → Orta(3)', () => expect(nearestDifficultyValue(3)).toBe(3));
  it('4 ve 5 → Zor(5)', () => {
    expect(nearestDifficultyValue(4)).toBe(5);
    expect(nearestDifficultyValue(5)).toBe(5);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/difficulty-labels.test.ts`
Beklenen: FAIL — `Failed to resolve import "@/lib/difficultyLabels"`

- [ ] **Step 3: Saf mantığı yaz**

`apps/web/lib/difficultyLabels.ts`:

```ts
/**
 * Zorluk düzeyi veri modeli hâlâ 1-5 arası sayı (backward compat, KURAL #3).
 * UI'da üç etikete indirgenir; kullanıcı bir etikete BİLFİİL tıklamadıkça
 * var olan sayısal değer (örn. eski bir soruda 2 veya 4) değişmeden kalır.
 */
export const DIFFICULTY_LABELS: [number, string][] = [[1, 'Kolay'], [3, 'Orta'], [5, 'Zor']];

/** Bir sayısal zorluk değerini en yakın etiketin değerine eşler (sadece GÖRÜNTÜLEME için). */
export function nearestDifficultyValue(d: number): number {
  if (d <= 2) return 1;
  if (d === 3) return 3;
  return 5;
}
```

- [ ] **Step 4: Saf mantık testinin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/difficulty-labels.test.ts`
Beklenen: PASS — 5 test

- [ ] **Step 5: Bileşen testini yaz (başarısız olacak)**

`apps/web/tests/difficulty-buttons.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ExerciseForm — zorluk butonları', () => {
  it('Kolay/Orta/Zor butonları gösterilir, eski değer (2) Kolay olarak vurgulanır ama tıklanmadan değişmez', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExerciseForm onSubmit={onSubmit} initial={{
      type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      target_squares: ['e4'], difficulty: 2,
    }} />);
    expect(screen.getByText('Kolay')).toBeInTheDocument();
    expect(screen.getByText('Orta')).toBeInTheDocument();
    expect(screen.getByText('Zor')).toBeInTheDocument();
    expect(screen.getByText('Kolay').className).toMatch(/border-cyan-400/);
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    expect(onSubmit.mock.calls[0][0].difficulty).toBe(2); // tıklanmadı, eski değer korunur
  });

  it('Zor butonuna tıklanınca difficulty 5 olarak gönderilir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExerciseForm onSubmit={onSubmit} initial={{
      type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      target_squares: ['e4'], difficulty: 2,
    }} />);
    fireEvent.click(screen.getByText('Zor'));
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    expect(onSubmit.mock.calls[0][0].difficulty).toBe(5);
  });
});

describe('ChoiceExerciseFields — zorluk butonları', () => {
  it('Kolay/Orta/Zor butonları gösterilir', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    expect(screen.getByText('Kolay')).toBeInTheDocument();
    expect(screen.getByText('Orta')).toBeInTheDocument();
    expect(screen.getByText('Zor')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/difficulty-buttons.test.tsx`
Beklenen: FAIL — "Kolay"/"Orta"/"Zor" metinleri bulunamaz (hâlâ 1-5 butonları var)

- [ ] **Step 7: `ExerciseForm.tsx`'i güncelle**

Dosyanın en üstündeki import bloğuna ekle (satır 5'ten sonra):

```ts
import { DIFFICULTY_LABELS, nearestDifficultyValue } from '@/lib/difficultyLabels';
```

Satır 270-281 civarındaki (Sorunun Zorluk Düzeyini Belirle bloğu — `BoardExerciseFields`
içinde) 1-5 buton grubunu bul ve şu hale getir:

```tsx
      <div>
        <p className="text-xs n-muted mb-1">Sorunun Zorluk Düzeyini Belirle</p>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_LABELS.map(([val, label]) => (
            <button key={val} type="button" onClick={() => setDifficulty(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                nearestDifficultyValue(difficulty) === val ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{label}</button>
          ))}
        </div>
      </div>
```

(Not: değişkenin adı `difficulty`/`setDifficulty` değilse — dosyada mevcut
adlandırmayı bul ve onu kullan; state tanımı `BoardExerciseFields` içinde,
`ExerciseForm.tsx:131` civarında zaten var.)

- [ ] **Step 8: `ChoiceExerciseFields.tsx`'i güncelle**

Import bloğuna ekle (satır 4'ten sonra):

```ts
import { DIFFICULTY_LABELS, nearestDifficultyValue } from '@/lib/difficultyLabels';
```

Satır 183-194'teki bloğu değiştir:

```tsx
      <div>
        <p className="text-xs n-muted mb-1">Sorunun Zorluk Düzeyini Belirle</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)}
              className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                difficulty === d ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{d}</button>
          ))}
          <span className="text-xs n-muted self-center">1 en kolay · 5 en zor</span>
        </div>
      </div>
```
→
```tsx
      <div>
        <p className="text-xs n-muted mb-1">Sorunun Zorluk Düzeyini Belirle</p>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_LABELS.map(([val, label]) => (
            <button key={val} type="button" onClick={() => setDifficulty(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                nearestDifficultyValue(difficulty) === val ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{label}</button>
          ))}
        </div>
      </div>
```

- [ ] **Step 9: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/difficulty-buttons.test.tsx`
Beklenen: PASS — 3 test

**Not:** `ExerciseForm` testinde `screen.getByText('Kaydet')` kullanıldı — eğer
kaydet butonunun gerçek metni farklıysa (örn. "Ekle"/"Güncelle"), Step 6'da
testi çalıştırınca alınan gerçek hata mesajından doğru metni öğren ve testi
ona göre düzelt.

- [ ] **Step 10: Commit**

```bash
git add apps/web/lib/difficultyLabels.ts apps/web/components/admin/ExerciseForm.tsx apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/tests/difficulty-labels.test.ts apps/web/tests/difficulty-buttons.test.tsx
git commit -m "feat: zorluk duzeyi Kolay/Orta/Zor etiketleri (veri modeli 1-5 korunur)"
```

---

## Task 6: Dairesel soru kodu kartları — küçült + kod büyüt (madde f)

**Files:**
- Modify: `apps/web/app/admin/content/lesson/[lessonId]/page.tsx`

**Not:** Bu sayfa dinamik route + admin auth gerektirdiği için birim testi
kırılgan olur; doğrulaması Task 9'daki canlı tarayıcı sürüşüyle yapılır.

- [ ] **Step 1: Grid ve font-size'ı güncelle**

Satır 303 civarındaki grid tanımını bul:

```ts
gridTemplateColumns: 'repeat(10, minmax(0,1fr))'
```
→
```ts
gridTemplateColumns: 'repeat(12, minmax(0,1fr))'
```

Satır 314 civarındaki font-size inline style'ı bul:

```ts
fontSize: '0.65rem'
```
→
```ts
fontSize: '0.85rem'
```

- [ ] **Step 2: Tip kontrolü**

Çalıştır: `cd apps/web && npx tsc --noEmit`
Beklenen: Hatasız

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/admin/content/lesson/[lessonId]/page.tsx"
git commit -m "feat: dairesel soru kodu kartlarini kucult, kod numarasini buyut"
```

---

## Task 7: Canlı doğrulama öncesi tam test kapısı (a-f)

**Files:** (değişiklik yok — yalnızca doğrulama)

- [ ] **Step 1: Frontend kapısı**

Çalıştır: `cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run`
Beklenen: tsc hatasız; lint yalnızca önceden var olan uyarılar (`boardSkin.tsx`
`<img>` vb.); tüm vitest testleri PASS.

- [ ] **Step 2: Herhangi bir kapı kalırsa DUR**

Kırmızı varsa düzelt ve Step 1'den tekrar başla.

---

## Task 8: Ctrl+V ile görsel yapıştırma (madde g)

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Test: `apps/web/tests/choice-exercise-paste-image.test.tsx`

**ÖLÇÜLDÜ — bu testi yazarken dikkat:** `compressImageToDataUri`
(`lib/imageCompress.ts:27-34`) gerçek `new Image()` + `URL.createObjectURL`
kullanıyor; happy-dom'da sahte bir `File` **asla yüklenmez**, `onload` hiç
çalışmaz ve test takılır. Bu yüzden test, görsel sıkıştırma modülünü
`vi.mock` ile taklit eder — zaten `tests/image-compress.test.ts` sıkıştırmayı
ayrıca test ediyor. Buradaki testin amacı **"yapıştırılan dosya doğru şekilde
mevcut görsel hattına yönlendiriliyor mu"**, sıkıştırmanın kendisi değil.

Gerçek bir ekran görüntüsü yapıştırma Task 9'da tarayıcıda ayrıca doğrulanacak.

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`apps/web/tests/choice-exercise-paste-image.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// vi.mock hoisted — import'lardan önce çalışır.
vi.mock('@/lib/imageCompress', () => ({
  compressImageToDataUri: vi.fn(async () => 'data:image/jpeg;base64,FAKE'),
}));

import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';
import { compressImageToDataUri } from '@/lib/imageCompress';

function makeImageFile(): File {
  return new File(['fake-image-bytes'], 'clip.png', { type: 'image/png' });
}

beforeEach(() => vi.mocked(compressImageToDataUri).mockClear());

describe('ChoiceExerciseFields — Ctrl+V ile görsel yapıştırma', () => {
  it('yapıştırılan resim mevcut görsel hattına yönlendirilir ve önizleme çıkar', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    const pasteZone = screen.getByText(/Ctrl\+V ile yapıştır/);

    const file = makeImageFile();
    fireEvent.paste(pasteZone, {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => file }] },
    });

    await waitFor(() => {
      expect(vi.mocked(compressImageToDataUri)).toHaveBeenCalledWith(file);
    });
    await waitFor(() => {
      const img = screen.getByAltText('Soru görseli önizleme') as HTMLImageElement;
      expect(img.src).toBe('data:image/jpeg;base64,FAKE');
    });
  });

  it('resim OLMAYAN veri yapıştırılırsa görsel hattı hiç çağrılmaz', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    const pasteZone = screen.getByText(/Ctrl\+V ile yapıştır/);
    fireEvent.paste(pasteZone, {
      clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] },
    });
    expect(vi.mocked(compressImageToDataUri)).not.toHaveBeenCalled();
    expect(screen.queryByAltText('Soru görseli önizleme')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/choice-exercise-paste-image.test.tsx`
Beklenen: FAIL — `Ctrl+V ile yapıştır` metni bulunamaz (henüz eklenmedi)

- [ ] **Step 3: `ChoiceExerciseFields.tsx`'i güncelle**

`onOptionImageFile` fonksiyonunun (satır 52-61) ALTINA ekle:

```ts
  async function handlePromptImagePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    await onPromptImageFile(file);
  }
```

Satır 113-116 civarındaki "Görsel seç" `<label>`'inin ALTINA (aynı `<div className="space-y-2">` içinde) ekle:

```tsx
          <div
            role="button"
            tabIndex={0}
            onPaste={handlePromptImagePaste}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs
              border border-dashed border-white/25 text-white/50 cursor-text
              focus:border-cyan-400 focus:text-cyan-200 outline-none ml-2"
          >
            📋 Buraya tıkla, sonra Ctrl+V ile yapıştır
          </div>
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `cd apps/web && npx vitest run tests/choice-exercise-paste-image.test.tsx`
Beklenen: PASS — 2 test

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/tests/choice-exercise-paste-image.test.tsx
git commit -m "feat: Ctrl+V ile soru gorseli yapistirma"
```

---

## Task 9: Tam test kapısı + canlı doğrulama (KURAL #6)

**Files:** (değişiklik yok — yalnızca doğrulama)

- [ ] **Step 1: Tam frontend kapısı**

Çalıştır: `cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run`
Beklenen: tsc hatasız; lint yalnızca önceden var olan uyarılar; tüm testler PASS.

- [ ] **Step 2: Production build**

Çalıştır: `cd apps/web && npm run build`
Beklenen: Başarılı build.

- [ ] **Step 3: Kullanıcıya sor**

Kullanıcıya "bunu test edeyim mi?" diye sor (KURAL #6). Onay alınca devam et.

- [ ] **Step 4: Canlı tarayıcı doğrulaması — admin BoardEditor**

Admin panelinde "Yeni Soru → Konum Ekle" açılır:
- Tahtada bir kareye **sade sağ-tık** → açık yeşil olduğu doğrulanır.
- Aynı kareye **Ctrl+sağ-tık** → kırmızıya döndüğü doğrulanır.
- **Alt+sağ-tık** başka bir karede mavi, **Ctrl+Alt+sağ-tık** başka bir karede
  sarı olduğu doğrulanır.
- Aynı kareye aynı renkle tekrar sağ-tık → temizlendiği doğrulanır.
- Bir taş yerleştirilip üzerine (palet seçili değilken) tıklanır → silindiği
  doğrulanır (madde b, zaten var olan davranış).
- "Başlangıç konumu"/"Tahtayı temizle" butonlarının tahtanın altında ortalı
  göründüğü doğrulanır (ekran görüntüsüyle).

- [ ] **Step 5: Canlı tarayıcı doğrulaması — sporcu tahtası**

Bota Karşı Oyna (`/play`) veya bir pratik ekranı açılır, tahtada bir kareye
sağ-tık yapılıp renklendiğinin çalıştığı doğrulanır (ChessBoard entegrasyonu).

- [ ] **Step 6: Canlı tarayıcı doğrulaması — form iyileştirmeleri**

- "Doğru kare(ler)" kısmındaki kare isimlerinin belirgin şekilde büyüdüğü
  doğrulanır.
- Zorluk düzeyinde Kolay/Orta/Zor butonlarının göründüğü, birine tıklayınca
  vurgunun değiştiği doğrulanır.
- Admin ders içeriği sayfasında dairesel soru kodu kartlarının küçüldüğü ve
  içindeki kodun büyüdüğü doğrulanır (ekran görüntüsüyle).
- "Görüntü Ekle" formunda yapıştırma alanına tıklanıp gerçek bir ekran
  görüntüsü (Print Screen ile panoya alınmış) Ctrl+V ile yapıştırılır,
  önizlemenin göründüğü doğrulanır.

- [ ] **Step 7: Dürüst rapor**

Hangi adımların tarayıcıda gerçekten doğrulandığını, hangilerinin
doğrulanamadığını (örn. gerçek ekran görüntüsü yapıştırma ortamda mümkün
değilse) açıkça belirt (KURAL #1, KURAL #6).

---

## Notlar

- **KURAL #3:** Hiçbir değişiklik mevcut soru verisini (`content_json`)
  bozmuyor. Zorluk düzeyi hâlâ 1-5 sayısal; sağ-tık renklendirme hiçbir yere
  yazılmıyor.
- **KURAL #5 (mobil uygulama):** Bu değişikliklerin hepsi web tarafında
  (admin panel + sporcu web arayüzü); mobil uygulama build'ini gerektirmiyor,
  onay istenmeden uygulanabilir.
- Madde (b) bu planda YOKTUR çünkü zaten kodda mevcut (`BoardEditor.tsx:124-132`,
  test kanıtı: `tests/board-editor-click-add.test.tsx:109-115`). Task 9 Step 4'te
  sadece canlıda teyit edilir.

## BİLİNEN SINIR — dokunmatik cihazlar

**Sağ tık, telefon/tablette yoktur.** Bu özellik masaüstünde (fare ile) çalışır.
Zafer Hoca admin panelini bilgisayardan kullandığı için (a) maddesinin admin
tarafı sorunsuz; ancak **sporcular uygulamayı tablet/telefondan kullanıyorsa
renklendirmeyi kullanamazlar.** Bu, isteğin doğal bir sonucudur (sağ tık
istendi) — sessizce geçilmemesi için buraya yazıldı. Dokunmatik için ayrı bir
etkileşim (örn. uzun basma) gerekirse ayrı bir istek olarak ele alınmalıdır.

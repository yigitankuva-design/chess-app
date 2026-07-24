# Kareye Tıkla Sporcu Davranışı (P3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `click_square` tipi sorularda tıklanan kareyi doğru/yanlış rengiyle boyamak ve yanlış cevapta tekrar deneme hakkı olmadan sonraki soruya otomatik geçiş sağlamak — diğer soru tiplerine (Taşı Oynat, Taşı Tanı, Cümle/Görüntü) hiç dokunmadan.

**Architecture:** `succeed()`'in tamamlanma tespiti `doneCount` yerine `currentIdx` tabanlı hale getirilir (tüm tipler için davranışsal olarak eşdeğer bir refactor — kritik, çünkü mevcut haliyle yanlış-cevapta-ilerleme eklenince sporcuyu son soruda kilitler). `fail()`'e dokunulmadan, sadece `click_square`'in kullandığı ayrı bir `failNoRetry()` fonksiyonu eklenir. Tıklama kilidi tipe özel yapılır (Taşı Oynat'ın anında-tekrar-deneme hakkı korunur).

**Tech Stack:** React/TypeScript, vitest + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-07-24-kareye-tikla-sporcu-davranisi-design.md`

---

## Dosya haritası

| Dosya | Değişiklik |
|---|---|
| `apps/web/components/lesson-steps/BoardExercise.tsx` | `clickedSquare`/`allAttempted` state, `succeed()` refactoru (currentIdx tabanlı bitiş), yeni `failNoRetry()`, `click_square` dalı, kare renklendirme, tipe özel tıklama kilidi, yeni terminal render dalı |
| `apps/web/tests/board-exercise-click-square.test.tsx` | **Yeni** — regresyon güvenlik ağı + yeni davranış testleri |

Doğrulanmış varsayım (plan yazılmadan önce ölçüldü): `BoardExercise`'de
`onSquareClick` sadece dış `[data-square]` div'ine bağlı (BoardEditor'daki
gibi ayrı bir `onPieceClick` çakışması YOK) — bu yüzden testlerde
`container.querySelector('[data-square="e2"]')`'e doğrudan tıklamak
yeterli, iç `[data-piece]` seçicisi gerekmiyor.

---

## Task 1: Regresyon güvenlik ağı — mevcut davranışı kilitle

**Files:**
- Test: `apps/web/tests/board-exercise-click-square.test.tsx` (yeni)

Bu görev **hiçbir üretim kodu değiştirmez** — sadece mevcut (P3 öncesi)
davranışı test altına alır, ki Task 2 ve 3'teki refactor'lar bunu
bozarsa hemen yakalansın.

- [ ] **Step 1: Regresyon testlerini yaz**

`apps/web/tests/board-exercise-click-square.test.tsx` oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

describe('BoardExercise — P3 öncesi taban çizgisi (regresyon güvenlik ağı)', () => {
  it('move_piece: yanlış hamleden hemen sonra (fail penceresi içinde) tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'move_piece', instruction: "Piyonu e4'e taşı",
        fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', piece_square: 'e2', target_squares: ['e4'],
      },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e2"]')!);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış hedef
    expect(screen.getByText(/Yanlış kare/)).toBeInTheDocument();
    // Fail penceresi (1.8sn) DOLMADAN tekrar dene — taşı yeniden seçip doğru kareye taşıyabilmeli
    fireEvent.click(container.querySelector('[data-square="e2"]')!);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(container.textContent).toMatch(/Aferin/);
  });

  it('identify_piece: yanlış şıktan sonra tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'identify_piece', instruction: 'Bu taş ne?',
        fen: '8/8/8/8/4n3/8/8/8 b - - 0 1', highlight_square: 'e4',
        options: ['Piyon', 'At'], correct_index: 1,
      },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(screen.getByText('Piyon')); // yanlış
    expect(screen.getByText(/Yanlış/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('At')); // tekrar dene, doğru
    expect(screen.getByText(/Aferin/)).toBeInTheDocument();
  });

  it('sentence_question: yanlış cevaptan sonra tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'sentence_question', instruction: 'Atın hareketi?',
        answer_kind: 'sentence', options: ['L şeklinde', 'Düz'], correct_index: 0,
      },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(screen.getByText('Düz')); // yanlış
    fireEvent.click(screen.getByText('L şeklinde')); // tekrar dene, doğru
    expect(screen.getByText(/Aferin/)).toBeInTheDocument();
  });

  it('click_square: 3 sorunun TÜMÜ doğru cevaplanınca onCorrect tam bir kez çağrılır', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q3', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, hepsinin PASS olduğunu doğrula (taban çizgisi)**

Run: `cd apps/web && npx vitest run tests/board-exercise-click-square.test.tsx`
Expected: 4 test PASS. Bu, Task 2/3'ten SONRA da hâlâ PASS olması gereken taban çizgisi.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/board-exercise-click-square.test.tsx
git commit -m "test: BoardExercise P3 öncesi davranış taban çizgisi (regresyon güvenlik ağı)"
```

---

## Task 2: `succeed()` refactoru — bitiş tespiti `currentIdx` tabanlı

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-click-square.test.tsx`

Bu görev **davranışsal olarak no-op** olmalı — mevcut tüm tipler için
sonuç birebir aynı kalır. Task 1'in 4 testi bunu doğrular. Bu refactor,
Task 3'te `click_square`'e "yanlışta da ilerleme" eklendiğinde ortaya
çıkacak kilitlenme bug'ını önceden önlüyor.

- [ ] **Step 1: Kilitlenme senaryosunu önceden test et (bu görev bitince PASS olmalı)**

`apps/web/tests/board-exercise-click-square.test.tsx` dosyasının sonuna ekle:

```tsx
describe('BoardExercise — succeed() bitiş tespiti currentIdx tabanlı (Task 2)', () => {
  it('3 sorunun tümü DOĞRU cevaplanırsa onCorrect hâlâ tam bir kez çağrılır (refactor no-op doğrulaması)', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Testi çalıştır, PASS olduğunu doğrula (mevcut kodla zaten geçmeli)**

Run: `cd apps/web && npx vitest run tests/board-exercise-click-square.test.tsx`
Expected: 5 test PASS (Task 1'in 4'ü + bu görevin 1'i). Bu test mevcut kodla ZATEN geçiyor — Task 2'nin amacı bunu BOZMADAN iç mantığı değiştirmek.

- [ ] **Step 3: `succeed()`'i `currentIdx` tabanlı bitiş tespitiyle yeniden yaz**

`apps/web/components/lesson-steps/BoardExercise.tsx`'teki `succeed` fonksiyonunu:

```ts
  const succeed = (piece?: string | null) => {
    if (piece) playPieceSound(piece);
    setStatus('success');
    setSelected(null);
    const next = doneCount + 1;
    setDoneCount(next);
    if (next >= total) {
      if (!done) onCorrect();
    } else {
      setShowNext(true);
    }
  };
```

şununla değiştir:

```ts
  const succeed = (piece?: string | null) => {
    if (piece) playPieceSound(piece);
    setStatus('success');
    setSelected(null);
    const next = doneCount + 1;
    setDoneCount(next);
    // Bitiş tespiti currentIdx tabanlı (doneCount tabanlı DEĞİL) — çünkü yanlış
    // cevapta da ilerleme olan click_square'de doneCount artık currentIdx'ten
    // geride kalabilir. Mevcut tipler için (her soru doğru cevaplanmak
    // zorunda) bu ikisi zaten eşdeğerdi, bu yüzden davranış değişmiyor.
    if (currentIdx < total - 1) {
      setShowNext(true);
    } else if (next >= total) {
      if (!done) onCorrect();
    }
    // else: dizi bitti ama hepsi doğru değildi — Task 3'te ele alınacak (allAttempted)
  };
```

- [ ] **Step 4: Testleri tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/board-exercise-click-square.test.tsx`
Expected: 5 test PASS (değişmedi — refactor no-op).

- [ ] **Step 5: TÜM proje testlerini çalıştır (geniş regresyon)**

Run: `cd apps/web && npx vitest run`
Expected: Tüm test dosyaları PASS — `board-exercise-render.test.tsx`'teki mevcut testler dahil hiçbiri bozulmamalı.

- [ ] **Step 6: TypeScript derlemesini kontrol et**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-click-square.test.tsx
git commit -m "refactor: succeed() bitiş tespiti currentIdx tabanlı (davranış değişmedi, click_square hazırlığı)"
```

---

## Task 3: `click_square` yeni davranışı — kare renklendirme + tekrar deneme yok

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-click-square.test.tsx`

- [ ] **Step 1: Yeni davranış testlerini yaz (FAIL bekleniyor)**

`apps/web/tests/board-exercise-click-square.test.tsx` dosyasının sonuna ekle:

```tsx
describe('BoardExercise — click_square yeni davranış: renklendirme + tekrar deneme yok', () => {
  it('doğru kareye tıklayınca kare açık yeşille renklenir', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    const sq = container.querySelector('[data-square="e4"]') as HTMLElement;
    expect(sq.style.backgroundColor).toBe('rgba(100, 220, 100, 0.45)');
  });

  it('yanlış kareye tıklayınca o kare açık kırmızıyla renklenir', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    const sq = container.querySelector('[data-square="a1"]') as HTMLElement;
    expect(sq.style.backgroundColor).toBe('rgba(239, 68, 68, 0.45)');
  });

  it('yanlış cevaptan 2 saniye sonra bile durum sıfırlanmaz (tekrar deneme yok)', async () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'y', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    expect(screen.getByText('Sonraki Soru →')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 2000)); // mevcut fail() 1.8sn'de idle'a dönerdi
    expect(screen.getByText('Sonraki Soru →')).toBeInTheDocument(); // hâlâ orada — sıfırlanmadı
  });

  it('yanlış cevap sonrası tekrar tıklama hiçbir şeyi değiştirmez', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'y', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    fireEvent.click(container.querySelector('[data-square="e4"]')!); // tekrar dene — etkisiz olmalı
    expect(onCorrect).not.toHaveBeenCalled();
    expect(screen.getByText('Sonraki Soru →')).toBeInTheDocument();
  });

  it('yanlış cevap doneCount\'u artırmaz (ilerleme noktası yanlışı doğru saymaz)', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'y', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(document.querySelector('[data-square="a1"]')!); // yanlış
    expect(screen.getByText('0/2')).toBeInTheDocument();
  });

  it('KİLİTLENME REGRESYONU: Q1 doğru, Q2 yanlış, Q3 doğru — Q3 sonrası buton görünmez, terminal ekran görünür', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'q2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
      { type: 'click_square', instruction: 'q3', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    // Q1 doğru
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    // Q2 yanlış
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    // Q3 doğru — SON SORU
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(screen.queryByText('Sonraki Soru →')).not.toBeInTheDocument();
    expect(onCorrect).not.toHaveBeenCalled(); // hepsi doğru değildi (Q2 yanlıştı)
    expect(container.textContent).toMatch(/cevapland/i); // yerel "bitti" mesajı
  });

  it('son soru YANLIŞ cevaplanırsa terminal ekran görünür, onCorrect çağrılmaz', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // tek soru, yanlış
    expect(onCorrect).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/cevapland/i);
  });

  it('REGRESYON: move_piece hâlâ fail penceresinde hemen tekrar denenebiliyor (guard tipe özel)', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'move_piece', instruction: 'x',
        fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', piece_square: 'e2', target_squares: ['e4'],
      },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e2"]')!);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    fireEvent.click(container.querySelector('[data-square="e2"]')!); // hemen tekrar dene
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(container.textContent).toMatch(/Aferin/);
  });
});
```

- [ ] **Step 2: Testleri çalıştır, yeni davranış testlerinin FAIL ettiğini doğrula**

Run: `cd apps/web && npx vitest run tests/board-exercise-click-square.test.tsx`
Expected: Bu görevin 8 testi FAIL (kare renklenmiyor, tekrar deneme hâlâ mevcut, terminal ekran yok). Önceki 6 test (Task 1'in 4'ü + Task 2'nin 1'i + genel taban) hâlâ PASS.

- [ ] **Step 3: State ekle**

`apps/web/components/lesson-steps/BoardExercise.tsx`'te `const [showNext, setShowNext] = useState(false);` satırının hemen altına ekle:

```ts
  const [clickedSquare, setClickedSquare] = useState<string | null>(null);
  const [allAttempted, setAllAttempted] = useState(false);
```

- [ ] **Step 4: Per-exercise reset `useEffect`'ine `clickedSquare` sıfırlamasını ekle**

Mevcut:

```ts
  useEffect(() => {
    if (done) return;
    setStatus('idle');
    setFeedback('');
    setSelected(null);
    setShowNext(false);
  }, [currentIdx, done]);
```

şununla değiştir (`allAttempted` BURAYA eklenmiyor — terminal bir durum, sıfırlanmamalı):

```ts
  useEffect(() => {
    if (done) return;
    setStatus('idle');
    setFeedback('');
    setSelected(null);
    setShowNext(false);
    setClickedSquare(null);
  }, [currentIdx, done]);
```

- [ ] **Step 5: `isLastQuestion` türet, `succeed()`'i tamamla, `failNoRetry()` ekle**

`succeed` fonksiyonunun HEMEN ÜSTÜNE (Task 2'de değiştirilen haliyle) ekle:

```ts
  const isLastQuestion = currentIdx === total - 1;
```

`succeed` fonksiyonunu (Task 2'deki hali) şununla değiştir — `else` dalı artık `allAttempted`'ı set ediyor:

```ts
  const succeed = (piece?: string | null) => {
    if (piece) playPieceSound(piece);
    setStatus('success');
    setSelected(null);
    const next = doneCount + 1;
    setDoneCount(next);
    if (!isLastQuestion) {
      setShowNext(true);
    } else if (next >= total) {
      if (!done) onCorrect();
    } else {
      setAllAttempted(true);
    }
  };
```

`fail` fonksiyonunun HEMEN ALTINA (fail'e hiç dokunmadan) ekle:

```ts
  // Kareye Tıkla'da yanlış cevapta tekrar deneme yok: geri bildirim gösterilir,
  // sonra sporcu sonraki soruya geçer. doneCount ARTIRILMAZ — yanlış cevap
  // ilerleme noktalarında doğru gibi görünmemeli.
  const failNoRetry = (msg: string) => {
    setStatus('fail');
    setFeedback(msg);
    setSelected(null);
    if (!isLastQuestion) {
      setShowNext(true);
    } else {
      setAllAttempted(true);
    }
  };
```

- [ ] **Step 6: `click_square` dalını güncelle**

`onSquareClick` içindeki:

```ts
    if (exercise.type === 'click_square') {
      if (piece) playPieceSound(piece.pieceType);
      if (isTargetSquare(square, exercise.target_squares)) {
        succeed();
      } else {
        fail(exercise.fail_msg ?? 'Yanlış kare! Tekrar dene.');
      }
      return;
    }
```

şununla değiştir:

```ts
    if (exercise.type === 'click_square') {
      if (piece) playPieceSound(piece.pieceType);
      setClickedSquare(square);
      if (isTargetSquare(square, exercise.target_squares)) {
        succeed();
      } else {
        failNoRetry(exercise.fail_msg ?? 'Yanlış kare!');
      }
      return;
    }
```

- [ ] **Step 7: Tıklama kilidini tipe özel yap**

`onSquareClick`'in en üstündeki:

```ts
  const onSquareClick = ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (status === 'success' || !isBoardExercise(exercise)) return;
```

şununla değiştir:

```ts
  const onSquareClick = ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (!isBoardExercise(exercise)) return;
    if (status === 'success') return;
    // Kareye Tıkla'da yanlış cevaptan sonra soru kilitlenir (tekrar deneme yok).
    // Diğer tipler (ör. Taşı Oynat) fail penceresinde hemen tekrar denenebilmeye devam eder.
    if (exercise.type === 'click_square' && status === 'fail') return;
```

- [ ] **Step 8: Kare renklendirmeyi ekle**

`styles` hesaplamasının EN SONUNA (`if (isBoardExercise(exercise)) { ... }` bloğunun kapanışından hemen önce) ekle:

```ts
    if (exercise.type === 'click_square' && clickedSquare) {
      if (status === 'success') {
        styles[clickedSquare] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      } else if (status === 'fail') {
        styles[clickedSquare] = { backgroundColor: 'rgba(239,68,68,0.45)' };
      }
    }
```

(Tam bağlam — bu blok, mevcut `if (status === 'success' && exercise.type === 'move_piece') { ... }` bloğunun HEMEN ALTINA, hâlâ `if (isBoardExercise(exercise)) { ... }` gövdesinin içine eklenir.)

- [ ] **Step 9: Terminal render dalını ekle**

Mevcut `if (done && !showNext) { ... }` bloğunun HEMEN ALTINA ekle:

```tsx
  if (allAttempted) {
    return (
      <div className="mt-2 pt-3 space-y-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-muted)' }}>
          Bu bölümdeki tüm sorular cevaplandı.
        </div>
      </div>
    );
  }
```

- [ ] **Step 10: Testleri tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/board-exercise-click-square.test.tsx`
Expected: Tüm testler PASS (önceki 6 + bu görevin 8'i = 14).

- [ ] **Step 11: TÜM proje testlerini çalıştır (geniş regresyon)**

Run: `cd apps/web && npx vitest run`
Expected: Tüm test dosyaları PASS, hiç regresyon yok.

- [ ] **Step 12: TypeScript derlemesini kontrol et**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata

- [ ] **Step 13: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-click-square.test.tsx
git commit -m "feat: Kareye Tıkla'da kare renklendirme + tekrar deneme yok, sonraki soruya otomatik geçiş"
```

---

## Task 4: Tam test kapısı

**Files:** Yok (sadece doğrulama)

- [ ] **Step 1: Frontend tüm testler**

Run: `cd apps/web && npx vitest run`
Expected: Tüm test dosyaları PASS (P1+P2'den kalan 85 test + bu işin 14 yeni testi = 99).

- [ ] **Step 2: TypeScript derlemesi**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 3: Lint**

Run: `cd apps/web && npx next lint`
Expected: `Error:` satırı yok.

- [ ] **Step 4: Production build**

Run: `cd apps/web && npm run build`
Expected: `Compiled successfully`, hata yok.

- [ ] **Step 5: Herhangi bir adım başarısız olursa**

İlgili göreve dön, düzelt, o görevin testlerini tekrar çalıştır, sonra bu görevi baştan çalıştır.

---

## Task 5: Canlı doğrulama (KURAL #6)

**Files:** Yok (sadece manuel/tarayıcı doğrulama)

- [ ] **Step 1: Yerel dev sunucuyu prod API'ye karşı başlat**

`.env.local` oluştur: `NEXT_PUBLIC_API_URL=https://chess-app-production-1dab.up.railway.app`
Dev sunucuyu başlat (proje kuralı: `mcp__Claude_Browser__preview_start`, `chess-web` config'i).

- [ ] **Step 2: Test öğretmen hesabıyla 3 soruluk bir click_square dizisi oluştur**

Gerçek prod API'ye karşı geçici bir test öğretmeni + ders + alt konu +
3 adet `click_square` sorusu oluştur (curl ile, P1/P2'deki desenle).
Ortadaki soru için hedef kareyi bilerek not al (yanlış tıklamayı test
etmek için).

- [ ] **Step 3: Doğru cevap rengini tarayıcıda doğrula**

`/pratik/suresiz?step=...&ders=...` sayfasına git. İlk soruda doğru
kareye tıkla → karenin açık yeşil renklendiğini, "Aferin!" banner'ının
göründüğünü, "Sonraki Soru" butonunun çıktığını doğrula.

- [ ] **Step 4: Yanlış cevap rengini ve tekrar-deneme-yok davranışını doğrula**

İkinci soruda (bile bile) yanlış bir kareye tıkla → karenin açık kırmızı
renklendiğini doğrula. Aynı yanlış kareye veya doğru kareye TEKRAR tıkla
→ hiçbir şey değişmediğini (durum sabit kaldığını) doğrula. "Sonraki
Soru" butonuna tıkla → üçüncü soruya geçildiğini doğrula.

- [ ] **Step 5: Son soru yanlış cevaplanınca terminal ekranı doğrula**

Üçüncü (son) soruda bile bile yanlış bir kareye tıkla → "Bu bölümdeki
tüm sorular cevaplandı." mesajının göründüğünü doğrula.

- [ ] **Step 6: Regresyonu tarayıcıda doğrula — Taşı Oynat**

Aynı alt konuya (veya gerçek prod'daki mevcut bir `move_piece`
sorusuna) git, yanlış bir hamle yap, HEMEN ardından (1.8 saniye
beklemeden) tekrar dene → hâlâ çalıştığını doğrula.

- [ ] **Step 7: Test verisini temizle**

Oluşturulan geçici ders/modülü `DELETE` ile sil, `GET /modules` ile
silindiğini doğrula.

- [ ] **Step 8: Yerel ortamı temizle**

`.env.local` dosyasını sil, dev sunucuyu durdur.

- [ ] **Step 9: Sonucu kullanıcıya raporla**

Ne test edildi, ne doğrulandı — açıkça yaz (KURAL #6).

---

## Self-Review Notu (plan yazarı için)

- **Spec kapsaması:** Kare renklendirme (Task 3 Step 8), tekrar deneme
  yok (Task 3 Step 5-7), kilitlenme önleme (Task 2), tipe özel kilit
  (Task 3 Step 7), `onCorrect` semantiği korunması (Task 3 Step 5),
  regresyonlar (Task 1, Task 3 Step 1'in son testi) — spec'in tüm
  bölümleri karşılanıyor.
- **Doğrulanmış varsayım:** Plan yazılmadan önce `BoardExercise`'de dış
  `[data-square]` div'ine tıklamanın (iç `[data-piece]` gerekmeden)
  `onSquareClick`'i doğru `piece` bilgisiyle tetiklediği gerçek bir
  testle ölçüldü — BoardEditor'daki `onPieceClick`/`onSquareClick`
  çakışması burada YOK (BoardExercise `onPieceClick` hiç kullanmıyor).
- **Tip tutarlılığı:** `clickedSquare`, `allAttempted`, `isLastQuestion`,
  `failNoRetry` isimleri Task 3 boyunca tutarlı kullanılıyor.
- **Sıra bağımlılığı:** Task 2 kasıtlı olarak "davranışsal no-op" bir
  refactor — kendi başına hiçbir yeni özellik eklemiyor, sadece Task 3'ün
  güvenle üzerine inşa edilebileceği bir zemin hazırlıyor. Task 1'in
  testleri Task 2'den SONRA da value olarak aynı sonucu vermeli; bu,
  refactorun doğruluğunun kanıtı.

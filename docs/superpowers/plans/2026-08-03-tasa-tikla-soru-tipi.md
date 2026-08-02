# "Taşa Tıkla" Soru Tipi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konum ekle bölümüne dördüncü tahta sorusu tipi eklemek: Zafer Hoca konumdaki taşlardan birkaçını cevap işaretler, sporcu o taşlara tıklar.

**Architecture:** Bu tip `click_square` ile aynı tahtayı ve tıklama yolunu kullanır — ayrı bir çözücü bileşen gerekmez, `BoardExercise`'e bir dal eklenir. Değerlendirme mevcut `evaluateClick()` ile yapılır. Panel tarafında B grubunda eklenen `SavedPositionBoard` isteğe bağlı tıklama desteğiyle genişletilir (salt-okunur kullanımı bozulmadan).

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v3, react-chessboard, Vitest; FastAPI + python-chess, pytest.

---

## Dosya Yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/admin/clickPieceSteps.ts` (YENİ) | 8 adımlık panel akışının saf mantığı |
| `apps/api/chess_api/routers/admin.py` (DEĞİŞİR) | `click_piece` tipini tanıma + doğrulama |
| `apps/web/components/lesson-steps/BoardExercise.tsx` (DEĞİŞİR) | Tip birleşimi + sporcu tıklama dalı |
| `apps/web/components/admin/SavedPositionBoard.tsx` (DEĞİŞİR) | İsteğe bağlı `onSquareClick` |
| `apps/web/components/admin/ExerciseForm.tsx` (DEĞİŞİR) | 4. tip butonu, adım listesi, doğrulama, kaydetme |

---

### Task 1: 8 adımlık akış mantığı

**Files:**
- Create: `apps/web/lib/admin/clickPieceSteps.ts`
- Test: `apps/web/tests/click-piece-steps.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/click-piece-steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clickPieceSteps, CLICK_PIECE_STEP_LABELS } from '@/lib/admin/clickPieceSteps';
import type { ClickPieceStepState } from '@/lib/admin/clickPieceSteps';

const empty: ClickPieceStepState = {
  instruction: '',
  setupFen: '8/8/8/8/8/8/8/8 w - - 0 1',
  savedFen: null,
  pieceSquares: [],
  answerSaved: false,
  turnChosen: false,
  difficultyChosen: false,
};

const full: ClickPieceStepState = {
  instruction: 'Şaha tıkla',
  setupFen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  savedFen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  pieceSquares: ['e4'],
  answerSaved: true,
  turnChosen: true,
  difficultyChosen: true,
};

describe('clickPieceSteps', () => {
  it('8 adım vardır ve sonuncusu Soruyu Ekle', () => {
    expect(CLICK_PIECE_STEP_LABELS).toHaveLength(7);
    const steps = clickPieceSteps(empty);
    expect(steps).toHaveLength(8);
    expect(steps[7].label).toBe('Soruyu Ekle');
  });

  it('adım sırası kullanıcının verdiği sıradır', () => {
    expect(clickPieceSteps(empty).map((s) => s.label)).toEqual([
      'Talimatı Gir',
      'Konumu Diz',
      'Konumu Kaydet',
      'Cevap Taşlarını Seç',
      'Taş Seçimini Kaydet',
      'Hamle Sırasını Belirle',
      'Zorluk Düzeyini Belirle',
      'Soruyu Ekle',
    ]);
  });

  it('boş durumda hiçbir adım tamam değildir', () => {
    expect(clickPieceSteps(empty).every((s) => !s.done)).toBe(true);
  });

  it('tam durumda tüm adımlar tamamdır', () => {
    expect(clickPieceSteps(full).every((s) => s.done)).toBe(true);
  });

  it('cevap taşı seçilince 4. adım tamam olur', () => {
    const s = clickPieceSteps({ ...empty, pieceSquares: ['e4'] });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(false); // henüz kaydedilmedi
  });

  it('son adım ancak diğer 7 adım bitince tamam olur', () => {
    const s = clickPieceSteps({ ...full, difficultyChosen: false });
    expect(s[6].done).toBe(false);
    expect(s[7].done).toBe(false);
  });

  it('konum kaydedilmişse Konumu Diz de tamam sayılır', () => {
    const s = clickPieceSteps({ ...empty, savedFen: '8/8/8/8/8/8/8/8 w - - 0 1' });
    expect(s[1].done).toBe(true);
    expect(s[2].done).toBe(true);
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/click-piece-steps.test.ts
```

Beklenen: FAIL — modül yok.

- [ ] **Step 3: `clickPieceSteps.ts` oluştur**

```ts
import { hasPieces } from '@/lib/admin/movePieceSteps';
import type { StepInfo } from '@/lib/admin/movePieceSteps';

/**
 * "Taşa Tıkla" sorusunun 8 adımlık akışının saf mantığı.
 * Sıra kullanıcının verdiği sıradır (zorluk adımı sonradan onaylanarak eklendi).
 */
export interface ClickPieceStepState {
  instruction: string;
  setupFen: string;
  /** "Konumu Kaydet" sonrası kilitlenen konum; null = kaydedilmedi. */
  savedFen: string | null;
  /** Cevap taşlarının bulunduğu kareler. */
  pieceSquares: string[];
  /** "Taş Seçimini Kaydet"e basıldı mı? */
  answerSaved: boolean;
  /** Hamle sırasına BİLFİİL tıklandı mı (varsayılan Beyaz olduğu için şart). */
  turnChosen: boolean;
  /** Zorluk etiketine BİLFİİL tıklandı mı? */
  difficultyChosen: boolean;
}

export const CLICK_PIECE_STEP_LABELS = [
  'Talimatı Gir',
  'Konumu Diz',
  'Konumu Kaydet',
  'Cevap Taşlarını Seç',
  'Taş Seçimini Kaydet',
  'Hamle Sırasını Belirle',
  'Zorluk Düzeyini Belirle',
] as const;

export function clickPieceSteps(s: ClickPieceStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    // Konum bilerek kaydedilmişse dizme adımı tamam sayılır (clickSquareSteps ile aynı kural).
    hasPieces(s.setupFen) || s.savedFen !== null,
    s.savedFen !== null,
    s.pieceSquares.length > 0,
    s.answerSaved,
    s.turnChosen,
    s.difficultyChosen,
  ];
  const all = [...done, done.every(Boolean)];
  return [...CLICK_PIECE_STEP_LABELS, 'Soruyu Ekle'].map((label, i) => ({
    no: i + 1, label, done: all[i],
  }));
}
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/click-piece-steps.test.ts
```

Beklenen: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin/clickPieceSteps.ts apps/web/tests/click-piece-steps.test.ts
git commit -m "feat: Tasa Tikla 8 adimli akis mantigi"
```

---

### Task 2: Backend doğrulaması

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py` (`BOARD_EXERCISE_TYPES` + `_validate_board_exercises`)
- Test: `apps/api/tests/test_click_piece_validation.py`

- [ ] **Step 1: Başarısız testi yaz**

`apps/api/tests/test_click_piece_validation.py`:

```python
import pytest
from fastapi import HTTPException

from chess_api.routers.admin import _validate_board_exercises

# e4'te beyaz sah, a1'de beyaz kale; digerleri BOS.
BASE_FEN = "8/8/8/8/4K3/8/8/R7 w - - 0 1"


def _ex(**over):
    ex = {
        "type": "click_piece",
        "instruction": "Beyaz şaha tıkla",
        "fen": BASE_FEN,
        "piece_squares": ["e4"],
    }
    ex.update(over)
    return ex


def test_gecerli_soru_kabul_edilir():
    _validate_board_exercises([_ex()])


def test_birden_fazla_tas_kabul_edilir():
    _validate_board_exercises([_ex(piece_squares=["e4", "a1"])])


def test_bos_liste_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(piece_squares=[])])


def test_bos_kare_reddedilir():
    # h8 bos — bu tipin cevabi TAS olmali.
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_ex(piece_squares=["h8"])])
    assert "taş yok" in e.value.detail


def test_ayni_kare_iki_kez_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(piece_squares=["e4", "e4"])])


def test_gecersiz_kare_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(piece_squares=["z9"])])


def test_liste_olmayan_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(piece_squares="e4")])


def test_talimatsiz_soru_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_ex(instruction="   ")])
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/api && python -m pytest tests/test_click_piece_validation.py -q
```

Beklenen: FAIL — `click_piece` "Geçersiz alıştırma türü".

- [ ] **Step 3: Tip demetine ekle**

`apps/api/chess_api/routers/admin.py` içindeki satırı:

```python
BOARD_EXERCISE_TYPES = ("click_square", "move_piece", "identify_piece", "place_pieces")
```

şununla değiştir:

```python
BOARD_EXERCISE_TYPES = ("click_square", "move_piece", "identify_piece", "place_pieces", "click_piece")
```

- [ ] **Step 4: Doğrulama dalını ekle**

`_validate_board_exercises` içinde, `elif ex_type == "place_pieces":` dalının SONUNA
(fonksiyonun en altına) ekle:

```python
        elif ex_type == "click_piece":
            # "Taşa Tıkla": cevap TAŞTIR — hedef karelerde taş bulunmak ZORUNDA.
            squares = ex.get("piece_squares")
            if not isinstance(squares, list) or len(squares) < 1:
                raise HTTPException(status_code=400, detail="En az bir cevap taşı seçilmeli")
            seen_pieces: set[str] = set()
            for sq in squares:
                if sq not in chess.SQUARE_NAMES:
                    raise HTTPException(status_code=400, detail=f"Geçersiz kare: {sq}")
                if sq in seen_pieces:
                    raise HTTPException(status_code=400, detail=f"{sq} karesi iki kez verilmiş")
                seen_pieces.add(sq)
                if board.piece_at(chess.parse_square(sq)) is None:
                    raise HTTPException(status_code=400, detail=f"{sq} karesinde taş yok")
```

- [ ] **Step 5: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/api && python -m pytest tests/test_click_piece_validation.py -q
```

Beklenen: 8 passed.

- [ ] **Step 6: Backend regresyonu**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: hepsi PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_click_piece_validation.py
git commit -m "feat: click_piece soru tipi backend dogrulamasi"
```

---

### Task 3: Sporcu tarafı — tip ve tıklama dalı

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-click-piece.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/board-exercise-click-piece.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise, isBoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

/** e4 beyaz şah, a1 beyaz kale; kalan kareler BOŞ. */
const ex: BoardExerciseConfig = {
  type: 'click_piece',
  instruction: 'Beyaz taşlara tıkla',
  fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1',
  piece_squares: ['e4', 'a1'],
  code: '031',
};

const ikinci: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'İkinci soru',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  target_squares: ['d4'],
};

function renderEx() {
  return render(<BoardExercise exercises={[ex, ikinci]} done={false} onCorrect={vi.fn()} />);
}

describe('BoardExercise — click_piece', () => {
  it('tahta tipi sayılır', () => {
    expect(isBoardExercise(ex)).toBe(true);
  });

  it('BOŞ kareye tıklamak hiçbir şey yapmaz', () => {
    const { container } = renderEx();
    fireEvent.click(container.querySelector('[data-square="h8"]')!);
    expect(screen.queryByLabelText('Doğru')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Yanlış')).not.toBeInTheDocument();
  });

  it('ilk doğru taşta soru BİTMEZ (hepsine tıklanmalı)', () => {
    const { container } = renderEx();
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(screen.queryByLabelText('Doğru')).not.toBeInTheDocument();
  });

  it('tüm cevap taşlarına tıklanınca soru DOĞRU biter', () => {
    const { container } = renderEx();
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('sıra serbesttir — a1 önce tıklansa da olur', () => {
    const { container } = renderEx();
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });
});
```

**NOT — yanlış taş senaryosu neden yok:** Bu soruda cevap DIŞINDA taş bulunan kare
yok (e4 ve a1 zaten cevap, kalan her kare boş). "Yanlış taş" davranışı
`evaluateClick()`'in `'wrong'` dalıdır ve `tests/multi-square-check.test.ts` ile
`tests/board-exercise-rings.test.tsx` içinde zaten doğrulanmış durumda; burada
tekrar edilmez. Gerçek tarayıcı doğrulamasında (Task 6) yanlış taş senaryosu elle
sürülür.

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/board-exercise-click-piece.test.tsx
```

Beklenen: FAIL — `click_piece` tipi tanımlı değil.

- [ ] **Step 3: Tip tanımını ekle**

`BoardExercise.tsx` içinde `PlacePiecesEx` arayüzünün ARDINA ekle:

```tsx
/** "Taşa Tıkla" — sporcu konumdaki belirli taşlara tıklar. */
export interface ClickPieceEx {
  type: 'click_piece';
  instruction: string;
  fen: string;
  /** Cevap taşlarının bulunduğu kareler; TÜMÜNE tıklanmalı. En az 1 eleman. */
  piece_squares: string[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
  difficulty?: number;
}
```

Tip birleşimini güncelle:

```tsx
export type BoardTypeConfig = ClickSquareEx | MovePieceEx | IdentifyPieceEx | PlacePiecesEx | ClickPieceEx;
```

Ve `isBoardExercise`'i güncelle:

```tsx
/** Tahta tabanlı bir soru mu? */
export function isBoardExercise(ex: BoardExerciseConfig): ex is BoardTypeConfig {
  return ex.type === 'click_square' || ex.type === 'move_piece'
    || ex.type === 'identify_piece' || ex.type === 'place_pieces'
    || ex.type === 'click_piece';
}
```

- [ ] **Step 4: `styles` hesabına click_piece dalını ekle**

`BoardExercise.tsx` içinde, `multiClicked` halkalarını yazan bloğun HEMEN ARDINA ekle:

```tsx
    // "Taşa Tıkla": tıklanan doğru taşlar mavi halka alır (click_square 'all' ile aynı görünüm).
    if (exercise.type === 'click_piece') {
      multiClicked.forEach((sq) => { styles[sq] = ringStyle(RING_BLUE); });
    }
```

**NOT:** `hint_squares` bloğunun koşuluna da `click_piece` eklenmeli — bu tipte ipucu
karesi alanı yok, okunursa TypeScript hata verir. Şu satırı:

```tsx
      if (exercise.type !== 'identify_piece' && exercise.type !== 'place_pieces'
        && !('moves' in exercise)) {
```

şununla değiştir:

```tsx
      if (exercise.type !== 'identify_piece' && exercise.type !== 'place_pieces'
        && exercise.type !== 'click_piece' && !('moves' in exercise)) {
```

- [ ] **Step 5: Tıklama dalını ekle**

`onSquareClick` içinde, `if (exercise.type === 'click_square') {` bloğundan ÖNCE ekle:

```tsx
    if (exercise.type === 'click_piece') {
      // Yanlış cevaptan sonra tahta kilitli (tek hak).
      if (status === 'fail') return;
      // Cevap TAŞTIR: boş kareye tıklamak hiçbir şey yapmaz.
      if (!fenToMap(exercise.fen)[square]) return;
      const r = evaluateClick(square, exercise.piece_squares, multiClicked);
      if (r === 'wrong') { failNoRetry(exercise.fail_msg ?? 'Yanlış taş!'); return; }
      if (r === 'complete') { setMultiClicked([]); succeed(); return; }
      setMultiClicked((p) => (p.includes(square) ? p : [...p, square]));
      return;
    }
```

Ve dosyanın import bloğuna ekle — **`BoardExercise.tsx`'te `fenToMap` HENÜZ YOK,
doğrulandı; bu satır olmadan derleme hata verir:**

```tsx
import { fenToMap } from '@/components/BoardEditor';
```

(`PlacePiecesSolver.tsx` de aynı yardımcıyı aynı yerden alıyor — desen tutarlı.)

- [ ] **Step 6: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/board-exercise-click-piece.test.tsx
```

Beklenen: PASS (5 test).

- [ ] **Step 7: Sporcu regresyonu**

```bash
cd apps/web && npx vitest run tests/board-exercise-rings.test.tsx tests/board-exercise-click-square.test.tsx tests/board-exercise-place-pieces.test.tsx tests/is-board-exercise.test.ts tests/board-exercise-layout.test.tsx tests/board-exercise-multi-click.test.tsx
```

Beklenen: hepsi PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-click-piece.test.tsx
git commit -m "feat: sporcu tarafi Tasa Tikla soru tipi"
```

---

### Task 4: `SavedPositionBoard`'u tıklanabilir yap

**Files:**
- Modify: `apps/web/components/admin/SavedPositionBoard.tsx`
- Test: `apps/web/tests/saved-position-board-clickable.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/saved-position-board-clickable.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SavedPositionBoard } from '@/components/admin/SavedPositionBoard';

const FEN = '8/8/8/8/4K3/8/8/R7 w - - 0 1';

describe('SavedPositionBoard — tıklanabilir mod', () => {
  it('onSquareClick verilirse tıklanan kare bildirilir', () => {
    const onSquareClick = vi.fn();
    const { container } = render(
      <SavedPositionBoard fen={FEN} marked={[]} onSquareClick={onSquareClick} />,
    );
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(onSquareClick).toHaveBeenCalledWith('e4');
  });

  it('onSquareClick VERİLMEZSE eski salt-okunur davranış sürer (B grubu bozulmaz)', () => {
    const { container } = render(<SavedPositionBoard fen={FEN} marked={['e4']} />);
    // Tıklama bir hata fırlatmamalı ve işaret değişmemeli.
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    const e4 = container.querySelector('[data-square="e4"] > div') as HTMLElement;
    expect(e4.style.borderRadius).toBe('50%');
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/saved-position-board-clickable.test.tsx
```

Beklenen: FAIL — `onSquareClick` prop'u yok (TypeScript hatası veya çağrı olmaması).

- [ ] **Step 3: Prop'u ekle**

`SavedPositionBoard.tsx` içindeki `interface Props`'a ekle:

```tsx
  /**
   * Verilirse tahta TIKLANABİLİR olur ve tıklanan karenin adı bildirilir.
   * Verilmezse tahta salt-okunur kalır (B grubundaki kullanım böyle).
   */
  onSquareClick?: (square: string) => void;
```

İmzayı güncelle:

```tsx
export function SavedPositionBoard({ fen, marked, onSquareClick }: Props) {
```

Ve `Chessboard` seçeneklerine ekle (`squareStyles` satırının ardına):

```tsx
            onSquareClick: onSquareClick
              ? ({ square }: { square: string }) => onSquareClick(square)
              : undefined,
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/saved-position-board-clickable.test.tsx tests/saved-position-board.test.tsx
```

Beklenen: hepsi PASS (B grubunun testi de geçmeli).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/SavedPositionBoard.tsx apps/web/tests/saved-position-board-clickable.test.tsx
git commit -m "feat: SavedPositionBoard istege bagli tiklanabilir"
```

---

### Task 5: Panel entegrasyonu

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Test: `apps/web/tests/exercise-form-click-piece.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/exercise-form-click-piece.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — Taşa Tıkla tipi', () => {
  it('dördüncü tip butonu görünür', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Taşa tıkla' })).toBeInTheDocument();
  });

  it('buton sırası: Kareye tıkla → Taşa tıkla → Taşı oynat → Taş nerde?', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    const isimler = ['Kareye tıkla', 'Taşa tıkla', 'Taşı oynat', 'Taş nerde?'];
    const butonlar = isimler.map((n) => screen.getByRole('button', { name: n }));
    for (let i = 1; i < butonlar.length; i += 1) {
      const onceki = butonlar[i - 1].compareDocumentPosition(butonlar[i]);
      // Node.DOCUMENT_POSITION_FOLLOWING = 4 → sonraki buton DOM'da daha sonra geliyor
      expect(onceki & 4).toBeTruthy();
    }
  });

  it('tip seçilince 8 adımlık liste gösterilir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Taşa tıkla' }));
    const list = screen.getByLabelText('Taşa Tıkla adımları');
    expect(list.textContent).toContain('Cevap Taşlarını Seç');
    expect(list.textContent).toContain('Taş Seçimini Kaydet');
    expect(list.textContent).toContain('Zorluk Düzeyini Belirle');
  });

  it('konum kaydedilmeden cevap tahtası çıkmaz', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Taşa tıkla' }));
    expect(container.querySelector('[data-testid="saved-position-board"]')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/exercise-form-click-piece.test.tsx
```

Beklenen: FAIL — buton yok.

- [ ] **Step 3: Tipi ve alanı genişlet**

`ExerciseForm.tsx` satır 16:

```tsx
export type ExerciseType = 'click_square' | 'move_piece' | 'identify_piece' | 'place_pieces' | 'click_piece';
```

`BoardExercise` arayüzüne (`pieces` alanının ardına) ekle:

```tsx
  /** Sadece click_piece için — cevap taşlarının bulunduğu kareler. */
  piece_squares?: string[];
```

- [ ] **Step 4: State ve adım durumunu ekle**

`BoardExerciseFields` gövdesinde, `placePairs` state'lerinin yanına ekle:

```tsx
  // "Taşa Tıkla" — cevap taşlarının kareleri; konum savedFen ile paylaşılır.
  const [pieceSquares, setPieceSquares] = useState<string[]>(initial?.piece_squares ?? []);
  const [pieceAnswerSaved, setPieceAnswerSaved] = useState(!!initial);
```

`placeSteps` tanımının yanına ekle:

```tsx
  const clickPieceStepList = clickPieceSteps({
    instruction, setupFen: fen, savedFen, pieceSquares,
    answerSaved: pieceAnswerSaved, turnChosen, difficultyChosen,
  });
```

Import bloğuna ekle:

```tsx
import { clickPieceSteps } from '@/lib/admin/clickPieceSteps';
```

**NOT — doğrulandı:** `fenToMap` `ExerciseForm.tsx`'te ZATEN import edilmiş (satır 3),
`SavedPositionBoard` de öyle (B grubunda eklendi). Bu ikisi için yeni import GEREKMEZ.

- [ ] **Step 5: `missing` ve `gateOpen` hesabını genişlet**

Mevcut hesabı:

```tsx
  const missing = type === 'click_square'
    ? firstIncomplete(clickSteps)
    : type === 'place_pieces'
      ? firstIncomplete(placeSteps)
      : firstIncompleteStep(stepState);
  /** Kilit ÜÇ Konum tipine de uygulanır (kullanıcının 3e maddesi). */
  const gateOpen = type === 'move_piece'
    ? allStepsDone(stepState)
    : type === 'click_square'
      ? allDone(clickSteps)
      : type === 'place_pieces'
        ? allDone(placeSteps)
        : true;
```

şununla değiştir:

```tsx
  const missing = type === 'click_square'
    ? firstIncomplete(clickSteps)
    : type === 'place_pieces'
      ? firstIncomplete(placeSteps)
      : type === 'click_piece'
        ? firstIncomplete(clickPieceStepList)
        : firstIncompleteStep(stepState);
  /** Kilit DÖRT Konum tipine de uygulanır. */
  const gateOpen = type === 'move_piece'
    ? allStepsDone(stepState)
    : type === 'click_square'
      ? allDone(clickSteps)
      : type === 'place_pieces'
        ? allDone(placeSteps)
        : type === 'click_piece'
          ? allDone(clickPieceStepList)
          : true;
```

- [ ] **Step 6: Buton ve adım listesini ekle**

Tip butonları dizisini şu hale getir (SIRA ÖNEMLİ — kullanıcı "Kareye Tıkla ile Taşı
Oynat arasında" dedi):

```tsx
        {([
          ['click_square', 'Kareye tıkla'],
          ['click_piece', 'Taşa tıkla'],
          ['move_piece', 'Taşı oynat'],
          ['place_pieces', 'Taş nerde?'],
        ] as [ExerciseType, string][]).map(([t, label]) => (
```

`StepList` satırlarının yanına ekle:

```tsx
      {type === 'click_piece' && (
        <StepList steps={clickPieceStepList} missingNo={missing?.no ?? null} ariaLabel="Taşa Tıkla adımları" />
      )}
```

- [ ] **Step 7: Tahta gösterimini koşulla ve cevap alanını ekle**

`BoardEditor`'ün koşulunu şu hale getir (click_piece konum kaydedilince kendi
tahtasını gösterecek):

```tsx
      {type !== 'move_piece' && type !== 'place_pieces'
        && ((type !== 'click_square' && type !== 'click_piece') || savedFen === null) && (
        <BoardEditor fen={fen} turn={turn} onChange={setFen}
          onTurnChange={(t) => { setTurn(t); setTurnChosen(true); }} />
      )}
```

`PlacePiecesFields` bloğunun ardına ekle:

```tsx
      {type === 'click_piece' && savedFen === null && (
        <button type="button" onClick={() => setSavedFen(fen)}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
          Konumu Kaydet
        </button>
      )}

      {type === 'click_piece' && savedFen !== null && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#34d399' }}>Konum kaydedildi ✓</span>
            {/* Konum değişirse seçilen taşlar geçersiz olur — BİLİNÇLİ sıfırlanır. */}
            <button type="button"
              onClick={() => { setSavedFen(null); setPieceSquares([]); setPieceAnswerSaved(false); }}
              className="px-3 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
              Konumu Değiştir
            </button>
          </div>
          <p className="text-xs n-muted">Cevap taşlarına tıkla — tekrar tıklamak seçimi kaldırır</p>
          <SavedPositionBoard
            fen={savedFen}
            marked={pieceSquares}
            onSquareClick={(sq) => {
              // Cevap TAŞTIR: boş kareye tıklamak seçim yapmaz.
              if (!fenToMap(savedFen)[sq]) return;
              setPieceSquares((prev) => (prev.includes(sq) ? prev.filter((x) => x !== sq) : [...prev, sq]));
              setPieceAnswerSaved(false);
            }}
          />
          <p className="text-xs n-muted">Seçili: {pieceSquares.length ? pieceSquares.join(', ') : '—'}</p>
          {pieceSquares.length > 0 && !pieceAnswerSaved && (
            <button type="button" onClick={() => setPieceAnswerSaved(true)}
              className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm transition-colors">
              Taş Seçimini Kaydet
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 8: Doğrulama ve kaydetmeyi genişlet**

`validate()` içine, `place_pieces` bloğunun ardına ekle:

```tsx
    if (type === 'click_piece') {
      if (!savedFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (pieceSquares.length === 0) return 'En az bir cevap taşı seç';
      if (!pieceAnswerSaved) return '"Taş Seçimini Kaydet"e bas';
      const map = fenToMap(savedFen);
      const bos = pieceSquares.find((sq) => !map[sq]);
      if (bos) return `${bos} karesinde taş yok`;
    }
```

`submit()` içine, `place_pieces` satırının ardına ekle:

```tsx
    if (type === 'click_piece') { base.fen = savedFen!; base.piece_squares = pieceSquares; }
```

`submit()` içindeki sıfırlama bloğuna ekle:

```tsx
        setPieceSquares([]); setPieceAnswerSaved(false);
```

- [ ] **Step 9: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/exercise-form-click-piece.test.tsx
```

Beklenen: PASS (4 test).

- [ ] **Step 10: Panel regresyonu**

```bash
cd apps/web && npx vitest run tests/exercise-form-family.test.tsx tests/exercise-form-move-piece.test.tsx tests/exercise-form-place-pieces.test.tsx tests/exercise-form-click-square-steps.test.tsx tests/click-mode-select.test.tsx tests/saved-position-board.test.tsx
```

Beklenen: hepsi PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/exercise-form-click-piece.test.tsx
git commit -m "feat: panelde dorduncu tip Tasa Tikla"
```

---

### Task 6: Tam test kapısı, canlı doğrulama, yayına alma

- [ ] **Step 1: Ön yüz tam kapısı**

```bash
cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run
```

Beklenen: `tsc` sessiz, `lint` sadece önceden var olan uyarılar, `vitest` hepsi PASS.

- [ ] **Step 2: Arka uç kapısı**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: hepsi PASS.

- [ ] **Step 3: Geliştirme sunucusunu başlat**

`preview_start` aracını `{ name: "chess-web" }` ile çağır.

- [ ] **Step 4: Gerçek tarayıcıda sür**

Geçici bir doğrulama sayfası oluştur (alt çizgiyle BAŞLAMAYAN klasör adı), hem
`ExerciseForm`'u hem `BoardExercise`'i `click_piece` sahte soruyla render et;
doğrulama bitince sayfayı SİL.

Not: react-chessboard düz `element.click()` ile tetiklenmez; gerçek tıklama için
`pointerdown` + `mousedown` + `pointerup` + `mouseup` + `click` olaylarını sırayla
gönder (bu oturumda ölçüldü).

Doğrulanacaklar:
1. Panelde dört buton var ve sıra doğru (Kareye tıkla, Taşa tıkla, Taşı oynat, Taş nerde?)
2. 8 adım doğru sırada listeleniyor
3. Konum kaydedilince cevap tahtası çıkıyor; taşa tıklayınca halka beliriyor,
   tekrar tıklayınca kalkıyor; BOŞ kareye tıklamak seçim yapmıyor
4. Sporcu tarafında: boş kare etkisiz, ilk doğru taşta mavi halka, ikincisinde soru
   doğru bitiyor
5. **Yanlış taş senaryosu:** cevap olmayan bir taşa tıklayınca soru yanlış bitiyor
   (bu senaryo birim testlerde yok — burada elle sürülecek)

- [ ] **Step 5: Bulunan sorun varsa düzelt ve Step 4'ü tekrarla**

- [ ] **Step 6: Geçici sayfayı sil ve kapıyı TEKRAR çalıştır**

```bash
cd apps/web && npx tsc --noEmit && npx vitest run
```

- [ ] **Step 7: Sonucu kullanıcıya sade Türkçe bildir**

Ne doğrulandı, ne doğrulanamadı — açıkça (KURAL #1, KURAL #6).

- [ ] **Step 8: Yayına alma onayı**

Kullanıcıdan açık onay al, sonra:

```bash
git push origin main
```

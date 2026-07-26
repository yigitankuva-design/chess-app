# Dört Akışta Adım Listeleri Implementation Plan (Alt proje C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcının 3b/3d/3e maddelerindeki adım sıralarını dört soru akışına birebir uygulamak; her akışta ✓/eksik göstergesi ve "Soruyu ekle" kilidi.

**Architecture:** Adım mantığı saf modüllerde (`questionSteps.ts` yeni; `movePieceSteps.ts` genişler). Ortak `StepList` sunum bileşeni. Kareye Tıkla, Taşı Oynat'taki iki-faz (diz → kaydet) düzenini alır. "Belirle" adımları bilfiil tıklama ister; düzenlemede tamamlanmış sayılır (KURAL #3). Backend'e dokunulmaz.

**Onaylanan adım listeleri (kullanıcının sırası, birebir):**
- Cümle (6): Talimatı Gir · Seçenek Sayısını Belirle · Cevap Tipini Belirle · Cevapları Gir · Zorluk Düzeyini Belirle · Soruyu Ekle
- Görüntü (7): Soru Görseli Seç + Cümle'nin 6'sı
- Kareye Tıkla (7): Talimatı Gir · Konum Diz · Hamle Sırasını Belirle · Konumu Kaydet · Doğru Kare(leri) Seç · Zorluk Düzeyini Belirle · Soruyu Ekle
- Taşı Oynat (8): Talimatı Gir · Konum Diz · **Hamle Sırasını Belirle** · Konumu Kaydet · Cevap Hamlelerini Yap ve Notasyon Oluştur · Notasyonu Kaydet · Zorluk Düzeyini Belirle · Soruyu Ekle

"Soruyu Ekle" her listede **son satır**dır; önceki adımların hepsi ✓ olunca o da ✓ olur ve buton açılır. Kaydedilen soruların Süresiz Pratik + Hızlı Erişim'de görünmesi mevcut davranıştır — yeni iş yok.

---

## Task 1: Saf mantık — `questionSteps.ts` + `movePieceSteps.ts` genişletme

**Files:**
- Create: `apps/web/lib/admin/questionSteps.ts`
- Modify: `apps/web/lib/admin/movePieceSteps.ts`
- Test: `apps/web/tests/question-steps.test.ts` (yeni), `apps/web/tests/move-piece-steps.test.ts` (güncelle)

- [ ] **Step 1: `questionSteps.ts` testleri (kırmızı)**

`tests/question-steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { choiceSteps, clickSquareSteps } from '@/lib/admin/questionSteps';
import type { ChoiceStepState, ClickSquareStepState } from '@/lib/admin/questionSteps';

const C: ChoiceStepState = {
  instruction: '', promptImage: '', optionCountChosen: false,
  answerKindChosen: false, options: ['', ''], answerKind: 'sentence',
  difficultyChosen: false,
};

describe('choiceSteps — Cümle', () => {
  it('6 adım, kullanıcının sırasıyla', () => {
    expect(choiceSteps(C, 'sentence_question').map((s) => s.label)).toEqual([
      'Talimatı Gir', 'Seçenek Sayısını Belirle', 'Cevap Tipini Belirle',
      'Cevapları Gir', 'Zorluk Düzeyini Belirle', 'Soruyu Ekle',
    ]);
  });

  it('varsayılanlar tıklanmadan "Belirle" adımları tamamlanmaz (tuzak)', () => {
    const steps = choiceSteps(C, 'sentence_question');
    expect(steps[1].done).toBe(false);
    expect(steps[2].done).toBe(false);
    expect(steps[4].done).toBe(false);
  });

  it('Cevapları Gir: tüm şıklar doluysa tamamlanır', () => {
    expect(choiceSteps({ ...C, options: ['a', ''] }, 'sentence_question')[3].done).toBe(false);
    expect(choiceSteps({ ...C, options: ['a', 'b'] }, 'sentence_question')[3].done).toBe(true);
  });

  it('Soruyu Ekle yalnızca diğer hepsi bitince ✓ olur', () => {
    const full: ChoiceStepState = {
      instruction: 'Soru?', promptImage: '', optionCountChosen: true,
      answerKindChosen: true, options: ['a', 'b'], answerKind: 'sentence',
      difficultyChosen: true,
    };
    expect(choiceSteps(full, 'sentence_question').at(-1)?.done).toBe(true);
    expect(choiceSteps({ ...full, instruction: '' }, 'sentence_question').at(-1)?.done).toBe(false);
  });
});

describe('choiceSteps — Görüntü', () => {
  it('7 adım; 1.si Soru Görseli Seç', () => {
    const steps = choiceSteps(C, 'image_question');
    expect(steps).toHaveLength(7);
    expect(steps[0].label).toBe('Soru Görseli Seç');
    expect(steps[0].done).toBe(false);
    expect(choiceSteps({ ...C, promptImage: 'data:image/png;base64,x' },
      'image_question')[0].done).toBe(true);
  });
});

describe('clickSquareSteps', () => {
  const K: ClickSquareStepState = {
    instruction: '', setupFen: '8/8/8/8/8/8/8/8 w - - 0 1', turnChosen: false,
    savedFen: null, targets: [], difficultyChosen: false,
  };

  it('7 adım, kullanıcının sırasıyla', () => {
    expect(clickSquareSteps(K).map((s) => s.label)).toEqual([
      'Talimatı Gir', 'Konum Diz', 'Hamle Sırasını Belirle', 'Konumu Kaydet',
      'Doğru Kare(leri) Seç', 'Zorluk Düzeyini Belirle', 'Soruyu Ekle',
    ]);
  });

  it('Konum Diz: tahtada taş olunca tamamlanır', () => {
    expect(clickSquareSteps(K)[1].done).toBe(false);
    expect(clickSquareSteps({ ...K, setupFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1' })[1].done).toBe(true);
  });

  it('Konumu Kaydet ve Doğru Kareler sıralı çalışır', () => {
    const s = clickSquareSteps({ ...K, savedFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', targets: ['e4'] });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(true);
  });
});
```

- [ ] **Step 2: Kırmızıyı gör** — `npx vitest run tests/question-steps.test.ts` → modül yok, FAIL.

- [ ] **Step 3: `questionSteps.ts` uygula**

```ts
import { hasPieces } from '@/lib/admin/movePieceSteps';
import type { StepInfo } from '@/lib/admin/movePieceSteps';

/** Cumle/Goruntu akislarinin adim durumu. "Belirle" adimlari BILFIIL tiklama
 *  ister — varsayilan degerlere bakmak kilidi islevsiz birakir (P7 karari). */
export interface ChoiceStepState {
  instruction: string;
  promptImage: string;
  optionCountChosen: boolean;
  answerKindChosen: boolean;
  options: string[];
  answerKind: 'sentence' | 'image';
  difficultyChosen: boolean;
}

export interface ClickSquareStepState {
  instruction: string;
  setupFen: string;
  turnChosen: boolean;
  /** "Konumu Kaydet" sonrasi kilitlenen konum; null = henuz kaydedilmedi. */
  savedFen: string | null;
  targets: string[];
  difficultyChosen: boolean;
}

function withFinal(labels: string[], done: boolean[]): StepInfo[] {
  // "Soruyu Ekle" son satirdir: oncekilerin HEPSI bitince ✓.
  const all = [...done, done.every(Boolean)];
  return [...labels, 'Soruyu Ekle'].map((label, i) => ({ no: i + 1, label, done: all[i] }));
}

export function choiceSteps(
  s: ChoiceStepState,
  kind: 'sentence_question' | 'image_question',
): StepInfo[] {
  const answersDone = s.options.length >= 2 && s.options.every((o) => o.trim().length > 0);
  const base: [string, boolean][] = [
    ['Talimatı Gir', s.instruction.trim().length > 0],
    ['Seçenek Sayısını Belirle', s.optionCountChosen],
    ['Cevap Tipini Belirle', s.answerKindChosen],
    ['Cevapları Gir', answersDone],
    ['Zorluk Düzeyini Belirle', s.difficultyChosen],
  ];
  if (kind === 'image_question') {
    base.unshift(['Soru Görseli Seç', s.promptImage.length > 0]);
  }
  return withFinal(base.map(([l]) => l), base.map(([, d]) => d));
}

export function clickSquareSteps(s: ClickSquareStepState): StepInfo[] {
  const base: [string, boolean][] = [
    ['Talimatı Gir', s.instruction.trim().length > 0],
    ['Konum Diz', hasPieces(s.setupFen)],
    ['Hamle Sırasını Belirle', s.turnChosen],
    ['Konumu Kaydet', s.savedFen !== null],
    ['Doğru Kare(leri) Seç', s.targets.length > 0],
    ['Zorluk Düzeyini Belirle', s.difficultyChosen],
  ];
  return withFinal(base.map(([l]) => l), base.map(([, d]) => d));
}

export function firstIncomplete(steps: StepInfo[]): StepInfo | null {
  return steps.find((st) => !st.done) ?? null;
}

export function allDone(steps: StepInfo[]): boolean {
  return steps.every((st) => st.done);
}
```

- [ ] **Step 4: `movePieceSteps.ts` genişlet**

- `MovePieceStepState`'e `turnChosen: boolean` ekle (yorumuyla).
- Etiketleri değiştir:

```ts
export const MOVE_PIECE_STEP_LABELS = [
  'Talimatı Gir',
  'Konum Diz',
  'Hamle Sırasını Belirle',
  'Konumu Kaydet',
  'Cevap Hamlelerini Yap ve Notasyon Oluştur',
  'Notasyonu Kaydet',
  'Zorluk Düzeyini Belirle',
  'Soruyu Ekle',
] as const;
```

- `movePieceSteps` içindeki `done` dizisi: talimat, hasPieces, `s.turnChosen`,
  moveFen, moves, notationSaved, difficultyChosen + son eleman `done.every(...)`
  ("Soruyu Ekle").

- [ ] **Step 5: `move-piece-steps.test.ts`'i yeni etikete/duruma güncelle** — mevcut
  beklentiler ("Talimat Ekle", 6 adım) yeni gerçeğe çevrilir; `turnChosen` senaryosu
  eklenir (false iken adım 3 eksik, true olunca ✓).

- [ ] **Step 6: Yeşili gör + commit**

```bash
npx vitest run tests/question-steps.test.ts tests/move-piece-steps.test.ts
git add apps/web/lib/admin/ apps/web/tests/question-steps.test.ts apps/web/tests/move-piece-steps.test.ts
git commit -m "feat: dort akisin adim mantigi (saf) - kullanicinin siralari"
```

---

## Task 2: `StepList` bileşeni + Konum akışları (Kareye Tıkla fazı, sıra seçimi)

**Files:**
- Create: `apps/web/components/admin/StepList.tsx`
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Test: `apps/web/tests/exercise-form-move-piece.test.tsx` (güncelle), `apps/web/tests/exercise-form-click-square-steps.test.tsx` (yeni)

- [ ] **Step 1: `StepList.tsx`** — mevcut `<ol>` bloğu (ExerciseForm ~250-272) buraya
taşınır, `steps`, `missingNo`, `ariaLabel` prop'larıyla; görünüm aynen korunur.

- [ ] **Step 2: `BoardExerciseFields` değişiklikleri**

- Yeni state: `savedFen: string | null` (başlangıç: `initial?.type === 'click_square' ? initial.fen ?? null : null`),
  `turnChosen` (başlangıç `!!initial`).
- `BoardEditor onTurnChange={(t) => { setTurn(t); setTurnChosen(true); }}` (hem
  click_square dalında hem `MovePieceFields`'a giden `onSetupTurnChange`'te).
- **Kareye Tıkla fazı:** `savedFen === null` iken BoardEditor + altında
  "Konumu Kaydet" düğmesi (`disabled={!hasPieces(fen)}`; tıklanınca `setSavedFen(fen)`).
  `savedFen !== null` iken BoardEditor gizlenir; "Konum kaydedildi ✓" satırı +
  "Konumu Değiştir" düğmesi (tıklanınca `setSavedFen(null)` ve **`setTargets([])`** —
  konum değişirse eski kareler geçersiz olabilir, bilinçli sıfırlama) + Doğru Kare(ler)
  `SquarePicker` yalnız bu fazda görünür.
- `validate()` click_square için: `if (!savedFen) return 'Önce "Konumu Kaydet"e bas';`
- `submit()` click_square için `base.fen = savedFen!`.
- Adım listeleri: `type === 'click_square'` → `clickSquareSteps` + `StepList`
  (`aria-label="Kareye Tıkla adımları"`); `move_piece` mevcut liste `StepList`'e geçer.
- **Kilit:** `gateOpen` artık iki tip için de hesaplanır:
  `click_square` → `allDone(clickSquareSteps(...))`, `move_piece` → mevcut
  `allStepsDone` (turnChosen dahil). Eksik satırı iki tipte de gösterilir.

- [ ] **Step 3: Testler**

`exercise-form-move-piece.test.tsx` güncellenir: 8 adım, `'1. Talimatı Gir'`,
`'3. Hamle Sırasını Belirle'`; "Siyah"a tıklayınca adım 3 ✓ (BoardEditor turn düğmesi
"Siyah" metinli — P7'de doğrulandı). `'Eksik: 1. Talimat Ekle'` → `'Eksik: 1. Talimatı Gir'`.

Yeni `exercise-form-click-square-steps.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

function openClickSquare() {
  render(<ExerciseForm onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByText('Konum ekle'));   // varsayilan tip click_square
}

describe('ExerciseForm — Kareye Tıkla 7 adım', () => {
  it('yedi adım sırayla listelenir', () => {
    openClickSquare();
    const list = screen.getByLabelText('Kareye Tıkla adımları');
    const texts = Array.from(list.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(texts).toHaveLength(7);
    expect(texts[0]).toContain('1. Talimatı Gir');
    expect(texts[3]).toContain('4. Konumu Kaydet');
    expect(texts[6]).toContain('7. Soruyu Ekle');
  });

  it('konum kaydedilmeden Doğru Kare seçici GÖRÜNMEZ', () => {
    openClickSquare();
    expect(screen.queryByText(/Doğru kare\(ler\)/)).not.toBeInTheDocument();
  });

  it('eksik adım varken Soruyu ekle devre dışıdır', () => {
    openClickSquare();
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
  });

  it('KURAL #3: kayıtlı soru düzenlenirken tüm adımlar tamam, buton etkin', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={{
      type: 'click_square', instruction: 'e4 karesine tıkla',
      fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', target_squares: ['e4'], difficulty: 2,
    }} />);
    expect(screen.getByText('Soruyu kaydet')).toBeEnabled();
    expect(screen.queryByText(/Eksik:/)).not.toBeInTheDocument();
  });
});
```

Eski `'REGRESYON: Kareye tıkla hâlâ tahta + hedef-kare seçici gösterir'` testi yeni
faza göre güncellenir (seçici artık kayıttan sonra görünür).

- [ ] **Step 4: Yeşil + commit**

```bash
npx vitest run tests/exercise-form-move-piece.test.tsx tests/exercise-form-click-square-steps.test.tsx
git add apps/web/components/admin/ apps/web/tests/
git commit -m "feat: Konum akislari adim listeleri - Kareye Tikla fazi + hamle sirasi"
```

---

## Task 3: Cümle/Görüntü adım listeleri + kilit

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Test: `apps/web/tests/choice-exercise-steps.test.tsx` (yeni)

- [ ] **Step 1: Bileşen değişiklikleri**

- Yeni state (hepsi düzenlemede `true` başlar — KURAL #3):
  `optionCountChosen`, `answerKindChosen`, `difficultyChosen` — başlangıç
  `draft?.optionCountChosen ?? !!initial` deseniyle; `ChoiceDraft`'a üç alan eklenir.
- Seçenek sayısı düğmeleri `setCount` çağrısında `setOptionCountChosen(true)`;
  cevap tipi düğmeleri `setAnswerKindChosen(true)`; zorluk düğmeleri
  `setDifficultyChosen(true)`.
- `choiceSteps` + `StepList` formun üstüne: `aria-label` Cümle'de
  `"Cümle Ekle adımları"`, Görüntü'de `"Görüntü Ekle adımları"`.
- Kaydet düğmesi `disabled={saving || !allDone(steps)}`; eksik satırı gösterilir
  (`Eksik: <no>. <label>`).

- [ ] **Step 2: Testler** — `choice-exercise-steps.test.tsx`: Cümle listesi 6 satır;
Görüntü listesi 7 ve 1.si "Soru Görseli Seç"; varsayılan tıklanmadan "Seçenek
Sayısını Belirle" ✓ değil, "3" düğmesine basınca ✓; tüm adımlar bitmeden kaydet
devre dışı; düzenlemede (`initial` dolu) eksik yok + buton etkin; taslak
gidiş-dönüşünde bayraklar korunur (Cümle'de zorluk seç → Görüntü → dön → hâlâ ✓).

- [ ] **Step 3: Yeşil + regresyon** — mevcut `choice-exercise-*.test.tsx` dosyaları
  kaydet kilidi yüzünden kırılabilir (testler alanları doldurmadan submit ediyorsa):
  kırılanlar akışa uygun biçimde güncellenir (alanlar doldurulup tıklanır), davranış
  gevşetilmez.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/tests/
git commit -m "feat: Cumle/Goruntu adim listeleri + Soruyu ekle kilidi"
```

---

## Task 4: Tam test kapısı

- [ ] `cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run && npm run build`
  — tsc 0, lint 0 hata, testler PASS (gerçek sayı rapor edilir), build OK.
- [ ] `git diff --stat <ilk-commit-öncesi> -- apps/api` → boş (backend dokunulmadı).

## Task 5: Canlı doğrulama (KURAL #6) + Bitirme

- [ ] Kullanıcıya sor; onaylarsa admin ekranında dört akışın adım listeleri ve
  kilitleri tıklanarak doğrulanır (tek öğretmen oturumu YETER; soru KAYDEDİLMEZ).
- [ ] finishing-a-development-branch: test doğrula, seçenek sun, push kullanıcı onayıyla.

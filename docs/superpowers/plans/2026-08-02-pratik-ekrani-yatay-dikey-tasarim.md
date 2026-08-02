# Pratik Ekranı Dikey/Yatay Tasarım — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sporcunun soru çözdüğü pratik ekranı (Süresiz/Süreli Pratik Yap, Kendini Test Et) dikey kullanımda tahta üstte–içerik altta, yatay kullanımda tahta solda–içerik sağda görünsün; cihaz çevrilince kendiliğinden değişsin.

**Architecture:** Maç ekranında (`MatchLayout.tsx` + `.match-grid`) kanıtlanan yöntem: TEK DOM ağacı, CSS Grid `grid-template-areas` + `@media (orientation: landscape)` ile yeniden konumlama. Hiçbir öğe iki kez render edilmez, JS tabanlı yön algılama yok. Çoktan seçmeli soruların görseli ile şıkları şu an tek bileşende iç içe olduğu için önce ikiye ayrılır.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v3, Vitest + Testing Library.

---

## Dosya Yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/components/lesson-steps/ChoiceQuestionVisual.tsx` (YENİ) | Çoktan seçmeli sorunun GÖRSEL kısmı (resim / boş tahta ızgarası) |
| `apps/web/components/lesson-steps/ChoiceQuestionAnswers.tsx` (YENİ) | Çoktan seçmeli sorunun talimat kartı + şık butonları |
| `apps/web/components/lesson-steps/ChoiceQuestionBody.tsx` (DEĞİŞİR) | Yukarıdaki ikisini sırayla render eder — geriye uyumlu kabuk |
| `apps/web/app/globals.css` (DEĞİŞİR) | `.practice-grid` ve `.practice-shell` yerleşim kuralları |
| `apps/web/components/lesson-steps/BoardExercise.tsx` (DEĞİŞİR) | `board` / `content` alanlarına ayrım + KOD etiketi |
| `apps/web/app/(child)/pratik/[mode]/page.tsx` (DEĞİŞİR) | Yatayda genişleyen dış kapsayıcı |

---

### Task 1: ChoiceQuestionBody'yi görsel + cevaplar olarak ikiye ayır

Çoktan seçmeli sorularda görsel (veya boş tahta) `board` alanına, talimat+şıklar `content`
alanına gitmeli. Şu an ikisi de `ChoiceQuestionBody.tsx` içinde tek fragment. Mevcut 3 test
dosyası (`choice-question-body*.test.tsx`) bu bileşeni DOĞRUDAN render ediyor, bu yüzden
`ChoiceQuestionBody` aynı çıktıyı vermeye devam edecek — sadece içi iki alt bileşene bölünecek.

**Files:**
- Create: `apps/web/components/lesson-steps/ChoiceQuestionVisual.tsx`
- Create: `apps/web/components/lesson-steps/ChoiceQuestionAnswers.tsx`
- Modify: `apps/web/components/lesson-steps/ChoiceQuestionBody.tsx` (tamamı)
- Test: mevcut `apps/web/tests/choice-question-body.test.tsx`, `choice-question-body-image-placement.test.tsx`, `choice-question-body-multi-image.test.tsx` DEĞİŞMEDEN geçmeli

- [ ] **Step 1: Mevcut testleri çalıştır, YEŞİL olduklarını gör (temel çizgi)**

```bash
cd apps/web && npx vitest run tests/choice-question-body.test.tsx tests/choice-question-body-image-placement.test.tsx tests/choice-question-body-multi-image.test.tsx
```

Beklenen: 3 dosya, hepsi PASS. (Bu, refactor öncesi temel çizgi — sonra aynı sonucu bekliyoruz.)

- [ ] **Step 2: `ChoiceQuestionVisual.tsx` oluştur**

```tsx
'use client';
import type { ChoiceTypeConfig } from './BoardExercise';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';
import { toneToFilter } from '@/lib/chess/imagePlacement';

interface Props {
  exercise: ChoiceTypeConfig;
}

/** Çoktan seçmeli sorunun GÖRSEL kısmı — resim veya boş tahta ızgarası.
 *  Yatay yerleşimde tahtanın olduğu alana (`board`) konur; cümle tipi
 *  sorularda hiçbir şey render etmez (görsel yok). */
export function ChoiceQuestionVisual({ exercise }: Props) {
  const hasMulti = exercise.type === 'image_question'
    && !!exercise.prompt_images && exercise.prompt_images.length > 0;
  const hasLegacyPlacement = exercise.type === 'image_question' && !hasMulti && exercise.image_x !== undefined;

  return (
    <>
      {exercise.type === 'image_question' && !hasMulti && !hasLegacyPlacement && (
        <div className="rounded-xl overflow-hidden" style={{ maxWidth: 340, margin: '0 auto' }}>
          <img src={exercise.prompt_image} alt="Soru görseli"
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
        </div>
      )}

      {exercise.type === 'image_question' && hasLegacyPlacement && (
        <div style={{ maxWidth: 340, margin: '0 auto' }}>
          {exercise.image_show_board !== false ? (
            <EmptyBoardGrid>
              <img src={exercise.prompt_image} alt="Soru görseli" draggable={false}
                style={{
                  position: 'absolute',
                  left: `${exercise.image_x}%`, top: `${exercise.image_y}%`,
                  width: `${exercise.image_w}%`, height: `${exercise.image_h}%`,
                  transform: 'translate(-50%, -50%)',
                  filter: toneToFilter(exercise.image_tone ?? 0),
                  objectFit: 'contain',
                }} />
            </EmptyBoardGrid>
          ) : (
            <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
              <img src={exercise.prompt_image} alt="Soru görseli" draggable={false}
                style={{
                  position: 'absolute',
                  left: `${exercise.image_x}%`, top: `${exercise.image_y}%`,
                  width: `${exercise.image_w}%`, height: `${exercise.image_h}%`,
                  transform: 'translate(-50%, -50%)',
                  filter: toneToFilter(exercise.image_tone ?? 0),
                  objectFit: 'contain',
                }} />
            </div>
          )}
        </div>
      )}

      {exercise.type === 'image_question' && hasMulti && (
        <div style={{ maxWidth: 340, margin: '0 auto' }}>
          {exercise.image_show_board !== false ? (
            <EmptyBoardGrid>
              {exercise.prompt_images!.map((img, i) => (
                <img key={i} src={img.uri} alt={`Görsel ${i + 1}`} draggable={false}
                  style={{
                    position: 'absolute',
                    left: `${img.x}%`, top: `${img.y}%`,
                    width: `${img.w}%`, height: `${img.h}%`,
                    transform: 'translate(-50%, -50%)',
                    filter: toneToFilter(img.tone),
                    objectFit: 'contain',
                  }} />
              ))}
            </EmptyBoardGrid>
          ) : (
            <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
              {exercise.prompt_images!.map((img, i) => (
                <img key={i} src={img.uri} alt={`Görsel ${i + 1}`} draggable={false}
                  style={{
                    position: 'absolute',
                    left: `${img.x}%`, top: `${img.y}%`,
                    width: `${img.w}%`, height: `${img.h}%`,
                    transform: 'translate(-50%, -50%)',
                    filter: toneToFilter(img.tone),
                    objectFit: 'contain',
                  }} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: `ChoiceQuestionAnswers.tsx` oluştur**

```tsx
'use client';
import type { ChoiceTypeConfig } from './BoardExercise';

interface Props {
  exercise: ChoiceTypeConfig;
  disabled: boolean;
  onAnswer: (index: number) => void;
}

/** Çoktan seçmeli sorunun talimat kartı + şık butonları.
 *  Yatay yerleşimde tahtanın YANINDAKİ alana (`content`) konur. */
export function ChoiceQuestionAnswers({ exercise, disabled, onAnswer }: Props) {
  const gridCols = exercise.options.length === 2 ? 'grid-cols-2'
    : exercise.options.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2';

  return (
    <>
      {exercise.instruction && (
        <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
          style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
          <span className="text-xl leading-none flex-shrink-0">🎯</span>
          <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
        </div>
      )}

      <div className={`grid ${gridCols} gap-2`}>
        {exercise.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(i)}
            className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
            style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
          >
            {exercise.answer_kind === 'image'
              ? <img src={opt} alt={`Seçenek ${i + 1}`} style={{ width: '100%', maxHeight: 96, objectFit: 'contain' }} />
              : opt}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: `ChoiceQuestionBody.tsx`'i ince kabuğa indir (tüm dosyayı bununla değiştir)**

```tsx
'use client';
import type { ChoiceTypeConfig } from './BoardExercise';
import { ChoiceQuestionVisual } from './ChoiceQuestionVisual';
import { ChoiceQuestionAnswers } from './ChoiceQuestionAnswers';

interface Props {
  exercise: ChoiceTypeConfig;
  disabled: boolean;
  onAnswer: (index: number) => void;
}

/** Çoktan seçmeli sorunun TAMAMI — görsel + cevaplar.
 *  Yerleşimi dikey/yatay ayıran `BoardExercise` iki parçayı AYRI AYRI
 *  kullanır; bu kabuk geriye uyumluluk için (ve tek parça isteyen yerler
 *  için) ikisini sırayla render etmeye devam eder. */
export function ChoiceQuestionBody({ exercise, disabled, onAnswer }: Props) {
  return (
    <>
      <ChoiceQuestionVisual exercise={exercise} />
      <ChoiceQuestionAnswers exercise={exercise} disabled={disabled} onAnswer={onAnswer} />
    </>
  );
}
```

- [ ] **Step 5: Aynı testleri tekrar çalıştır — davranış DEĞİŞMEMELİ**

```bash
cd apps/web && npx vitest run tests/choice-question-body.test.tsx tests/choice-question-body-image-placement.test.tsx tests/choice-question-body-multi-image.test.tsx
```

Beklenen: Step 1 ile AYNI sonuç — 3 dosya PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/ChoiceQuestionVisual.tsx apps/web/components/lesson-steps/ChoiceQuestionAnswers.tsx apps/web/components/lesson-steps/ChoiceQuestionBody.tsx
git commit -m "refactor: coktan secmeli soru gorsel ve cevaplar olarak ayrildi"
```

---

### Task 2: `.practice-grid` ve `.practice-shell` CSS kurallarını ekle

**Files:**
- Modify: `apps/web/app/globals.css` (dosyanın SONUNA eklenir, `.match-grid` bloğundan sonra)

- [ ] **Step 1: CSS'i dosyanın sonuna ekle**

```css
/* Pratik ekranı (Süresiz/Süreli Pratik Yap, Kendini Test Et) yerleşimi —
   bkz. components/lesson-steps/BoardExercise.tsx.
   Maç ekranıyla (.match-grid) aynı yöntem: dikey/yatay için AYRI JSX YOK,
   aynı öğeler grid-template-areas ile yeniden konumlanır. */
.practice-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-areas:
    "board"
    "content";
}
.practice-grid > .pg-board   { grid-area: board; min-width: 0; }
.practice-grid > .pg-content { grid-area: content; min-width: 0; }

/* Tahtanın solundaki dikey KOD yazısı — tahta kutusunun DIŞINDA durur,
   kutunun içindeki 8-7-6 rakam sütunuyla çakışmaz. */
.pg-code {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  letter-spacing: 0.08em;
  white-space: nowrap;
}

@media (orientation: landscape) {
  .practice-grid {
    /* Sabit rem — vw KULLANILMAZ: maç ekranında vw yüzünden geniş
       masaüstü ekranda tahta ezilmişti, o hata tekrarlanmıyor. */
    grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
    grid-template-areas: "board content";
    align-items: start;
  }
}

/* Pratik sayfasının dış kapsayıcısı: dikeyde max-w-lg (32rem) ile aynı,
   yatayda tahta + içerik yan yana sığsın diye genişler. */
.practice-shell { max-width: 32rem; }
@media (orientation: landscape) {
  .practice-shell { max-width: 60rem; }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat: pratik ekrani icin dikey/yatay grid kurallari"
```

---

### Task 3: `BoardExercise.tsx`'i board / content alanlarına ayır + KOD etiketi

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx` (import satırı, satır 441-558 arası render bloğu)
- Test: `apps/web/tests/board-exercise-layout.test.tsx` (YENİ)

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/board-exercise-layout.test.tsx` dosyasını oluştur:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const clickEx: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'Beyaz şaha tıkla',
  fen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  target_squares: ['e4'],
  code: '004',
};

const choiceEx: BoardExerciseConfig = {
  type: 'sentence_question',
  instruction: 'Doğru olanı seç',
  options: ['A Şıkkı', 'B Şıkkı', 'C Şıkkı'],
  correct_index: 0,
  answer_kind: 'sentence',
  code: '007',
};

function renderEx(exercise: BoardExerciseConfig) {
  return render(
    <BoardExercise exercises={[exercise]} done={false} onCorrect={vi.fn()} />,
  );
}

describe('BoardExercise — dikey/yatay yerleşim iskeleti', () => {
  it('tahta ve içerik AYRI alanlara konur (tek grid, tek DOM ağacı)', () => {
    const { container } = renderEx(clickEx);
    expect(container.querySelector('.practice-grid')).toBeInTheDocument();
    expect(container.querySelectorAll('.pg-board')).toHaveLength(1);
    expect(container.querySelectorAll('.pg-content')).toHaveLength(1);
  });

  it('tahta kutusu board alanının İÇİNDE durur', () => {
    const { container } = renderEx(clickEx);
    const board = container.querySelector('.pg-board');
    expect(board?.querySelector('[data-testid="board-exercise-coord-frame"]')).toBeInTheDocument();
  });

  it('talimat kartı content alanının İÇİNDE durur', () => {
    const { container } = renderEx(clickEx);
    const content = container.querySelector('.pg-content');
    expect(content?.textContent).toContain('Beyaz şaha tıkla');
  });

  it('çoktan seçmeli soruda şıklar content alanında durur', () => {
    const { container } = renderEx(choiceEx);
    const content = container.querySelector('.pg-content');
    expect(content?.textContent).toContain('A Şıkkı');
    expect(content?.textContent).toContain('C Şıkkı');
  });

  it('KOD yazısı board alanında görünür, ilerleme çubuğunun yanındaki eski rozet YOKTUR', () => {
    const { container } = renderEx(clickEx);
    const board = container.querySelector('.pg-board');
    expect(board?.querySelector('.pg-code')?.textContent).toContain('004');
    // Eski rozet ("#004") kaldırıldı — kod SADECE bir kez görünür.
    expect(screen.queryByText('#004')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/board-exercise-layout.test.tsx
```

Beklenen: FAIL — `.practice-grid` bulunamaz (henüz eklenmedi).

**NOT:** Kullanılan prop imzası (`exercises` / `done` / `onCorrect`) gerçek koddan
doğrulandı — `BoardExercise.tsx:192` ve mevcut `tests/board-exercise-click-square.test.tsx:14`
ile aynı.

- [ ] **Step 3: Import satırını güncelle**

`BoardExercise.tsx` satır 6'daki

```tsx
import { ChoiceQuestionBody } from './ChoiceQuestionBody';
```

satırını şununla değiştir:

```tsx
import { ChoiceQuestionVisual } from './ChoiceQuestionVisual';
import { ChoiceQuestionAnswers } from './ChoiceQuestionAnswers';
```

- [ ] **Step 4: İlerleme satırındaki eski KOD rozetini kaldır**

`BoardExercise.tsx` satır 445-459 arasındaki blokta, kod rozeti kısmını sil. Blok şu hale gelir:

```tsx
      {/* Progress */}
      <div className="flex items-center justify-between">
        <ProgressDots total={total} current={currentIdx} doneCount={doneCount} />
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-muted)' }}>
          Soru {currentIdx + 1}/{total}
        </span>
      </div>
```

(Kod artık tahtanın solunda dikey yazı olarak gösterildiği için buradaki `#{exercise.code}`
rozeti tekrar olurdu.)

- [ ] **Step 5: Üç dallı render bloğunu board/content ayrımına çevir**

`BoardExercise.tsx` satır 461-558 arasındaki `{exercise.type === 'move_piece' && 'moves' in exercise ? (...)}`
ile başlayıp `<ChoiceQuestionBody .../>` ile biten TÜM bloğu şununla değiştir:

```tsx
      <div className="practice-grid">
        <div className="pg-board">
          <div className="flex items-stretch gap-1.5">
            {exercise.code && (
              <span
                className="pg-code flex-shrink-0 flex items-center justify-center text-[10px] font-mono font-bold select-none"
                style={{ color: 'var(--t-muted)' }}
              >
                KOD - {exercise.code}
              </span>
            )}
            <div className="flex-1 min-w-0">
              {exercise.type === 'move_piece' && 'moves' in exercise ? (
                /*
                  key ZORUNLU: MovePieceSolver oynanan hamleleri kendi state'inde tutuyor.
                  key olmadan React soru değişince aynı örneği yeniden kullanır ve önceki
                  sorunun hamleleri taşınır — sonraki sorunun DOĞRU hamlesi "yanlış" sayılır
                  (canlı doğrulamada bu hata gerçekten yaşandı).
                */
                <MovePieceSolver
                  key={currentIdx}
                  exercise={exercise}
                  disabled={status !== 'idle'}
                  onSolved={() => succeed()}
                  onWrong={(msg) => failNoRetry(msg)}
                />
              ) : isBoardExercise(exercise) ? (
                /* Board — kenar rakam/harf etiketleriyle, uygulamanın ortak
                   tahta temasıyla (madde 1: eskiden ham react-chessboard
                   kullanılıyordu, tema ve notasyon uygulanmıyordu). */
                <div
                  data-testid="board-exercise-coord-frame"
                  className="w-full mx-auto p-3 rounded-2xl"
                  style={{ maxWidth: 340, backgroundColor: BOARD_CARD_BG }}
                >
                  <div className="flex">
                    <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
                      {ranks.map((r) => (
                        <span key={r} className="flex items-center justify-center font-semibold select-none"
                          style={{ fontSize: 12, color: BOARD_LABEL_COLOR }}>{r}</span>
                      ))}
                    </div>
                    <div className="aspect-square flex-1" style={BOARD_STYLE}>
                      <Chessboard
                        options={{
                          position: exercise.fen,
                          allowDragging: false,
                          squareStyles: styles,
                          onSquareClick,
                          pieces: pieceSet,
                          lightSquareStyle: { backgroundColor: boardColors.light },
                          darkSquareStyle: { backgroundColor: boardColors.dark },
                          showNotation: false,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex" style={{ paddingLeft: 18 }}>
                    {files.map((f) => (
                      <span key={f} className="flex-1 text-center font-semibold select-none"
                        style={{ fontSize: 12, color: BOARD_LABEL_COLOR }}>{f}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <ChoiceQuestionVisual exercise={exercise} />
              )}
            </div>
          </div>
        </div>

        <div className="pg-content space-y-3">
          {isBoardExercise(exercise) ? (
            <>
              {/* Talimat — tahtanın yanında/altında kart olarak */}
              <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
                style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
                <span className="text-xl leading-none flex-shrink-0">🎯</span>
                <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
              </div>

              {/* Multiple-choice for identify_piece */}
              {exercise.type === 'identify_piece' && status !== 'success' && (
                <div className="grid grid-cols-2 gap-2">
                  {exercise.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (i === exercise.correct_index) succeed();
                        else fail('Yanlış! Tekrar bak ve dene.');
                      }}
                      className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all"
                      style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Helper hint for move_piece (eski format) */}
              {exercise.type === 'move_piece' && !('moves' in exercise) && status === 'idle' && (
                <p className="text-xs" style={{ color: 'var(--t-muted)' }}>
                  {selected ? '✔ Taş seçildi — şimdi hedef kareye tıkla!' : 'Önce taşa tıkla, sonra gideceği kareye tıkla.'}
                </p>
              )}
            </>
          ) : (
            <ChoiceQuestionAnswers exercise={exercise} disabled={status === 'success'} onAnswer={onChoiceAnswer} />
          )}
        </div>
      </div>
```

**NOT — davranış farkı bilinçlidir:** Eski kodda `move_piece` (yeni format, `moves`) dalında
talimat kartı vardı ama ipucu metni yoktu; eski format dalında ikisi de vardı. Yeni yapıda
talimat kartı `isBoardExercise` olan HER tipte gösterilir (ikisi de bu kapsamda), ipucu metni
ise SADECE eski format `move_piece`'te — yani her iki tip de eskisiyle aynı içeriği görür.

- [ ] **Step 6: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/board-exercise-layout.test.tsx
```

Beklenen: PASS (5 test).

- [ ] **Step 7: Mevcut BoardExercise testlerini çalıştır — hiçbiri kırılmamalı**

```bash
cd apps/web && npx vitest run tests/board-exercise-render.test.tsx tests/board-exercise-click-square.test.tsx tests/board-exercise-card-order.test.tsx tests/board-exercise-two-card-feedback.test.tsx tests/board-exercise-multi-click.test.tsx tests/board-exercise-no-retry.test.tsx tests/board-exercise-question-reset.test.tsx tests/board-exercise-move-piece-placeholder.test.tsx tests/board-exercise-board-theme.test.tsx tests/board-exercise-fail-persistence.test.tsx tests/board-exercise-onfinish.test.tsx tests/board-exercise-no-sound.test.tsx tests/click-mode-select.test.tsx
```

Beklenen: hepsi PASS. Kırılan olursa DUR ve sebebini incele — yerleşim değişikliği
davranışı değiştirmemeli.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-layout.test.tsx
git commit -m "feat: pratik sorusu tahta ve icerik ayri alanlarda, KOD tahtanin solunda"
```

---

### Task 4: Pratik sayfasının dış kapsayıcısını yatayda genişlet

**Files:**
- Modify: `apps/web/app/(child)/pratik/[mode]/page.tsx:242`

- [ ] **Step 1: Ana kapsayıcı sınıfını değiştir**

Satır 242'deki

```tsx
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto">
```

satırını şununla değiştir:

```tsx
    <main id="main-content" className="px-4 pt-5 pb-12 practice-shell mx-auto">
```

**NOT:** Aynı dosyadaki DİĞER `max-w-lg` kullanımları (satır 34 ve 42'deki yükleniyor
kabuğu) DEĞİŞMEZ — onlar tahta içermez, genişlemelerine gerek yok.

- [ ] **Step 2: Tip ve lint kontrolü**

```bash
cd apps/web && npx tsc --noEmit
```

Beklenen: çıktı yok (hata yok).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(child)/pratik/[mode]/page.tsx"
git commit -m "feat: pratik sayfasi yatayda genisleyen kapsayici"
```

---

### Task 5: Tam test kapısı ve gerçek tarayıcı doğrulaması

**Files:** (kod değişikliği yok — doğrulama görevi)

- [ ] **Step 1: Ön yüz tam test kapısı**

```bash
cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run
```

Beklenen: `tsc` sessiz, `lint` yalnızca ÖNCEDEN de var olan uyarılar (yeni hata yok),
`vitest` tüm dosyalar PASS.

- [ ] **Step 2: Geliştirme sunucusunu başlat**

`preview_start` aracını `{ name: "chess-web" }` ile çağır. Sunucu limiti doluysa DUR ve
kullanıcıya bildir — tarayıcı doğrulaması atlanamaz (KURAL #6), sadece ertelenebilir.

- [ ] **Step 3: Pratik ekranını aç**

Ana sayfadan bir alt konu → "Süresiz Pratik Yap" akışını takip et (pratik ekranı `ders` ve
`step` adres bilgisi olmadan açılmaz — doğrudan URL yazmak "ComingSoon" ekranı verir).

- [ ] **Step 4: Üç boyutta ölç**

Her boyut için `resize_window` sonra `javascript_tool` ile ölçüm al:

```js
(function() {
  const g = document.querySelector('.practice-grid');
  if (!g) return 'grid yok: ' + document.body.innerText.slice(0, 200);
  const kids = [...g.children].map(c => {
    const r = c.getBoundingClientRect();
    return { cls: c.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  return JSON.stringify({ vw: innerWidth, vh: innerHeight, cols: getComputedStyle(g).gridTemplateColumns, kids }, null, 2);
})();
```

Boyutlar ve beklenen sonuç:

| Boyut | Beklenen |
|---|---|
| `375x812` (telefon dikey) | `pg-board` ve `pg-content` ALT ALTA (aynı `x`, farklı `y`) |
| `812x375` (telefon yatay) | YAN YANA (farklı `x`, aynı `y`); tahta genişliği > 200px |
| `1600x900` (masaüstü) | YAN YANA; tahta genişliği > 280px — **maç ekranındaki ezilme hatası burada tekrarlanmamalı** |

- [ ] **Step 5: Bulunan sorun varsa düzelt ve Step 4'ü tekrarla**

- [ ] **Step 6: Sonucu kullanıcıya sade Türkçe bildir**

Ne test edildi, ne doğrulandı, ne doğrulanamadı — açıkça (KURAL #1, KURAL #6).

- [ ] **Step 7: Canlıya alma onayı**

Kullanıcı bu iş için "canlıya al" dedi. Test kapısı ve tarayıcı doğrulaması TEMİZ ise:

```bash
git push origin main
```

Kapı veya doğrulama başarısızsa gönderme — durumu bildir.

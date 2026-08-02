# Admin Soru Editörü — 4 Madde Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin soru editörüne 4 iyileştirme: sabit tahta zemini, Kareye Tıkla 8-adım + çoklu-kare modu, "Taş Nerede?" yeni tip, ve "Şeffaf Yap" düzeltmesi.

**Architecture:** Saf mantık önce `lib/*.ts`'e çıkarılıp vitest ile test edilir, sonra admin editör (`ExerciseForm`/yeni bileşenler) ve sporcu çözücülere bağlanır. Yeni alanlar `content_json` JSON'una eklenir — DB migration YOK. Backend doğrulaması (`admin.py`) yalnız ekler, eski tipleri bozmaz.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, react-chessboard 5.10, chess.js, vitest; FastAPI + python-chess (backend doğrulama), pytest.

**Spec:** `docs/superpowers/specs/2026-08-02-admin-soru-editoru-4-madde-design.md`

**Komutlar:** frontend `apps/web`, backend `apps/api` dizininden çalışır.

**Teslim sırası:** D (Şeffaf Yap) → A (Sabit tahta) → B (Kareye Tıkla) → C (Taş Nerede?).

---

## FAZ D — "Şeffaf Yap" düzeltmesi

### Task D1: Şeffaflaştırma köşe-rengi + tolerans ile çalışsın

**Files:**
- Modify: `apps/web/lib/imageTransparency.ts`
- Test: `apps/web/tests/image-transparency.test.ts` (mevcut, genişletilecek)

- [ ] **Step 1: Başarısız testleri ekle**

`apps/web/tests/image-transparency.test.ts` dosyasının SONUNA ekle:

```ts
import { removeBackground } from '@/lib/imageTransparency';

/** 3x3 görsel üret: köşeler zemin rengi, orta piksel ikon. RGBA düz dizi. */
function makeImg(bg: [number, number, number], center: [number, number, number]) {
  const w = 3, h = 3;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const isCenter = i === 4;
    const [r, g, b] = isCenter ? center : bg;
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('removeBackground — köşe rengini örnekleyip siler (madde 4)', () => {
  it('DÜZ BEYAZ zemin şeffaflaşır, ikon kalır', () => {
    const img = makeImg([255, 255, 255], [10, 20, 30]);
    removeBackground(img, 40);
    expect(img.data[0 * 4 + 3]).toBe(0);      // köşe şeffaf
    expect(img.data[4 * 4 + 3]).toBe(255);    // orta (ikon) opak
  });

  it('AÇIK GRI zemin de şeffaflaşır (eski eşik bunu kaçırıyordu)', () => {
    const img = makeImg([238, 240, 236], [10, 20, 30]);
    removeBackground(img, 40);
    expect(img.data[0 * 4 + 3]).toBe(0);      // açık gri köşe şeffaf
    expect(img.data[4 * 4 + 3]).toBe(255);    // ikon opak
  });

  it('İÇTE korunan alan (dıştan ulaşılamayan) silinmez', () => {
    // 3x3'te orta piksel ikon; köşeden ulaşılamayan yok ama renk testi:
    // ikon rengi zemine UZAK olduğu için silinmemeli.
    const img = makeImg([255, 255, 255], [255, 255, 255]);
    // orta da beyazsa ve kenara bitişikse silinir — bu beklenen davranış
    removeBackground(img, 40);
    expect(img.data[4 * 4 + 3]).toBe(0);
  });

  it('tolerans DIŞINDA kalan renk silinmez', () => {
    const img = makeImg([255, 255, 255], [10, 20, 30]);
    removeBackground(img, 5); // çok dar tolerans
    expect(img.data[4 * 4 + 3]).toBe(255);    // ikon kesin kalır
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/image-transparency.test.ts`
Expected: FAIL — `removeBackground is not exported`.

- [ ] **Step 3: removeBackground'ı ekle, makeBackgroundTransparent'i ona bağla**

`apps/web/lib/imageTransparency.ts` içinde `floodFillTransparent`'ın ALTINA ekle:

```ts
/** İki rengin kanal-bazlı en büyük farkı (0-255). Basit ve hızlı. */
function colorDistance(
  r: number, g: number, b: number,
  br: number, bg: number, bb: number,
): number {
  return Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb));
}

/**
 * KÖŞE RENGİNİ örnekleyip ona `tolerance` mesafesindeki bitişik pikselleri
 * kenardan başlayarak şeffaf yapar. Eski `floodFillTransparent` yalnız SAF
 * beyazı (>=245) siliyordu; açık gri / hafif renkli zeminlerde HİÇBİR ŞEY
 * silmiyordu (kullanıcı şikayeti). Bu sürüm zemin rengini görselden okur.
 * `imageData` YERİNDE değiştirilir.
 */
export function removeBackground(imageData: RawImageData, tolerance = 40): void {
  const { width, height, data } = imageData;
  // Dört köşenin ortalaması = zemin rengi.
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2]; }
  br = Math.round(br / 4); bg = Math.round(bg / 4); bb = Math.round(bb / 4);

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  function enqueue(x: number, y: number) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    const p = idx * 4;
    if (colorDistance(data[p], data[p + 1], data[p + 2], br, bg, bb) <= tolerance) {
      queue.push(idx);
    }
  }

  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    data[idx * 4 + 3] = 0;
    const x = idx % width;
    const y = Math.floor(idx / width);
    enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1);
  }
}
```

Sonra `makeBackgroundTransparent`'ı yeni fonksiyona bağla — mevcut gövdedeki
`floodFillTransparent(imageData, threshold);` satırını şununla değiştir:

```ts
  removeBackground(imageData, tolerance);
```

ve imzayı değiştir:

```ts
export async function makeBackgroundTransparent(dataUri: string, tolerance = 40): Promise<string> {
```

> `floodFillTransparent` fonksiyonu ve eski testleri SİLİNMEZ (başka yerde
> kullanılmıyorsa bile geriye uyumluluk için durur; mevcut testleri yeşil kalır).

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/image-transparency.test.ts`
Expected: PASS (eski + 4 yeni test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/imageTransparency.ts apps/web/tests/image-transparency.test.ts
git commit -m "fix(madde4): seffaflastirma koseden zemin rengini ornekler"
```

### Task D2: Buton düzeltmeyi kullanıyor (entegrasyon + canlı doğrulama)

**Files:**
- Modify: `apps/web/components/admin/MultiImagePlacer.tsx` (yalnız çağrı — `makeBackgroundTransparent` zaten çağrılıyor, imza uyumlu kaldı)

- [ ] **Step 1: Tip denetimi — imza değişikliği çağrıyı bozmadı mı**

Run: `npx tsc --noEmit`
Expected: hata yok (`makeBackgroundTransparent(uri)` tek argümanla hâlâ geçerli; `tolerance` varsayılanlı).

- [ ] **Step 2: Canlı doğrulama (KURAL #6)**

Yerel sunucuda (`npm run dev`) admin soru editörü → Görüntü Ekle → bir görsel seç →
"Şeffaf Yap". Beyaz/açık gri zeminin gerçekten silindiğini gözle doğrula (gerçek tarayıcı).
Doğrulanamıyorsa "çalışıyor" DENMEZ.

- [ ] **Step 3: Commit (değişiklik varsa)**

```bash
git add -A && git commit -m "test(madde4): seffaf yap canli dogrulama"
```

---

## FAZ A — Sabit tahta zemini

### Task A1: MultiImagePlacer arkasında sabit tahta zemini

**Files:**
- Modify: `apps/web/components/admin/MultiImagePlacer.tsx`
- Test: `apps/web/tests/multi-image-placer.test.tsx` (mevcut, genişletilecek)

- [ ] **Step 1: Başarısız test ekle**

`apps/web/tests/multi-image-placer.test.tsx` sonuna ekle:

```tsx
it('arkada sabit satranç tahtası zemini çizilir (madde 1)', () => {
  const { container } = render(
    <MultiImagePlacer images={[]} onChange={vi.fn()} />,
  );
  expect(container.querySelector('[data-bsa-placer-board]')).toBeTruthy();
});
```

> NOT: `MultiImagePlacer`'ın mevcut prop imzasını testin başındaki diğer
> render çağrılarından birebir kopyala (aynı zorunlu prop'lar).

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/multi-image-placer.test.tsx`
Expected: FAIL — `data-bsa-placer-board` yok.

- [ ] **Step 3: Zemini ekle**

`MultiImagePlacer.tsx`'te görsellerin yerleştirildiği kapsayıcı `div`'e (görsellerin
`position:absolute` ile üstüne bindiği alan) arka plan olarak boş tahta deseni ekle.
Kapsayıcının İLK çocuğu olarak, tıklamayı engellemeyen bir zemin katmanı:

```tsx
{/* Madde 1: sabit satranç tahtası zemini — görseller bunun ÜSTÜNDE serbest. */}
<div
  data-bsa-placer-board
  aria-hidden="true"
  className="absolute inset-0 pointer-events-none"
  style={{
    backgroundImage:
      'conic-gradient(#b9c4cf 90deg, #eef2f6 90deg 180deg, #b9c4cf 180deg 270deg, #eef2f6 270deg)',
    backgroundSize: '25% 25%',
    borderRadius: 8,
    opacity: 0.9,
  }}
/>
```

> `conic-gradient` + `%25` boyut = 8×8 dama deseni (satranç tahtası görünümü),
> ek görsel dosyası gerektirmez. Kapsayıcının `position: relative` olduğundan emin ol.

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/multi-image-placer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/MultiImagePlacer.tsx apps/web/tests/multi-image-placer.test.tsx
git commit -m "feat(madde1): gorsel yerlestiricide sabit tahta zemini"
```

### Task A2: Sporcu ekranıyla hizalama (canlı doğrulama)

**Files:** yok (yalnız doğrulama)

- [ ] **Step 1: Canlı doğrulama (KURAL #6)**

Yerel tarayıcıda admin → Görüntü Ekle: talimat ve soru-görseli alanlarında tahtanın arkada
sabit durduğunu, görsellerin üstünde serbest sürüklendiğini doğrula. Aynı soruyu sporcu
gözünden aç (`image_show_board` true) — zeminin tutarlı göründüğünü gör.

- [ ] **Step 2: Commit (gerekirse)**

```bash
git add -A && git commit -m "test(madde1): sabit tahta canli dogrulama"
```

---

## FAZ B — Kareye Tıkla 8 adım + çoklu-kare modu

### Task B1: multiSquareCheck saf mantığı

**Files:**
- Create: `apps/web/lib/play/multiSquareCheck.ts`
- Test: `apps/web/tests/multi-square-check.test.ts`

- [ ] **Step 1: Başarısız test yaz**

`apps/web/tests/multi-square-check.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluateClick } from '@/lib/play/multiSquareCheck';

describe('evaluateClick — çoklu-kare doğrulama (madde 2, all modu)', () => {
  const targets = ['e4', 'e5', 'd4'];

  it('yanlış kareye tık → wrong', () => {
    expect(evaluateClick('a1', targets, [])).toBe('wrong');
  });

  it('doğru kare ama hepsi tamamlanmadı → partial', () => {
    expect(evaluateClick('e4', targets, [])).toBe('partial');
    expect(evaluateClick('e5', targets, ['e4'])).toBe('partial');
  });

  it('son doğru kare tıklanınca → complete', () => {
    expect(evaluateClick('d4', targets, ['e4', 'e5'])).toBe('complete');
  });

  it('zaten tıklanmış doğru kareye tekrar tık → partial (yanlış sayılmaz)', () => {
    expect(evaluateClick('e4', targets, ['e4'])).toBe('partial');
  });

  it('tek hedefli soruda ilk doğru tık → complete', () => {
    expect(evaluateClick('e4', ['e4'], [])).toBe('complete');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/multi-square-check.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Modülü yaz**

`apps/web/lib/play/multiSquareCheck.ts`:

```ts
/** "Tüm cevap karelerine tıkla" modunda tek bir tıklamanın sonucu (madde 2).
 *  React yok — saf mantık.
 *  - wrong: tıklanan kare hedeflerden biri değil (1 yanlış = soru yanlış).
 *  - partial: doğru kare ama daha tıklanacak hedef var (veya zaten tıklanmış).
 *  - complete: bu tıkla TÜM hedefler tamamlandı. */
export type ClickResult = 'wrong' | 'partial' | 'complete';

export function evaluateClick(
  square: string,
  targets: string[],
  alreadyClicked: string[],
): ClickResult {
  if (!targets.includes(square)) return 'wrong';
  const set = new Set(alreadyClicked);
  set.add(square);
  const allDone = targets.every((t) => set.has(t));
  return allDone ? 'complete' : 'partial';
}
```

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/multi-square-check.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/multiSquareCheck.ts apps/web/tests/multi-square-check.test.ts
git commit -m "feat(madde2): coklu-kare dogrulama saf mantigi"
```

### Task B2: clickSquareSteps'e 8. adım (Sporcu Tıklama Sayısı)

**Files:**
- Modify: `apps/web/lib/admin/questionSteps.ts`
- Test: `apps/web/tests/question-steps.test.ts` (mevcut)

- [ ] **Step 1: Başarısız test ekle**

`apps/web/tests/question-steps.test.ts` içine (clickSquareSteps testlerinin yanına) ekle:

```ts
import { clickSquareSteps } from '@/lib/admin/questionSteps';

describe('clickSquareSteps — 8 adım (madde 2)', () => {
  const base = {
    instruction: 'x', setupFen: '8/8/8/8/4P3/8/8/8 w - - 0 1',
    turnChosen: true, savedFen: '8/8/8/8/4P3/8/8/8 w - - 0 1',
    targets: ['e4'], clickModeChosen: false, difficultyChosen: true,
  };

  it('8 satır döner (7 adım + Soruyu Ekle)', () => {
    expect(clickSquareSteps(base)).toHaveLength(8);
  });

  it('6. adım "Sporcu Tıklama Sayısını Belirle"', () => {
    expect(clickSquareSteps(base)[5].label).toBe('Sporcu Tıklama Sayısını Belirle');
  });

  it('tıklama modu seçilmeden 6. adım eksik', () => {
    expect(clickSquareSteps(base)[5].done).toBe(false);
  });

  it('mod seçilince 6. adım tamam', () => {
    expect(clickSquareSteps({ ...base, clickModeChosen: true })[5].done).toBe(true);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/question-steps.test.ts`
Expected: FAIL — `clickModeChosen` tip hatası / 6. adım yok.

- [ ] **Step 3: Adımı ekle**

`apps/web/lib/admin/questionSteps.ts` içinde `ClickSquareStepState`'e alan ekle:

```ts
export interface ClickSquareStepState {
  instruction: string;
  setupFen: string;
  turnChosen: boolean;
  savedFen: string | null;
  targets: string[];
  /** Sporcu tıklama modu (any/all) bilfiil seçildi mi (madde 2). */
  clickModeChosen: boolean;
  difficultyChosen: boolean;
}
```

`clickSquareSteps` içindeki `base` dizisine, "Doğru Kare(leri) Seç" ile "Zorluk" arasına ekle:

```ts
  const base: [string, boolean][] = [
    ['Talimatı Gir', s.instruction.trim().length > 0],
    ['Konum Diz', hasPieces(s.setupFen) || s.savedFen !== null],
    ['Hamle Sırasını Belirle', s.turnChosen],
    ['Konumu Kaydet', s.savedFen !== null],
    ['Doğru Kare(leri) Seç', s.targets.length > 0],
    ['Sporcu Tıklama Sayısını Belirle', s.clickModeChosen],
    ['Zorluk Düzeyini Belirle', s.difficultyChosen],
  ];
```

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/question-steps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin/questionSteps.ts apps/web/tests/question-steps.test.ts
git commit -m "feat(madde2): kareye tikla 8. adim - tiklama modu"
```

### Task B3: ExerciseForm — tıklama modu seçimi + veri

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Test: `apps/web/tests/click-mode-select.test.tsx`

- [ ] **Step 1: Başarısız test yaz**

`apps/web/tests/click-mode-select.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — Kareye Tıkla tıklama modu (madde 2)', () => {
  it('konum seçili tipte iki mod butonu görünür', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.getByText('Tek Kareye Tıklaması Yeterli')).toBeInTheDocument();
    expect(screen.getByText('Tüm Cevap Karelerine Tıklasın')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/click-mode-select.test.tsx`
Expected: FAIL — butonlar yok.

- [ ] **Step 3: Formda mod state'i, UI ve veri**

`BoardExerciseFields` içinde (ExerciseForm.tsx):

(a) State ekle — `difficulty` state'inin yanına:

```ts
  const [clickMode, setClickMode] = useState<'any' | 'all'>(
    (initial?.type === 'click_square' && (initial as { click_mode?: 'any' | 'all' }).click_mode) || 'any',
  );
  const [clickModeChosen, setClickModeChosen] = useState(!!initial);
```

(b) `clickSquareSteps` çağrısına `clickModeChosen` geçir:

```ts
  const clickSteps = clickSquareSteps({
    instruction, setupFen: fen, turnChosen, savedFen, targets, clickModeChosen, difficultyChosen,
  });
```

(c) `BoardExercise` tipine alan ekle (dosya başındaki interface):

```ts
  /** Sadece click_square için — sporcu tıklama modu (madde 2). Yoksa 'any'. */
  click_mode?: 'any' | 'all';
```

(d) `submit()` içinde `click_square` dalına ekle:

```ts
    if (type === 'click_square') {
      base.fen = savedFen!;
      base.target_squares = targets;
      base.click_mode = clickMode;
    }
```

(e) UI — "Doğru Kare(leri) Seç" bloğunun (SquarePicker) ALTINA, `savedFen !== null` bloğunun
içinde ekle:

```tsx
          <p className="text-xs n-muted mt-3 mb-1">Sporcu Tıklama Sayısını Belirle</p>
          <div className="flex flex-wrap gap-2">
            {([['any', 'Tek Kareye Tıklaması Yeterli'], ['all', 'Tüm Cevap Karelerine Tıklasın']] as const).map(([m, label]) => (
              <button key={m} type="button"
                onClick={() => { setClickMode(m); setClickModeChosen(true); }}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  clickMode === m && clickModeChosen ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
                }`}>{label}</button>
            ))}
          </div>
```

(f) `submit()` başarı sonrası sıfırlamaya ekle (`if (!editing)` bloğu):

```ts
        setClickMode('any'); setClickModeChosen(false);
```

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/click-mode-select.test.tsx`
Expected: PASS.

- [ ] **Step 5: Regresyon**

Run: `npx vitest run tests/difficulty-buttons.test.tsx tests/exercise-form-family.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/click-mode-select.test.tsx
git commit -m "feat(madde2): editor tiklama modu secimi + veri"
```

### Task B4: Sporcu tarafı çoklu-kare çözümü + backend + doğrulama

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/web/tests/board-exercise-multi-click.test.tsx`, `apps/api/tests/test_board_exercises.py`

- [ ] **Step 1: Sporcu tarafı başarısız test yaz**

`apps/web/tests/board-exercise-multi-click.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ onSquareClick }: { onSquareClick?: (a: { square: string; piece: null }) => void }) => (
    <div>
      {['e4', 'e5', 'a1'].map((sq) => (
        <button key={sq} onClick={() => onSquareClick?.({ square: sq, piece: null })}>{sq}</button>
      ))}
    </div>
  ),
}));

const EX = {
  type: 'click_square' as const,
  instruction: 'Tüm merkez karelere tıkla',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  target_squares: ['e4', 'e5'],
  click_mode: 'all' as const,
};

describe('BoardExercise — all modu çoklu-kare (madde 2)', () => {
  it('tek doğru kare henüz başarı DEĞİL, ikisi tamamlanınca başarı', () => {
    const onSolved = vi.fn();
    render(<BoardExercise exercise={EX} onSolved={onSolved} onFailed={vi.fn()} />);
    fireEvent.click(screen.getByText('e4'));
    expect(onSolved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('e5'));
    expect(onSolved).toHaveBeenCalled();
  });

  it('bir yanlış kare tıklanınca soru yanlış', () => {
    const onFailed = vi.fn();
    render(<BoardExercise exercise={EX} onSolved={vi.fn()} onFailed={onFailed} />);
    fireEvent.click(screen.getByText('a1'));
    expect(onFailed).toHaveBeenCalled();
  });
});
```

> NOT: `BoardExercise`'in gerçek prop adlarını (onSolved/onFailed vb.) mevcut
> testlerden (`tests/board-exercise-*.test.tsx`) birebir doğrula ve gerekiyorsa
> testi ona göre düzelt.

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/board-exercise-multi-click.test.tsx`
Expected: FAIL — all modu ilk tıkta başarı sayıyor.

- [ ] **Step 3: BoardExercise click_square dalını güncelle**

`BoardExercise.tsx`'te `evaluateClick` import et ve tıklanan kareleri biriktiren state ekle
(`clickedSquare`'in yanına):

```ts
import { evaluateClick } from '@/lib/play/multiSquareCheck';
```

```ts
  const [multiClicked, setMultiClicked] = useState<string[]>([]);
```

`onSquareClick` içindeki `click_square` dalını şununla değiştir:

```ts
    if (exercise.type === 'click_square') {
      if (piece) playPieceSound(piece.pieceType);
      setClickedSquare(square);
      // Varsayılan 'any' = eski davranış; 'all' = tüm kareler.
      if ((exercise.click_mode ?? 'any') === 'all') {
        const r = evaluateClick(square, exercise.target_squares, multiClicked);
        if (r === 'wrong') { failNoRetry(exercise.fail_msg ?? 'Yanlış kare!'); return; }
        if (r === 'complete') { succeed(); return; }
        setMultiClicked((p) => (p.includes(square) ? p : [...p, square])); // partial
        return;
      }
      if (isTargetSquare(square, exercise.target_squares)) succeed();
      else failNoRetry(exercise.fail_msg ?? 'Yanlış kare!');
      return;
    }
```

> `exercise.click_mode` tipi için `ImageQuestionEx`/`click_square` union'ında
> `click_mode?: 'any' | 'all'` alanının tanımlı olduğundan emin ol (yoksa ekle,
> dosyanın en üstündeki click_square tipine).

- [ ] **Step 4: Sporcu testini çalıştır, yeşil gör**

Run: `npx vitest run tests/board-exercise-multi-click.test.tsx`
Expected: PASS.

- [ ] **Step 5: Backend — click_mode doğrulaması (başarısız test)**

`apps/api/tests/test_board_exercises.py` sonuna ekle:

```python
def test_click_square_accepts_click_mode(client, admin_auth):
    # mevcut testlerdeki yardımcıyı kullanarak bir explanation adımı gönder;
    # click_mode 'all' kabul edilmeli.
    ex = {
        "type": "click_square", "instruction": "hepsi",
        "fen": "8/8/8/8/4P3/8/8/8 w - - 0 1",
        "target_squares": ["e4"], "click_mode": "all",
    }
    _assert_exercise_ok(client, admin_auth, ex)  # mevcut yardımcı adını kullan

def test_click_square_rejects_bad_click_mode(client, admin_auth):
    ex = {
        "type": "click_square", "instruction": "hepsi",
        "fen": "8/8/8/8/4P3/8/8/8 w - - 0 1",
        "target_squares": ["e4"], "click_mode": "saçma",
    }
    _assert_exercise_rejected(client, admin_auth, ex)  # mevcut yardımcı adını kullan
```

> `test_board_exercises.py`'deki mevcut yardımcı fonksiyon adlarını (ör.
> `_assert_exercise_ok` / benzeri) dosyadan oku ve birebir kullan.

- [ ] **Step 6: Backend doğrulamasını ekle**

`apps/api/chess_api/routers/admin.py` — `if ex_type == "click_square":` bloğunu şununla değiştir:

```python
        if ex_type == "click_square":
            _squares("target_squares")
            cm = ex.get("click_mode")
            if cm is not None and cm not in ("any", "all"):
                raise HTTPException(status_code=400, detail="click_mode 'any' veya 'all' olmalı")
```

- [ ] **Step 7: Backend testini çalıştır**

Run: `cd ../../apps/api && python -m pytest tests/test_board_exercises.py -q`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-multi-click.test.tsx apps/api/chess_api/routers/admin.py apps/api/tests/test_board_exercises.py
git commit -m "feat(madde2): sporcu coklu-kare cozumu + backend click_mode"
```

---

## FAZ C — "Taş Nerede?" yeni soru tipi

### Task C1: placePieceCheck saf mantığı

**Files:**
- Create: `apps/web/lib/play/placePieceCheck.ts`
- Test: `apps/web/tests/place-piece-check.test.ts`

- [ ] **Step 1: Başarısız test yaz**

`apps/web/tests/place-piece-check.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { placeAttempt } from '@/lib/play/placePieceCheck';

const placements = [
  { piece: 'wN', square: 'e5' },
  { piece: 'wQ', square: 'h5' },
];

describe('placeAttempt — Taş Nerede? doğrulama (madde 3)', () => {
  it('doğru taş doğru kareye → placed', () => {
    expect(placeAttempt('wN', 'e5', placements, [])).toBe('placed');
  });

  it('doğru taş yanlış kareye → wrong', () => {
    expect(placeAttempt('wN', 'd5', placements, [])).toBe('wrong');
  });

  it('son taş da doğru yerleşince → complete', () => {
    expect(placeAttempt('wQ', 'h5', placements, ['wN'])).toBe('complete');
  });

  it('tek taşlı soruda ilk doğru yerleştirme → complete', () => {
    expect(placeAttempt('wN', 'e5', [{ piece: 'wN', square: 'e5' }], [])).toBe('complete');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/place-piece-check.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Modülü yaz**

`apps/web/lib/play/placePieceCheck.ts`:

```ts
/** "Taş Nerede?" sorusunda bir yerleştirme denemesinin sonucu (madde 3).
 *  Saf mantık — React yok.
 *  - wrong: taş yanlış kareye kondu.
 *  - placed: doğru kareye kondu ama hâlâ yerleştirilecek taş var.
 *  - complete: bu yerleştirmeyle tüm taşlar doğru yerleşti. */
export interface Placement { piece: string; square: string; }
export type PlaceResult = 'wrong' | 'placed' | 'complete';

export function placeAttempt(
  piece: string,
  square: string,
  placements: Placement[],
  placedPieces: string[],
): PlaceResult {
  const target = placements.find((p) => p.piece === piece && !placedPieces.includes(p.piece));
  if (!target || target.square !== square) return 'wrong';
  const placed = new Set(placedPieces);
  placed.add(piece);
  const allDone = placements.every((p) => placed.has(p.piece));
  return allDone ? 'complete' : 'placed';
}
```

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/place-piece-check.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/play/placePieceCheck.ts apps/web/tests/place-piece-check.test.ts
git commit -m "feat(madde3): tas nerede dogrulama saf mantigi"
```

### Task C2: placePieceSteps saf mantığı (7 adım)

**Files:**
- Create: `apps/web/lib/admin/placePieceSteps.ts`
- Test: `apps/web/tests/place-piece-steps.test.ts`

- [ ] **Step 1: Başarısız test yaz**

`apps/web/tests/place-piece-steps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { placePieceSteps, allPlaceDone } from '@/lib/admin/placePieceSteps';

const full = {
  instruction: 'Atı yerine koy',
  savedFen: '8/8/8/8/8/8/8/8 w - - 0 1',
  turnChosen: true,
  pieces: [{ piece: 'wN', square: 'e5' }],
  piecesChosen: true,
  squaresChosen: true,
};

describe('placePieceSteps — 7 adım (madde 3)', () => {
  it('7 satır (6 adım + Soruyu Kaydet)', () => {
    expect(placePieceSteps(full)).toHaveLength(7);
  });

  it('etiketler sırayla doğru', () => {
    expect(placePieceSteps(full).map((s) => s.label)).toEqual([
      'Talimatı Gir', 'Konumu Diz', 'Konumu Kaydet',
      'Konuma Eklenecek Taşı Belirle', 'Taşın Doğru Karesini Belirle',
      'Hamle Sırasını Belirle', 'Soruyu Kaydet',
    ]);
  });

  it('hepsi tamamsa allPlaceDone true', () => {
    expect(allPlaceDone(full)).toBe(true);
  });

  it('talimat boşsa 1. adım eksik', () => {
    expect(placePieceSteps({ ...full, instruction: '' })[0].done).toBe(false);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/place-piece-steps.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Modülü yaz**

`apps/web/lib/admin/placePieceSteps.ts`:

```ts
import type { StepInfo } from '@/lib/admin/movePieceSteps';
import type { Placement } from '@/lib/play/placePieceCheck';

export interface PlacePieceStepState {
  instruction: string;
  /** "Konumu Kaydet" sonrası kilitlenen eksik-taşlı konum; null = kaydedilmedi. */
  savedFen: string | null;
  turnChosen: boolean;
  pieces: Placement[];
  /** Eklenecek taş(lar) bilfiil seçildi mi. */
  piecesChosen: boolean;
  /** Her taş için doğru kare bilfiil seçildi mi. */
  squaresChosen: boolean;
}

export function placePieceSteps(s: PlacePieceStepState): StepInfo[] {
  const done: boolean[] = [
    s.instruction.trim().length > 0,
    true, // Konumu Diz: eksik-taşlı konum kurmak serbest (boş tahta da meşru)
    s.savedFen !== null,
    s.piecesChosen && s.pieces.length >= 1 && s.pieces.length <= 2,
    s.squaresChosen && s.pieces.every((p) => p.square.length > 0),
    s.turnChosen,
  ];
  const labels = [
    'Talimatı Gir', 'Konumu Diz', 'Konumu Kaydet',
    'Konuma Eklenecek Taşı Belirle', 'Taşın Doğru Karesini Belirle',
    'Hamle Sırasını Belirle',
  ];
  const all = [...done, done.every(Boolean)];
  return [...labels, 'Soruyu Kaydet'].map((label, i) => ({ no: i + 1, label, done: all[i] }));
}

export function allPlaceDone(s: PlacePieceStepState): boolean {
  return placePieceSteps(s).every((st) => st.done);
}
```

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/place-piece-steps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin/placePieceSteps.ts apps/web/tests/place-piece-steps.test.ts
git commit -m "feat(madde3): tas nerede 7 adim saf mantigi"
```

### Task C3: Backend — place_piece tipini kabul et

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_board_exercises.py`

- [ ] **Step 1: Başarısız test ekle**

`apps/api/tests/test_board_exercises.py` sonuna ekle (yardımcı adlarını dosyadan doğrula):

```python
def test_place_piece_accepted(client, admin_auth):
    ex = {
        "type": "place_piece", "instruction": "Atı e5'e koy",
        "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
        "placements": [{"piece": "wN", "square": "e5"}],
    }
    _assert_exercise_ok(client, admin_auth, ex)

def test_place_piece_rejects_bad_square(client, admin_auth):
    ex = {
        "type": "place_piece", "instruction": "x",
        "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
        "placements": [{"piece": "wN", "square": "z9"}],
    }
    _assert_exercise_rejected(client, admin_auth, ex)

def test_place_piece_rejects_three_pieces(client, admin_auth):
    ex = {
        "type": "place_piece", "instruction": "x",
        "fen": "8/8/8/8/8/8/8/8 w - - 0 1",
        "placements": [
            {"piece": "wN", "square": "e5"},
            {"piece": "wQ", "square": "h5"},
            {"piece": "wR", "square": "a1"},
        ],
    }
    _assert_exercise_rejected(client, admin_auth, ex)
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `cd ../../apps/api && python -m pytest tests/test_board_exercises.py -q`
Expected: FAIL — `place_piece` geçersiz tür.

- [ ] **Step 3: Backend doğrulamasını ekle**

`admin.py`'de `BOARD_EXERCISE_TYPES`'a ekle:

```python
BOARD_EXERCISE_TYPES = ("click_square", "move_piece", "identify_piece", "place_piece")
```

`identify_piece` bloğunun ALTINA yeni dal ekle:

```python
        elif ex_type == "place_piece":
            placements = ex.get("placements")
            if not isinstance(placements, list) or not (1 <= len(placements) <= 2):
                raise HTTPException(status_code=400, detail="1 veya 2 taş yerleştirilmeli")
            for pl in placements:
                if not isinstance(pl, dict):
                    raise HTTPException(status_code=400, detail="Yerleştirme nesne olmalı")
                sq = pl.get("square")
                if sq not in chess.SQUARE_NAMES:
                    raise HTTPException(status_code=400, detail=f"Geçersiz kare: {sq}")
                pc = pl.get("piece")
                if not isinstance(pc, str) or len(pc) < 2:
                    raise HTTPException(status_code=400, detail="Taş kodu geçersiz")
```

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `python -m pytest tests/test_board_exercises.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_board_exercises.py
git commit -m "feat(madde3): backend place_piece tipini kabul eder"
```

### Task C4: Admin editör — "Taş Nerede?" akışı

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Test: `apps/web/tests/place-piece-editor.test.tsx`

- [ ] **Step 1: Başarısız test yaz**

`apps/web/tests/place-piece-editor.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — Taş Nerede? tipi (madde 3)', () => {
  it('konum seçilince üçüncü tip butonu görünür', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.getByText('Taş Nerede?')).toBeInTheDocument();
  });

  it('Taş Nerede? seçilince 7 adımlı liste görünür', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taş Nerede?'));
    expect(screen.getByText('Konuma Eklenecek Taşı Belirle')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/place-piece-editor.test.tsx`
Expected: FAIL — buton/adım yok.

- [ ] **Step 3: Editöre place_piece ekle**

`ExerciseForm.tsx` içinde:

(a) `ExerciseType`'a ekle (dosya başı):

```ts
export type ExerciseType = 'click_square' | 'move_piece' | 'identify_piece' | 'place_piece';
```

(b) `BoardExercise` tipine alan ekle:

```ts
  /** Sadece place_piece için — yerleştirilecek taş(lar) ve doğru kareleri (madde 3). */
  placements?: { piece: string; square: string }[];
```

(c) Tip seçici butonlarına 3.'yü ekle (`['click_square','Kareye tıkla'],['move_piece','Taşı oynat']` dizisine):

```ts
          ['click_square', 'Kareye tıkla'],
          ['move_piece', 'Taşı oynat'],
          ['place_piece', 'Taş Nerede?'],
```

(d) State ekle (BoardExerciseFields içi):

```ts
  const [placements, setPlacements] = useState<{ piece: string; square: string }[]>(
    (initial?.type === 'place_piece' && (initial as { placements?: { piece: string; square: string }[] }).placements) || [],
  );
  const [piecesChosen, setPiecesChosen] = useState(!!initial);
  const [squaresChosen, setSquaresChosen] = useState(!!initial);
  const [placeSavedFen, setPlaceSavedFen] = useState<string | null>(
    initial?.type === 'place_piece' ? (initial.fen ?? null) : null,
  );
```

(e) Adım listesi + kilit — `import { placePieceSteps, allPlaceDone } from '@/lib/admin/placePieceSteps';`
ekle; `gateOpen` ve `missing` hesabına place_piece dalı ekle:

```ts
  const placeSteps = placePieceSteps({
    instruction, savedFen: placeSavedFen, turnChosen, pieces: placements, piecesChosen, squaresChosen,
  });
```

`gateOpen`:

```ts
  const gateOpen = type === 'move_piece'
    ? allStepsDone(stepState)
    : type === 'click_square'
      ? allDone(clickSteps)
      : type === 'place_piece'
        ? allPlaceDone({ instruction, savedFen: placeSavedFen, turnChosen, pieces: placements, piecesChosen, squaresChosen })
        : true;
```

(f) `<StepList>` render'ına place_piece dalı:

```tsx
      {type === 'place_piece' && (
        <StepList steps={placeSteps} missingNo={missing?.no ?? null} ariaLabel="Taş Nerede? adımları" />
      )}
```

(g) place_piece UI bloğu — identify_piece bloğunun yanına ekle: BoardEditor ile eksik-taşlı
konum kur + "Konumu Kaydet" (placeSavedFen) + taş paleti (renk+tür, 1-2 taş) + her taşa kare
seçici. Taş kodu formatı `'wN'` (renk küçük + tür büyük).

```tsx
      {type === 'place_piece' && (
        <div className="space-y-3">
          {placeSavedFen === null ? (
            <button type="button" onClick={() => setPlaceSavedFen(fen)}
              className="px-4 py-2 rounded-lg text-sm bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25">
              Konumu Kaydet
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: '#34d399' }}>Konum kaydedildi ✓</span>
              <button type="button" onClick={() => { setPlaceSavedFen(null); setPlacements([]); setPiecesChosen(false); setSquaresChosen(false); }}
                className="px-3 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
                Konumu Değiştir
              </button>
            </div>
          )}

          {placeSavedFen !== null && (
            <>
              <p className="text-xs n-muted">Konuma Eklenecek Taşı Belirle (1-2 taş)</p>
              <div className="flex flex-wrap gap-2">
                {(['wN', 'wB', 'wR', 'wQ', 'wP', 'bN', 'bB', 'bR', 'bQ', 'bP'] as const).map((pc) => {
                  const on = placements.some((p) => p.piece === pc);
                  return (
                    <button key={pc} type="button"
                      onClick={() => {
                        setPiecesChosen(true);
                        setPlacements((prev) => {
                          if (prev.some((p) => p.piece === pc)) return prev.filter((p) => p.piece !== pc);
                          if (prev.length >= 2) return prev;
                          return [...prev, { piece: pc, square: '' }];
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${on ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>
                      {pc}
                    </button>
                  );
                })}
              </div>

              {placements.map((pl, i) => (
                <div key={pl.piece} className="flex items-center gap-2">
                  <span className="text-xs n-muted w-10">{pl.piece}</span>
                  <select value={pl.square}
                    onChange={(e) => { setSquaresChosen(true); setPlacements((prev) => prev.map((p, j) => (j === i ? { ...p, square: e.target.value } : p))); }}
                    className="neon-input py-1.5 text-xs max-w-[8rem]">
                    <option value="">doğru kare</option>
                    {['a','b','c','d','e','f','g','h'].flatMap((f) => [1,2,3,4,5,6,7,8].map((r) => `${f}${r}`)).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ))}
            </>
          )}
        </div>
      )}
```

(h) `submit()` içine place_piece dalı:

```ts
    if (type === 'place_piece') {
      base.fen = placeSavedFen!;
      base.placements = placements;
    }
```

(i) `validate()` içine place_piece dalı:

```ts
    if (type === 'place_piece') {
      if (!placeSavedFen) return 'Önce konumu kaydet';
      if (placements.length < 1 || placements.length > 2) return '1 veya 2 taş belirle';
      if (placements.some((p) => !p.square)) return 'Her taş için doğru kare seç';
    }
```

(j) Tip değiştirme butonundaki sıfırlama (`onClick={() => { setType(t); ... }}`) place_piece
state'ini de temizlesin:

```ts
            onClick={() => { setType(t); setTargets([]); setSavedFen(null); setPlaceSavedFen(null); setPlacements([]); setErr(null); }}
```

(k) BoardEditor gösterme koşuluna place_piece'i dahil et (konum dizmek için):
`{type !== 'move_piece' && (type !== 'click_square' || savedFen === null) && (type !== 'place_piece' || placeSavedFen === null) && (` şeklinde koşulu genişlet.

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/place-piece-editor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Regresyon**

Run: `npx vitest run tests/exercise-form-family.test.tsx tests/click-mode-select.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/place-piece-editor.test.tsx
git commit -m "feat(madde3): editor tas nerede akisi"
```

### Task C5: Sporcu — PlacePieceSolver bileşeni + BoardExercise entegrasyonu

**Files:**
- Create: `apps/web/components/lesson-steps/PlacePieceSolver.tsx`
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/place-piece-solver.test.tsx`

- [ ] **Step 1: Başarısız test yaz**

`apps/web/tests/place-piece-solver.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ onSquareClick }: { onSquareClick?: (a: { square: string; piece: null }) => void }) => (
    <div>
      {['e5', 'd5'].map((sq) => (
        <button key={sq} onClick={() => onSquareClick?.({ square: sq, piece: null })}>{sq}</button>
      ))}
    </div>
  ),
}));

import { PlacePieceSolver } from '@/components/lesson-steps/PlacePieceSolver';

const EX = {
  type: 'place_piece' as const,
  instruction: 'Atı yerine koy',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  placements: [{ piece: 'wN', square: 'e5' }],
};

describe('PlacePieceSolver — tıkla-tıkla yerleştirme (madde 3)', () => {
  it('taşı seçip doğru kareye tıklayınca çözülür', () => {
    const onSolved = vi.fn();
    render(<PlacePieceSolver exercise={EX} disabled={false} onSolved={onSolved} onWrong={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /wN/ }));  // dış taş kartı
    fireEvent.click(screen.getByText('e5'));
    expect(onSolved).toHaveBeenCalled();
  });

  it('yanlış kareye koyunca onWrong', () => {
    const onWrong = vi.fn();
    render(<PlacePieceSolver exercise={EX} disabled={false} onSolved={vi.fn()} onWrong={onWrong} />);
    fireEvent.click(screen.getByRole('button', { name: /wN/ }));
    fireEvent.click(screen.getByText('d5'));
    expect(onWrong).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `npx vitest run tests/place-piece-solver.test.tsx`
Expected: FAIL — bileşen yok.

- [ ] **Step 3: PlacePieceSolver'ı yaz**

`apps/web/components/lesson-steps/PlacePieceSolver.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { placeAttempt } from '@/lib/play/placePieceCheck';
import type { Placement } from '@/lib/play/placePieceCheck';

interface PlacePieceEx {
  type: 'place_piece';
  fen: string;
  placements: Placement[];
  fail_msg?: string;
}

interface Props {
  exercise: PlacePieceEx;
  disabled: boolean;
  onSolved: () => void;
  onWrong: (msg: string) => void;
}

/** Taş kodu 'wN' -> chess.js kutu tanımı. */
function toPiece(code: string): { type: 'p'|'n'|'b'|'r'|'q'|'k'; color: 'w'|'b' } {
  const color = code[0] === 'b' ? 'b' : 'w';
  const type = code[1].toLowerCase() as 'p'|'n'|'b'|'r'|'q'|'k';
  return { type, color };
}

export function PlacePieceSolver({ exercise, disabled, onSolved, onWrong }: Props) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // Tahtayı eksik-taşlı FEN'den kur; yerleştirilen taşları EKLE (görsel geri bildirim).
  const board = new Chess(exercise.fen, { skipValidation: true });
  for (const code of placed) {
    const pl = exercise.placements.find((p) => p.piece === code);
    if (pl) { try { board.put(toPiece(code), pl.square as Square); } catch { /* yok say */ } }
  }
  const fen = board.fen();

  const remaining = exercise.placements.filter((p) => !placed.includes(p.piece));

  function handleSquare(square: string) {
    if (disabled || !selected) return;
    const r = placeAttempt(selected, square, exercise.placements, placed);
    if (r === 'wrong') { onWrong(exercise.fail_msg ?? 'Taş oraya gitmez.'); setSelected(null); return; }
    const next = [...placed, selected];
    setPlaced(next);
    setSelected(null);
    if (r === 'complete') onSolved();
  }

  return (
    <div className="space-y-2">
      <ChessBoard
        fen={fen}
        interactive={false}
        onSquareClick={({ square }) => handleSquare(square)}
      />
      {/* Tahta DIŞINDA dairesel taş kartları — tıkla, sonra kareye tıkla. */}
      <div className="flex gap-2 justify-center">
        {remaining.map((p) => (
          <button key={p.piece} type="button" disabled={disabled}
            onClick={() => setSelected(p.piece)}
            aria-label={p.piece}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
              selected === p.piece ? 'border-cyan-400 bg-cyan-400/20' : 'border-white/30 bg-white/5'
            }`}>
            {p.piece}
          </button>
        ))}
      </div>
    </div>
  );
}
```

> Sürükle-bırak (parmakla tutup bırakma) ikinci aşamada eklenebilir; tıkla-tıkla
> akışı MVP için yeterli ve mobil dostu. react-chessboard spare-piece drag entegrasyonu
> ayrı bir görevde yapılabilir (YAGNI — önce tıkla-tıkla).

- [ ] **Step 4: Testi çalıştır, yeşil gör**

Run: `npx vitest run tests/place-piece-solver.test.tsx`
Expected: PASS.

- [ ] **Step 5: BoardExercise'e place_piece dalını bağla**

`BoardExercise.tsx`'te `MovePieceSolver` render dalının yanına, `place_piece` için
`PlacePieceSolver` render et (import + tip union'a `place_piece` ekle). `isBoardExercise`
kontrolüne `place_piece` dahil edilir:

```ts
  return ex.type === 'click_square' || ex.type === 'move_piece'
    || ex.type === 'identify_piece' || ex.type === 'place_piece';
```

Render (MovePieceSolver bloğunun yanına):

```tsx
        {isBoardExercise(exercise) && exercise.type === 'place_piece' && (
          <PlacePieceSolver
            exercise={exercise}
            disabled={status === 'success' || failLocked}
            onSolved={() => succeed()}
            onWrong={(m) => failNoRetry(m)}
          />
        )}
```

> `PlacePieceSolver`'ın beklediği `exercise` tipi için `BoardExercise`'in egzersiz
> union'ına `place_piece` varyantını ekle (fen + placements + fail_msg).

- [ ] **Step 6: Testleri çalıştır**

Run: `npx vitest run tests/place-piece-solver.test.tsx tests/board-exercise-multi-click.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/lesson-steps/PlacePieceSolver.tsx apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/place-piece-solver.test.tsx
git commit -m "feat(madde3): sporcu tas nerede cozucu"
```

---

## KAPANIŞ

### Task Z1: Tam test kapısı

- [ ] **Step 1: Tip + lint + vitest**

Run (apps/web): `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: hepsi temiz/yeşil.

- [ ] **Step 2: Backend**

Run (apps/api): `python -m pytest -q`
Expected: PASS.

- [ ] **Step 3: Commit (gerekirse)**

```bash
git add -A && git commit -m "test: admin soru editoru 4 madde test kapisi"
```

### Task Z2: Canlı doğrulama (KURAL #6) ve teslim

- [ ] **Step 1: Gerçek tarayıcıda sür**

Yerel sunucuda admin editörde: (D) Şeffaf Yap gerçekten beyazı siliyor · (A) sabit tahta
görünüyor · (B) Kareye Tıkla 8 adım + iki mod, sporcu "tümü" modunda tüm karelere tıklayınca
doğru · (C) Taş Nerede? tipi eklenebiliyor ve sporcu taşı doğru kareye koyabiliyor.

- [ ] **Step 2: Sonucu dürüst raporla (KURAL #1)**

Neyin doğrulandığı/doğrulanamadığı açıkça yazılır.

- [ ] **Step 3: Push için kullanıcı onayı al**

Bu projede dal yok; iş `main`'e gider ve canlıya deploy olur (KURAL #3). Push ÖNCESİ onay al.

```bash
git push origin main
```

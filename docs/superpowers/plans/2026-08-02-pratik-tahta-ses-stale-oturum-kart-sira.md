# Pratik Ekranı: Tahta / Ses / Bayat Oturum / Kart Sırası — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Süresiz/Süreli/Test pratik ekranındaki 4 gerçek sorunu düzeltmek: tutarsız tahta görünümü, pratikte istenmeyen ses efektleri, bilgisayar/telefon arası "4 soru / 20 soru" farkı, ve geri bildirim kartlarının yer sırası.

**Architecture:** Tamamı istemci tarafı, geriye uyumlu, migration yok. Kök nedenler kod okumasıyla kesinleştirildi (tahmin değil): (1) bazı soru tipleri paylaşılan tema yerine ham `react-chessboard` kullanıyor, (2) `BoardExercise.tsx`'te 3 yerde ses çalınıyor, (3) `sessionStorage`'daki eski bir oturum kaydı, havuz büyüdükten sonra bile hiç yenilenmiyor, (4) JSX'te kartların DOM sırası yer düzenini belirliyor.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, react-chessboard 5.10, vitest.

**Kapsam dışı:** Madde 2 (çoklu cihazdan aynı anda maç) — ayrı, daha büyük bir iş; bu planda YOK.

**Komutlar:** `apps/web` dizininden çalışır.

---

### Task 1: Kareye Tıkla / Taşı Tanı sorularında ortak tahta teması + notasyon

**Kök neden:** `BoardExercise.tsx`, `click_square` ve `identify_piece` sorularında ham
`react-chessboard`'u DOĞRUDAN çiziyor — uygulamanın geri kalanının kullandığı
`getBoardColors`/`getPieceSet` temasını ve kenar rakam/harflerini (notasyon) hiç
uygulamıyor. `move_piece` soruları ise `MovePieceSolver` üzerinden paylaşılan
`ChessBoard.tsx` bileşenini kullandığı için doğru görünüyor — tutarsızlığın sebebi bu.

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-board-theme.test.tsx` (yeni)

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/board-exercise-board-theme.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const clickSq: BoardExerciseConfig = {
  type: 'click_square', instruction: 'x',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'],
};

describe('BoardExercise — ortak tahta teması + notasyon (madde 1)', () => {
  it('click_square sorusunda KENDİ (dış) rakam/harf çerçevesi görünür', () => {
    // NOT: react-chessboard'un KENDİ varsayılan notasyonu (showNotation=true)
    // zaten kare içinde küçük "8"/"a" metinleri çizer — bu yüzden düz
    // getByText('8') testi YANLIŞ POZİTİF verir (fix olmadan bile geçer).
    // Bunun yerine ChessBoard.tsx ile AYNI dış çerçeve yapısını (data-testid)
    // arıyoruz — bu yalnız BİZİM eklediğimiz markup'ta bulunur.
    render(<BoardExercise exercises={[clickSq]} done={false} onCorrect={vi.fn()} />);
    const frame = screen.getByTestId('board-exercise-coord-frame');
    expect(frame).toBeInTheDocument();
    expect(frame.textContent).toContain('8');
    expect(frame.textContent).toContain('a');
  });

  it("react-chessboard'un KENDİ iç notasyonu kapatılır (showNotation:false)", () => {
    // Kendi dış çerçevemiz varken kütüphanenin kendi notasyonu da açık
    // kalırsa çift görünür (madde 1'in istediği "tek tip" görünümü bozar).
    const { container } = render(
      <BoardExercise exercises={[clickSq]} done={false} onCorrect={vi.fn()} />,
    );
    // react-chessboard notasyonu kare içinde <span> olarak, data-square
    // öğesinin İÇİNDE render eder — showNotation:false verilince o span'lar
    // hiç oluşmaz.
    const a1 = container.querySelector('[data-square="a1"]') as HTMLElement;
    expect(a1.querySelector('span')).toBeNull();
  });

  it('kareler uygulamanın ortak açık/koyu renklerini kullanır (varsayılan tema)', () => {
    const { container } = render(
      <BoardExercise exercises={[clickSq]} done={false} onCorrect={vi.fn()} />,
    );
    const square = container.querySelector('[data-square="a1"]') as HTMLElement;
    // react-chessboard renk stilini [data-square] elemanının KENDİSİNE
    // uygular, alt bir div'e değil. BOARD_DARK_SQUARE = '#c3c6ee' (boardSkin.tsx).
    // happy-dom hex'i rgb'ye normalize etmez, ham değer kalır.
    expect(square.style.backgroundColor).toBe('#c3c6ee');
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/board-exercise-board-theme.test.tsx`
Expected: FAIL — kenar etiketleri yok (`getByText('8')` bulunamaz).

- [ ] **Step 3: BoardExercise.tsx'e tema ve notasyon ekle**

Dosyanın import bloğuna ekle:

```ts
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
```

Bileşenin en üstüne (diğer `useState` çağrılarının yanına) ekle:

```ts
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = getPieceSet(settings.board.pieces);
  const { ranks, files } = coordLabels('white');
```

Tahta render bloğunu (satır ~476-486, `<div className="rounded-xl overflow-hidden..."><Chessboard .../></div>`)
şununla değiştir:

```tsx
          {/* Board — kenar rakam/harf etiketleriyle, uygulamanın ortak
              tahta temasıyla (madde 1: eskiden ham react-chessboard
              kullanılıyordu, tema ve notasyon uygulanmıyordu). */}
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
```

> DİKKAT: `ChessBoard.tsx`'e DOKUNULMAZ (zaten doğru çalışıyor, risk almaya gerek yok).
> Bu, `ChessBoard.tsx`'teki aynı kenar-etiket deseninin küçük/sade bir kopyasıdır —
> `BoardExercise.tsx`'in kendi tıklama mantığı (`onSquareClick`) korunur, paylaşılan
> `ChessBoard` bileşeninin hamle-seçme durum makinesi BURAYA getirilmez (o farklı bir
> etkileşim modeli — kareye tıkla sorularında her tıklama doğrudan cevap denemesidir).

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/board-exercise-board-theme.test.tsx`
Expected: PASS (3 test).

- [ ] **Step 5: Regresyon**

Run: `npx vitest run tests/board-exercise-click-square.test.tsx tests/board-exercise-two-card-feedback.test.tsx tests/board-exercise-fail-persistence.test.tsx tests/board-exercise-no-retry.test.tsx`
Expected: PASS — bu testler `[data-square="..."]` seçiciyle çalışıyor, tahtanın
çevresine eklenen etiket/renk değişikliği bu seçicileri etkilemez.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-board-theme.test.tsx
git commit -m "fix(madde1): kareye tikla/tasi tani sorulari ortak tahta temasi + notasyon"
```

---

### Task 2: Pratikte ses efektlerini kaldır

**Kök neden:** `BoardExercise.tsx`'te 3 yerde `playPieceSound(...)` çağrılıyor —
`succeed()` içinde, `click_square` tıklamasında, ve `move_piece` (eski format) taş
seçiminde. Kullanıcı pratikte hiç ses istemiyor.

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-no-sound.test.tsx` (yeni)

- [ ] **Step 1: Başarısız test yaz**

`apps/web/tests/board-exercise-no-sound.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

vi.mock('@/lib/sounds/pieceSounds', () => ({ playPieceSound: vi.fn() }));
import { playPieceSound } from '@/lib/sounds/pieceSounds';

const clickSq: BoardExerciseConfig = {
  type: 'click_square', instruction: 'x',
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', target_squares: ['e4'],
};
const movePiece: BoardExerciseConfig = {
  type: 'move_piece', instruction: 'x',
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', piece_square: 'e2', target_squares: ['e4'],
};

describe('BoardExercise — pratikte ses YOK (madde 3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('click_square doğru cevapta ses çalınmaz', () => {
    const { container } = render(<BoardExercise exercises={[clickSq]} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(playPieceSound).not.toHaveBeenCalled();
  });

  it('move_piece taş seçiminde ve doğru hamlede ses çalınmaz', () => {
    const { container } = render(<BoardExercise exercises={[movePiece]} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e2"]')!); // taş seç
    fireEvent.click(container.querySelector('[data-square="e4"]')!); // doğru hedef
    expect(playPieceSound).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/board-exercise-no-sound.test.tsx`
Expected: FAIL — `playPieceSound` çağrılıyor.

- [ ] **Step 3: 3 ses çağrısını kaldır**

`BoardExercise.tsx`'te:

(a) İçe aktarma satırını SİL:

```ts
import { playPieceSound } from '@/lib/sounds/pieceSounds';
```

(b) `succeed` fonksiyonunun imzasını ve gövdesini değiştir:

```ts
  const succeed = () => {
    setStatus('success');
```

(satırdaki `(piece?: string | null) => { if (piece) playPieceSound(piece);` kısmı
kaldırılır — geri kalan gövde AYNEN kalır.)

(c) `succeed(piece?.pieceType);` çağrısını (move_piece dalında, ~satır 388) şuna çevir:

```ts
        succeed();
```

(d) `click_square` dalındaki satırı SİL:

```ts
      if (piece) playPieceSound(piece.pieceType);
```

(e) `move_piece` (eski format) dalındaki satırı SİL:

```ts
          if (piece) playPieceSound(piece.pieceType);
```

> NOT: `piece` parametresi `onSquareClick`'in imzasında KALIR (kare/taş bilgisini
> hâlâ `succeed`/`fail` mantığı için değil ama ileride gerekebilecek şekilde
> API'de tutmak zarar vermez); yalnız SES ÇAĞRILARI kaldırılıyor.

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/board-exercise-no-sound.test.tsx`
Expected: PASS (2 test).

- [ ] **Step 5: Regresyon**

Run: `npx vitest run tests/board-exercise-click-square.test.tsx tests/board-exercise-two-card-feedback.test.tsx tests/board-exercise-fail-persistence.test.tsx tests/board-exercise-no-retry.test.tsx tests/board-exercise-onfinish.test.tsx tests/board-exercise-question-reset.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-no-sound.test.tsx
git commit -m "fix(madde3): pratikte ses efektleri kaldirildi"
```

---

### Task 3: Bayat pratik oturumu otomatik yenilensin (4 soru / 20 soru farkı)

**Kök neden:** `pratik/[mode]/page.tsx`, `sessionStorage`'da kayıtlı bir oturum
bulursa (`loadSession`) onu SORGUSUZ kullanıyor — havuzda o zamandan beri kaç soru
eklendiğine BAKMIYOR. Zafer Hoca bir alt konuya sonradan soru eklediğinde, daha önce
o cihazda başlatılmış (ör. 4 sorulu) bir oturum sonsuza kadar aynı 4 soruyu gösteriyor;
o cihazda hiç oturum açılmamış (ör. telefon) doğru şekilde günün 20 sorusunu üretiyor.
Bu bir CİHAZ farkı DEĞİL, bayat bir tarayıcı kaydı sorunu.

**Files:**
- Create: `apps/web/lib/play/staleSession.ts`
- Modify: `apps/web/app/(child)/pratik/[mode]/page.tsx`
- Test: `apps/web/tests/stale-session.test.ts` (yeni), `apps/web/tests/pratik-page-persistence.test.tsx` (genişletilecek)

- [ ] **Step 1: Saf mantık için başarısız test yaz**

`apps/web/tests/stale-session.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isSessionStale } from '@/lib/play/staleSession';

describe('isSessionStale — kayıtlı oturum güncel havuzla uyuşmuyor mu (madde 4)', () => {
  it('kayıtlı 4 soru, havuz 20+ soruya büyümüş (randomPick=20) → bayat', () => {
    expect(isSessionStale(4, 25, 20)).toBe(true);
  });

  it('kayıtlı 20 soru, havuz hâlâ 20+ destekliyor → GÜNCEL', () => {
    expect(isSessionStale(20, 25, 20)).toBe(false);
  });

  it('havuz küçük (10), kayıtlı da havuzun tamamı (10) → GÜNCEL', () => {
    expect(isSessionStale(10, 10, 20)).toBe(false);
  });

  it('havuz küçüldü (eskiden 10 soruydu, şimdi 6) → bayat', () => {
    expect(isSessionStale(10, 6, 20)).toBe(true);
  });

  it('randomPick=0 (tüm havuz sırayla) — kayıtlı sayı havuz sayısıyla eşleşmeli', () => {
    expect(isSessionStale(5, 8, 0)).toBe(true);
    expect(isSessionStale(8, 8, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/stale-session.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Modülü yaz**

`apps/web/lib/play/staleSession.ts`:

```ts
/** Kayıtlı bir pratik oturumunun GÜNCEL havuzla hâlâ uyuşup uyuşmadığını
 *  belirler (madde 4). Saf mantık — React yok, sessionStorage yok.
 *
 *  Neden gerekli: sporcu bir cihazda pratiğe başladığında havuzdaki soru
 *  sayısı kaydediliyor (ör. 4). Zafer Hoca sonradan havuza soru eklerse
 *  (ör. 20'ye çıkarsa), o cihazdaki eski kayıt SONSUZA KADAR aynı 4 soruyu
 *  gösterirdi — başka bir cihazda (kayıt yok) doğru 20 soru üretilirken.
 *  Bu "cihaz farkı" gibi görünen şey aslında bayat bir kayıttır.
 */
export function isSessionStale(
  savedItemCount: number,
  currentPoolSize: number,
  randomPick: number,
): boolean {
  const expected = randomPick > 0 ? Math.min(randomPick, currentPoolSize) : currentPoolSize;
  return savedItemCount !== expected;
}
```

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/stale-session.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: pratik sayfasına bağla**

`apps/web/app/(child)/pratik/[mode]/page.tsx` içinde:

(a) İçe aktarmaya ekle:

```ts
import { isSessionStale } from '@/lib/play/staleSession';
```

(b) Kayıtlı oturum kontrolünü (satır ~99-108, `if (saved) { ... return; }`) şununla değiştir:

```ts
        const key = sessionKey(stepId, slug);
        const saved = loadSession<BoardExerciseConfig>(key);
        // Madde 4: kayıt varsa ama havuzla artık UYUŞMUYORSA (Zafer Hoca
        // sonradan soru ekledi/çıkardı) bayat sayılır — yeniden üretilir.
        // Sporcu henüz ilerleme kaydetmediyse (index=0, doneCount=0) bu
        // güvenlidir; ilerlemesi varsa yine de tazelenir çünkü bayat
        // sorularla devam etmek sporcuyu güncel içerikten mahrum bırakır.
        if (saved && !isSessionStale(saved.items.length, rawPool.length, mode.randomPick)) {
          setExercises(saved.items);
          setStartIndex(saved.index);
          setStartAnswer(saved.currentAnswer);
          setStartDoneCount(saved.doneCount);
          setSolved(saved.doneCount);
          setLoading(false);
          return;
        }
```

- [ ] **Step 6: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/pratik-page-persistence.test.tsx`
Expected: PASS (mevcut test — regresyon kontrolü).

- [ ] **Step 7: Bayat oturum yenileme entegrasyon testi ekle**

`apps/web/tests/pratik-page-persistence.test.tsx` dosyasının sonuna ekle (mevcut
`vi.mock`/import desenini kullanarak — dosyanın başındaki mock'ları aynen koru):

```tsx
describe('pratik/[mode]/page — bayat oturum otomatik yenilenir (madde 4)', () => {
  it('kayıtlı oturum (2 soru) havuz büyüyünce (5 soru) yok sayılır, TÜM havuz gösterilir', async () => {
    // sessionKey(165,'suresiz') altına eski/kucuk bir oturum yazilir.
    sessionStorage.setItem('bsa:pratik:165:suresiz', JSON.stringify({
      items: [EX, EX], index: 0, currentAnswer: null, doneCount: 0,
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        steps: [{
          id: 165, type: 'explanation',
          content_json: { board_exercises: [EX, EX, EX, EX, EX] }, // havuz simdi 5 soru
        }],
      }),
    }));
    render(<PratikPage />);
    // randomPick=20 > havuz(5) => tum havuz (5 soru) gosterilir, eski 2 DEGIL.
    await screen.findByText('D');
    // getByText sifir eslesmede firlatir — queryByText kullan.
    expect(screen.queryByText(/5 soruluk havuzdan/)).not.toBeInTheDocument(); // havuz==secim, mesaj cikmaz
  });
});
```

> NOT: Bu testi dosyanın mevcut `EX` sabiti ve mock desenini kullanarak yaz;
> `content_json.board_exercises` alanının gerçek `mode.field` ('suresiz' →
> `board_exercises`) ile eşleştiğinden emin ol (dosyanın başındaki mevcut testte
> zaten aynı desen kullanılıyor).

- [ ] **Step 8: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/pratik-page-persistence.test.tsx`
Expected: PASS (3 test — 1 eski + 1 yeni + varsa diğerleri).

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/play/staleSession.ts apps/web/tests/stale-session.test.ts apps/web/app/\(child\)/pratik/\[mode\]/page.tsx apps/web/tests/pratik-page-persistence.test.tsx
git commit -m "fix(madde4): bayat pratik oturumu havuz buyuyunce otomatik yenilenir"
```

---

### Task 4: "Sonraki Soruya Geç" sağa, geri bildirim sola

**Kök neden:** İki kart bir CSS grid içinde yan yana duruyor; DOM sırası ekrandaki
sol/sağ yerleşimi belirliyor. Şu an önce "Sonraki Soruya Geç" (SOL), sonra geri
bildirim (SAĞ) geliyor — istenen tam tersi.

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-card-order.test.tsx` (yeni)

- [ ] **Step 1: Başarısız test yaz**

`apps/web/tests/board-exercise-card-order.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const two: BoardExerciseConfig[] = [
  { type: 'click_square', instruction: 'S1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
  { type: 'click_square', instruction: 'S2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
];

describe('BoardExercise — kart sırası: geribildirim solda, sonraki soru sağda (madde 5)', () => {
  it('DOM sırası: geribildirim kartı ÖNCE, "Sonraki Soruya Geç" SONRA gelir', () => {
    const { container } = render(
      <BoardExercise exercises={two} done={false} onCorrect={vi.fn()} />,
    );
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    // DİKKAT: '.closest("div")' burada YANLIŞ olurdu — buton bir <button>,
    // "div" DEĞİL; closest('div') butonu atlayıp GRID'in kendisini bulur,
    // sonra .parentElement grid'in ÜSTÜNE çıkardı (yanlış eleman). Grid'i
    // doğrudan class seçiciyle buluyoruz.
    const grid = screen.getByText('Sonraki Soruya Geç').closest('.grid')!;
    const children = Array.from(grid.children);
    const feedbackIdx = children.findIndex((c) => c.textContent?.includes('✓'));
    const nextIdx = children.findIndex((c) => c.textContent?.includes('Sonraki Soruya Geç'));
    expect(feedbackIdx).toBeLessThan(nextIdx);
  });
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı olduğunu gör**

Run: `npx vitest run tests/board-exercise-card-order.test.tsx`
Expected: FAIL — şu an "Sonraki Soruya Geç" ÖNCE geliyor.

- [ ] **Step 3: JSX sırasını değiştir**

`BoardExercise.tsx`'te iki kartın bulunduğu grid bloğunu (satır ~548-577) şu sıraya çevir
— GERİ BİLDİRİM KARTI ÖNCE, "Sonraki Soruya Geç" SONRA:

```tsx
          <div className={showNext && doneCount < total ? 'grid grid-cols-2 gap-2' : ''}>
            <div
              className="t-card-i flex flex-col items-center justify-center gap-1.5 py-4 px-2 text-center"
              style={{
                borderColor: status === 'success' ? '#16a34a' : '#dc2626',
                background: status === 'success'
                  ? 'color-mix(in srgb, #16a34a 12%, transparent)'
                  : 'color-mix(in srgb, #dc2626 12%, transparent)',
              }}
            >
              <span
                aria-hidden="true"
                style={{ fontSize: '1.75rem', lineHeight: 1, color: status === 'success' ? '#16a34a' : '#dc2626' }}
              >
                {status === 'success' ? '✓' : '✕'}
              </span>
              <span className="text-xs font-semibold" style={{ color: status === 'success' ? '#16a34a' : '#dc2626' }}>
                {status === 'success' ? (exercise.success_msg ?? 'Aferin! Doğru yaptın! 👏') : (feedback || 'Yanlış!')}
              </span>
            </div>
            {showNext && doneCount < total && (
              <button
                onClick={goNext}
                className="t-card-i flex flex-col items-center justify-center gap-1.5 py-4 px-2 text-center transition-all"
                style={{ background: 'var(--t-accent)', color: '#fff', border: 'none' }}
              >
                <span className="text-xl leading-none" aria-hidden="true">➡️</span>
                <span className="text-sm font-bold">Sonraki Soruya Geç</span>
              </button>
            )}
          </div>
```

> Yalnız İKİ bloğun SIRASI değişti — içerikleri (renkler, metinler) AYNEN kaldı.

- [ ] **Step 4: Testi çalıştır, yeşil olduğunu gör**

Run: `npx vitest run tests/board-exercise-card-order.test.tsx`
Expected: PASS.

- [ ] **Step 5: Regresyon**

Run: `npx vitest run tests/board-exercise-two-card-feedback.test.tsx`
Expected: PASS — o test yalnız METİNLERİN varlığını kontrol ediyor, sırayı değil;
bu değişiklikten etkilenmez.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-card-order.test.tsx
git commit -m "fix(madde5): geribildirim solda, sonraki soru sagda"
```

---

## KAPANIŞ

### Task 5: Tam test kapısı

- [ ] **Step 1: Tip + lint + vitest**

Run: `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: hepsi temiz/yeşil.

- [ ] **Step 2: Backend regresyonu**

Bu iş backend'e dokunmuyor; yine de zincirin sağlam olduğunu doğrula.

Run: `cd ../../apps/api && python -m pytest -q`
Expected: PASS.

- [ ] **Step 3: Commit (gerekirse)**

```bash
git add -A && git commit -m "test: pratik tahta/ses/bayat-oturum/kart-sirasi test kapisi"
```

### Task 6: Canlı doğrulama (KURAL #6) ve teslim

- [ ] **Step 1: Gerçek tarayıcıda sür**

Yerel sunucuda: Süresiz Pratik'te bir Kareye Tıkla sorusu aç — tahtanın kenarlarında
rakam/harf olduğunu ve rengin uygulamayla tutarlı olduğunu gör · doğru/yanlış
cevapla, ses ÇALINMADIĞINI doğrula · geri bildirim kartının SOLDA, "Sonraki Soruya
Geç"in SAĞDA olduğunu gör · (mümkünse) bir alt konuya soru ekleyip eski bir
sessionStorage kaydıyla test ederek otomatik yenilenmeyi doğrula.

- [ ] **Step 2: Sonucu dürüst raporla (KURAL #1)**

Neyin doğrulandığı/doğrulanamadığı açıkça yazılır.

- [ ] **Step 3: Push için kullanıcı onayı al**

Bu projede dal yok; iş `main`'e gider ve canlıya deploy olur (KURAL #3). Push
ÖNCESİ kullanıcının açık onayını al.

```bash
git push origin main
```

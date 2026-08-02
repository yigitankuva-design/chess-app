# A Grubu — Pratiği Bırakma, Sade Geribildirim, Kare Halkaları — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sporcu pratiği yarıda bırakabilsin (kaydedilmeden), geribildirim kartında sadece ✓/✗ görsün, tıkladığı kareler boyanmak yerine halkayla işaretlensin.

**Architecture:** Halka çizimi saf bir yardımcıya (`ringStyle`) çıkarılır; `BoardExercise` sadece onu kullanır. "Bırak" butonu `BoardExercise` içinde ÜRETİLMEZ — bileşen pratik modunu bilmiyor; sayfa hazır bir düğmeyi `quitSlot` olarak geçirir. Bırakma akışı mevcut `handleFinish`'e hiç dokunmaz, ayrı bir `handleQuit` yazılır.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v3, Vitest + Testing Library.

---

## Dosya Yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/lib/chess/squareMarker.ts` (YENİ) | Halka stili üreten saf yardımcı + renk sabitleri |
| `apps/web/components/lesson-steps/BoardExercise.tsx` (DEĞİŞİR) | Halka kullanımı, çoklu tıklama gösterimi, sade geribildirim, `quitSlot` |
| `apps/web/app/(child)/pratik/[mode]/page.tsx` (DEĞİŞİR) | `quitLabel` sabiti, `handleQuit`, butonu `quitSlot` olarak geçirme |
| `apps/web/tests/board-exercise-click-square.test.tsx` (DEĞİŞİR) | "Aferin" metni yerine ✓ etiketine bakar |
| `apps/web/tests/board-exercise-move-piece-placeholder.test.tsx` (DEĞİŞİR) | Aynı güncelleme |

---

### Task 1: Halka stili yardımcısı

**Files:**
- Create: `apps/web/lib/chess/squareMarker.ts`
- Test: `apps/web/tests/square-marker.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/square-marker.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ringStyle, RING_BLUE, RING_GREEN, RING_RED } from '@/lib/chess/squareMarker';

describe('ringStyle', () => {
  it('kareyi BOYAMAZ — backgroundColor üretmez', () => {
    const s = ringStyle(RING_BLUE);
    expect(s.backgroundColor).toBeUndefined();
  });

  it('verilen rengi içeren bir halka (radial-gradient) üretir', () => {
    const s = ringStyle(RING_GREEN);
    expect(s.backgroundImage).toContain('radial-gradient');
    expect(s.backgroundImage).toContain(RING_GREEN);
  });

  it('halkanın ortası saydamdır — taş görünmeye devam eder', () => {
    expect(ringStyle(RING_RED).backgroundImage).toContain('transparent');
  });

  it('üç renk birbirinden farklıdır', () => {
    expect(new Set([RING_BLUE, RING_GREEN, RING_RED]).size).toBe(3);
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/square-marker.test.ts
```

Beklenen: FAIL — `@/lib/chess/squareMarker` modülü yok.

- [ ] **Step 3: `squareMarker.ts` oluştur**

```ts
import type { CSSProperties } from 'react';

/** Tıklanan/işaretlenen kareler için halka renkleri. */
export const RING_BLUE = 'rgba(37,99,235,0.85)';   // tıklandı, cevap sürüyor
export const RING_GREEN = 'rgba(22,163,74,0.9)';   // doğru
export const RING_RED = 'rgba(220,38,38,0.9)';     // yanlış

/**
 * Karenin ortasına içi boş bir halka çizer.
 *
 * Arka plan RENGİ kullanılmaz (kullanıcı kararı: "kare renklenmesin, çember
 * belirsin"). Halkanın içi saydam olduğu için karedeki taş görünmeye devam eder.
 */
export function ringStyle(color: string): CSSProperties {
  return {
    backgroundImage:
      `radial-gradient(circle, transparent 38%, ${color} 40%, ${color} 48%, transparent 50%)`,
  };
}
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/square-marker.test.ts
```

Beklenen: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/chess/squareMarker.ts apps/web/tests/square-marker.test.ts
git commit -m "feat: kare halkasi stili yardimcisi"
```

---

### Task 2: Kare göstergelerini halkaya çevir + çoklu tıklamayı göster

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx` (import bloğu ve `styles` hesabı ~satır 340-370)
- Test: `apps/web/tests/board-exercise-rings.test.tsx` (YENİ)

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/board-exercise-rings.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

/** "Tüm kareleri tıkla" tipinde 3 hedefli soru. */
const multiEx: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'Üç kareye de tıkla',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  target_squares: ['a1', 'b2', 'c3'],
  click_mode: 'all',
};

function renderEx(ex: BoardExerciseConfig) {
  return render(<BoardExercise exercises={[ex]} done={false} onCorrect={vi.fn()} />);
}

describe('BoardExercise — kare halkaları', () => {
  it('çoklu tıklamada tıklanan kare HALKA ile işaretlenir, boyanmaz', () => {
    const { container } = renderEx(multiEx);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    const a1 = container.querySelector('[data-square="a1"]') as HTMLElement;
    expect(a1.style.backgroundImage).toContain('radial-gradient');
    expect(a1.style.backgroundColor).toBe('');
  });

  it('ikinci doğru tıklama da işaretlenir, soru henüz bitmez', () => {
    const { container } = renderEx(multiEx);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="b2"]')!);
    const b2 = container.querySelector('[data-square="b2"]') as HTMLElement;
    expect(b2.style.backgroundImage).toContain('radial-gradient');
    expect(container.textContent).not.toMatch(/✓/);
  });

  it('üçüncü doğru tıklamada soru DOĞRU biter', () => {
    const { container, getByLabelText } = renderEx(multiEx);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="b2"]')!);
    fireEvent.click(container.querySelector('[data-square="c3"]')!);
    expect(getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('yanlış kareye tıklanınca soru YANLIŞ olur (tek hak)', () => {
    const { container, getByLabelText } = renderEx(multiEx);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="h8"]')!);
    expect(getByLabelText('Yanlış')).toBeInTheDocument();
  });
});
```

**NOT:** `getByLabelText('Doğru')` Task 3'te eklenecek `aria-label`'a dayanıyor. Bu test
dosyası Task 3 bittikten sonra tam yeşile döner; Task 2 sonunda ilk iki test geçer.

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/board-exercise-rings.test.tsx
```

Beklenen: FAIL — halka yok, kareler boyanıyor.

- [ ] **Step 3: Import ekle**

`BoardExercise.tsx` import bloğuna:

```tsx
import { ringStyle, RING_BLUE, RING_GREEN, RING_RED } from '@/lib/chess/squareMarker';
```

- [ ] **Step 4: `styles` hesabını halkaya çevir**

`BoardExercise.tsx` içindeki şu üç yeri değiştir.

**(a)** Seçili taş — mevcut satır:

```tsx
        styles[selected] = { backgroundColor: 'rgba(80,160,255,0.65)', cursor: 'pointer' };
```

yerine:

```tsx
        styles[selected] = { ...ringStyle(RING_BLUE), cursor: 'pointer' };
```

**(b)** `move_piece` doğru cevap kareleri — mevcut satırlar:

```tsx
      exercise.target_squares.forEach((sq) => {
        styles[sq] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      });
```

yerine:

```tsx
      exercise.target_squares.forEach((sq) => {
        styles[sq] = ringStyle(RING_GREEN);
      });
```

**(c)** Tıklanan kare sonucu — mevcut blok:

```tsx
    if (exercise.type === 'click_square' && clickedSquare) {
      if (status === 'success') {
        styles[clickedSquare] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      } else if (status === 'fail') {
        styles[clickedSquare] = { backgroundColor: 'rgba(239,68,68,0.45)' };
      }
    }
```

yerine:

```tsx
    // "Tüm kareleri tıkla" modunda sporcunun ŞU ANA KADAR tıkladığı doğru
    // kareler mavi halkayla gösterilir — eskiden hiç gösterilmiyordu, sporcu
    // nerede kaldığını göremiyordu.
    if (exercise.type === 'click_square' && (exercise.click_mode ?? 'any') === 'all') {
      multiClicked.forEach((sq) => { styles[sq] = ringStyle(RING_BLUE); });
    }
    if (exercise.type === 'click_square' && clickedSquare) {
      if (status === 'success') {
        styles[clickedSquare] = ringStyle(RING_GREEN);
      } else if (status === 'fail') {
        styles[clickedSquare] = ringStyle(RING_RED);
      }
    }
```

**NOT — sıra önemli:** `multiClicked` halkaları ÖNCE yazılır, sonuç halkası SONRA;
böylece son tıklanan kare sonuç rengini (yeşil/kırmızı) alır, öncekiler mavi kalır.

**DEĞİŞMEYEN:** İpucu kareleri (`hint_squares`, sarı) ve `identify_piece` vurgu karesi
arka plan olarak KALIR — bunlar tıklama geri bildirimi değil, sorunun "buraya bak"
işaretleri (spec kararı).

- [ ] **Step 5: Testi çalıştır — ilk iki test geçmeli**

```bash
cd apps/web && npx vitest run tests/board-exercise-rings.test.tsx
```

Beklenen: ilk 2 test PASS; son 2 test hâlâ FAIL (`aria-label` Task 3'te gelecek).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-rings.test.tsx
git commit -m "feat: tiklanan kareler halka ile isaretleniyor"
```

---

### Task 3: Geribildirim kartında sadece işaret

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx` (geribildirim kartı)
- Modify: `apps/web/tests/board-exercise-click-square.test.tsx` (satır 21, 36, 49, 177)
- Modify: `apps/web/tests/board-exercise-move-piece-placeholder.test.tsx` (satır 60)

- [ ] **Step 1: Geribildirim kartını sadeleştir**

`BoardExercise.tsx` içindeki şu blok:

```tsx
              <span
                aria-hidden="true"
                style={{ fontSize: '1.75rem', lineHeight: 1, color: status === 'success' ? '#16a34a' : '#dc2626' }}
              >
                {status === 'success' ? '✓' : '✕'}
              </span>
              <span className="text-xs font-semibold" style={{ color: status === 'success' ? '#16a34a' : '#dc2626' }}>
                {status === 'success' ? (exercise.success_msg ?? 'Aferin! Doğru yaptın! 👏') : (feedback || 'Yanlış!')}
              </span>
```

şununla değiştirilir:

```tsx
              {/* Kullanıcı kararı: kartta YAZI yok, sadece işaret. aria-label
                  ŞART — işaret görsel; etiketsiz kalırsa ekran okuyucu ve
                  testler sonucu hiç göremez. */}
              <span
                role="img"
                aria-label={status === 'success' ? 'Doğru' : 'Yanlış'}
                style={{ fontSize: '2.75rem', lineHeight: 1, color: status === 'success' ? '#16a34a' : '#dc2626' }}
              >
                {status === 'success' ? '✓' : '✕'}
              </span>
```

- [ ] **Step 2: Etkilenen testleri güncelle**

`tests/board-exercise-click-square.test.tsx` — 4 yerde `/Aferin/` iddiası var.
Şu iki kalıbı ara ve değiştir:

`expect(container.textContent).toMatch(/Aferin/);` →
`expect(screen.getByLabelText('Doğru')).toBeInTheDocument();`

`expect(screen.getByText(/Aferin/)).toBeInTheDocument();` →
`expect(screen.getByLabelText('Doğru')).toBeInTheDocument();`

`tests/board-exercise-move-piece-placeholder.test.tsx` satır 60'ta aynı değişiklik:

`expect(container.textContent).toMatch(/Aferin/);` →
`expect(screen.getByLabelText('Doğru')).toBeInTheDocument();`

**NOT — doğrulandı:** Her iki test dosyasında da `screen` ZATEN import edilmiş
(`board-exercise-click-square.test.tsx:3` ve `board-exercise-move-piece-placeholder.test.tsx:8`),
import satırına dokunmaya gerek yok.

- [ ] **Step 3: Testleri çalıştır**

```bash
cd apps/web && npx vitest run tests/board-exercise-rings.test.tsx tests/board-exercise-click-square.test.tsx tests/board-exercise-move-piece-placeholder.test.tsx tests/board-exercise-two-card-feedback.test.tsx
```

Beklenen: hepsi PASS.

**NOT — doğrulandı:** `board-exercise-two-card-feedback.test.tsx` işaretin METNİNE
bakıyor (`screen.getByText('✓')`, satır 32/42/52). İşaretin metni değişmediği,
sadece `aria-hidden` yerine `role`+`aria-label` geldiği için bu dosya KIRILMAZ —
değiştirilmesine gerek yok.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/
git commit -m "feat: geribildirim kartinda sadece isaret"
```

---

### Task 4: Pratiği bırakma

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx` (`Props` + `pg-content`)
- Modify: `apps/web/app/(child)/pratik/[mode]/page.tsx`
- Test: `apps/web/tests/practice-quit.test.tsx` (YENİ)

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/practice-quit.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const ex: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'Şaha tıkla',
  fen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  target_squares: ['e4'],
};

describe('BoardExercise — quitSlot', () => {
  it('quitSlot verilmezse hiçbir çıkış düğmesi görünmez', () => {
    render(<BoardExercise exercises={[ex]} done={false} onCorrect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Bırak/ })).not.toBeInTheDocument();
  });

  it('quitSlot verilirse içerik alanında görünür', () => {
    const { container } = render(
      <BoardExercise
        exercises={[ex]} done={false} onCorrect={vi.fn()}
        quitSlot={<button type="button">Süresiz Pratik Yapmayı Bırak</button>}
      />,
    );
    const content = container.querySelector('.pg-content');
    expect(content?.textContent).toContain('Süresiz Pratik Yapmayı Bırak');
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/practice-quit.test.tsx
```

Beklenen: ikinci test FAIL — `quitSlot` prop'u yok.

- [ ] **Step 3: `BoardExercise`'e `quitSlot` ekle**

`Props` arayüzüne (son alanın ardına):

```tsx
  /** Talimatın altına konan çıkış düğmesi. Pratik sayfası geçirir; ders
   *  anlatımı içindeki alıştırmalarda verilmez, düğme hiç render edilmez.
   *  Bileşen hangi pratik modunda olduğunu BİLMEZ — yazıyı sayfa belirler. */
  quitSlot?: ReactNode;
```

İmzaya ekle (`onAnswered,` satırının ardına): `quitSlot,`

`ReactNode` tipi import edilmemişse dosyanın ilk import satırını şöyle yap:

```tsx
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
```

`pg-content` bloğunun EN SONUNA (kapanış `</div>`'inden hemen önce) ekle:

```tsx
          {quitSlot}
```

**NOT — neden içeriğin sonunda:** Kullanıcı "talimatın hemen altı" dedi. En yaygın
tip olan `click_square`'de talimat içerik alanındaki tek öğedir, dolayısıyla sonu =
talimatın hemen altı. Şıklı tiplerde ise düğmeyi şıkların ARASINA sokmak sporcunun
yanlışlıkla basmasına yol açardı; bu yüzden her tipte içeriğin sonunda durur.

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/practice-quit.test.tsx
```

Beklenen: PASS (2 test).

- [ ] **Step 5: `MODES` sabitine `quitLabel` ekle**

`apps/web/app/(child)/pratik/[mode]/page.tsx` — `MODES` tip tanımına yeni alan:

```tsx
  /** "Bırak" düğmesinin yazısı — başlıktan türetilmez, açıkça yazılır. */
  quitLabel: string;
```

Üç satırı da güncelle:

```tsx
  suresiz: { emoji: '♾️', title: 'Süresiz Pratik Yap', field: 'board_exercises',       timed: false, scored: false, randomPick: 20, mix: UNTIMED_MIX, quitLabel: 'Süresiz Pratik Yapmayı Bırak' },
  sureli:  { emoji: '⏱️', title: 'Süreli Pratik Yap',  field: 'board_exercises_timed', timed: true,  scored: false, randomPick: 20, mix: TIMED_MIX,   quitLabel: 'Süreli Pratik Yapmayı Bırak' },
  test:    { emoji: '📝', title: 'Kendini Test Et',    field: 'board_exercises_test',  timed: false, scored: true,  randomPick: 20, mix: TEST_MIX,    quitLabel: 'Testi Bırak' },
```

- [ ] **Step 6: `handleQuit` ekle ve düğmeyi geçir**

`useRouter` import edilmemişse satır 3'ü şöyle yap:

```tsx
import { useParams, useSearchParams, useRouter } from 'next/navigation';
```

`PratikInner` içinde, diğer `const` tanımlarının yanına:

```tsx
  const router = useRouter();
```

`handleRetry` fonksiyonunun yanına ekle:

```tsx
  /** Pratiği YARIDA bırak: hiçbir şey kaydedilmez, sunucuya yazılmaz.
   *  handleFinish'ten AYRI tutulur — o puan yazar, kilit açar, sonuç gösterir. */
  function handleQuit() {
    if (!confirm('Bırakmak istediğine emin misin? Bu pratik kaydedilmeyecek.')) return;
    clearSession(sessionKey(stepId, slug));
    router.push('/home');
  }
```

`<BoardExercise ... />` çağrısına ekle:

```tsx
          quitSlot={(
            <button
              type="button"
              onClick={handleQuit}
              className="t-card-i w-full py-3 px-4 text-center text-sm font-semibold"
            >
              {mode.quitLabel}
            </button>
          )}
```

- [ ] **Step 7: Tip ve lint kontrolü**

```bash
cd apps/web && npx tsc --noEmit && npx next lint
```

Beklenen: `tsc` sessiz; `lint` yalnızca ÖNCEDEN var olan uyarılar.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx "apps/web/app/(child)/pratik/[mode]/page.tsx" apps/web/tests/practice-quit.test.tsx
git commit -m "feat: pratigi birakma dugmesi, kayit yapilmadan cikis"
```

---

### Task 5: Tam test kapısı, canlı doğrulama, yayına alma

- [ ] **Step 1: Ön yüz tam kapısı**

```bash
cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run
```

Beklenen: `tsc` sessiz, `lint` sadece eski uyarılar, `vitest` hepsi PASS.

- [ ] **Step 2: Arka uç kapısı**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: hepsi PASS (bu grup sunucuya dokunmuyor, değişiklik beklenmiyor).

- [ ] **Step 3: Geliştirme sunucusunu başlat**

`preview_start` aracını `{ name: "chess-web" }` ile çağır.

- [ ] **Step 4: Gerçek tarayıcıda sür**

Backend çalışmıyorsa gerçek veri gelmez. Geçici bir doğrulama sayfası oluştur
(alt çizgiyle BAŞLAMAYAN klasör adı — Next.js `_` ile başlayanları yok sayar),
`BoardExercise`'i `click_mode: 'all'` ve 3 hedefli sahte soruyla + `quitSlot` ile
render et, doğrulama bitince sayfayı SİL.

Not: react-chessboard düz `element.click()` ile tetiklenmez; gerçek tıklama için
`pointerdown` + `mousedown` + `pointerup` + `mouseup` + `click` olaylarını sırayla
gönder (bu oturumda ölçüldü).

Doğrulanacaklar:
1. İlk doğru kareye tıklayınca MAVİ halka çıkıyor, kare boyanmıyor
2. İkinci doğru kare de mavi halka alıyor, soru bitmiyor
3. Üçüncü doğru karede soru bitiyor ve kartta sadece ✓ var, yazı YOK
4. Yeni soruda yanlış kareye tıklayınca kartta sadece ✗ var
5. "Bırak" düğmesi talimatın altında görünüyor

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

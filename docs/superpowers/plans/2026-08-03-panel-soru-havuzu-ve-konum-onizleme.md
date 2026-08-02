# B Grubu — Soru Havuzu Kartı ve Konum Önizleme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panelde kaydedilmiş sorular kapalı başlayan bir "Soru Havuzu" kartında toplansın; "Doğru Kare(leri) Seç" adımında kaydedilmiş konum kare listesinin sağında görünsün.

**Architecture:** İki bağımsız görünüm işi. Açılır kart admin temasına özel yeni bir bileşen (`CollapsibleCard`) olur — sporcu tarafındaki `StepCard` farklı bir görsel dil ve adım/kilit mantığı taşıdığı için yeniden kullanılmaz. Konum önizlemesi salt-okunur bir tahta bileşeni (`SavedPositionBoard`) olarak ayrılır ve seçili kareleri A grubunda eklenen `ringStyle()` ile işaretler.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v3, react-chessboard, Vitest + Testing Library.

---

## Dosya Yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/components/admin/CollapsibleCard.tsx` (YENİ) | Admin temalı açılır/kapanır kart |
| `apps/web/components/admin/SavedPositionBoard.tsx` (YENİ) | Salt-okunur konum tahtası + işaretli kareler |
| `apps/web/app/admin/content/lesson/[lessonId]/page.tsx` (DEĞİŞİR) | Soru dairelerini havuz kartına alır |
| `apps/web/components/admin/ExerciseForm.tsx` (DEĞİŞİR) | Kare listesinin yanına önizleme tahtası koyar |

---

### Task 1: `CollapsibleCard` bileşeni

**Files:**
- Create: `apps/web/components/admin/CollapsibleCard.tsx`
- Test: `apps/web/tests/collapsible-card.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/collapsible-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleCard } from '@/components/admin/CollapsibleCard';

describe('CollapsibleCard', () => {
  it('KAPALI başlar — içerik DOM\'da yoktur', () => {
    render(
      <CollapsibleCard title="Süresiz Pratik Yap Soru Havuzu"><p>GİZLİ İÇERİK</p></CollapsibleCard>,
    );
    expect(screen.getByText('Süresiz Pratik Yap Soru Havuzu')).toBeInTheDocument();
    expect(screen.queryByText('GİZLİ İÇERİK')).not.toBeInTheDocument();
  });

  it('başlığa tıklayınca açılır, tekrar tıklayınca kapanır', () => {
    render(
      <CollapsibleCard title="Havuz"><p>GİZLİ İÇERİK</p></CollapsibleCard>,
    );
    const btn = screen.getByRole('button', { name: /Havuz/ });
    fireEvent.click(btn);
    expect(screen.getByText('GİZLİ İÇERİK')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('GİZLİ İÇERİK')).not.toBeInTheDocument();
  });

  it('rozet yazısı başlıkta görünür', () => {
    render(
      <CollapsibleCard title="Havuz" badge="27 soru"><p>x</p></CollapsibleCard>,
    );
    expect(screen.getByText('27 soru')).toBeInTheDocument();
  });

  it('forceOpen=true ise AÇIK başlar ve tıklamayla kapanmaz', () => {
    render(
      <CollapsibleCard title="Havuz" forceOpen><p>GİZLİ İÇERİK</p></CollapsibleCard>,
    );
    expect(screen.getByText('GİZLİ İÇERİK')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Havuz/ }));
    // Bir soru düzenlenirken havuz kapanmamalı — hangi soruda olunduğu görünsün.
    expect(screen.getByText('GİZLİ İÇERİK')).toBeInTheDocument();
  });

  it('aria-expanded durumu doğru bildirir', () => {
    render(<CollapsibleCard title="Havuz"><p>x</p></CollapsibleCard>);
    const btn = screen.getByRole('button', { name: /Havuz/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/collapsible-card.test.tsx
```

Beklenen: FAIL — `@/components/admin/CollapsibleCard` modülü yok.

- [ ] **Step 3: `CollapsibleCard.tsx` oluştur**

```tsx
'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** Başlığın sağındaki küçük yazı — örn. "27 soru". */
  badge?: string;
  /**
   * Dışarıdan AÇIK tutmaya zorlar. Bir soru düzenlenirken kullanılır: havuz
   * kapanırsa Zafer Hoca hangi soruda olduğunu göremez.
   */
  forceOpen?: boolean;
  /** Bölüm rengi (EX_MODES.color) — başlık ve kenarlık bu renkle uyumlanır. */
  accentColor?: string;
  children: ReactNode;
}

/**
 * Admin panelinde kalabalık listeleri gizleyen açılır kart.
 *
 * components/play/StepCard.tsx YENİDEN KULLANILMADI: o bileşen sporcu temasının
 * sınıflarını (t-card-i) ve adım numarası/kilit mantığını taşıyor; admin paneli
 * ayrı bir görsel dil (neon) kullanıyor. Sporcu bileşenine admin desteği eklemek
 * iki ekranı birbirine bağlardı.
 */
export function CollapsibleCard({ title, badge, forceOpen = false, accentColor, children }: Props) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: accentColor
          ? `color-mix(in srgb, ${accentColor} 35%, transparent)`
          : 'rgba(255,255,255,0.15)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-sm font-bold" style={{ color: accentColor }}>{title}</span>
        <span className="flex items-center gap-2 text-xs n-muted flex-shrink-0">
          {badge && <span>{badge}</span>}
          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/collapsible-card.test.tsx
```

Beklenen: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/CollapsibleCard.tsx apps/web/tests/collapsible-card.test.tsx
git commit -m "feat: admin acilir kart bileseni"
```

---

### Task 2: Soru dairelerini havuz kartına al

**Files:**
- Modify: `apps/web/app/admin/content/lesson/[lessonId]/page.tsx` (satır 333-360 arası soru listesi bloğu + import)
- Test: `apps/web/tests/admin-lesson-question-pool.test.tsx` (YENİ)

- [ ] **Step 1: Başarısız testi yaz**

Bu sayfayı render etmek ağır mock gerektiriyor; mevcut `admin-lesson-modes-share-form.test.tsx`
deseni izlenir — kaynak dosya okunup YAPI kilitlenir.

`apps/web/tests/admin-lesson-question-pool.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Soru daireleri açılır bir havuz kartının içinde olmalı (kalabalık şikayeti).
 * Sayfanın kendisini render etmek ağır mock gerektirdiği için — mevcut
 * admin-lesson-modes-share-form.test.tsx ile aynı gerekçe — burada YAPI
 * kilitlenir: biri kartı kaldırırsa test yakalar.
 */
const SRC = readFileSync(
  join(process.cwd(), 'app/admin/content/lesson/[lessonId]/page.tsx'),
  'utf8',
);

describe('Admin ders sayfası — soru havuzu kartı', () => {
  it('CollapsibleCard içe aktarılır', () => {
    expect(SRC).toContain("from '@/components/admin/CollapsibleCard'");
  });

  it('havuz başlığı bölüm adından üretilir', () => {
    expect(SRC).toContain('Soru Havuzu');
    expect(SRC).toContain('mode.label');
  });

  it('soru sayısı rozet olarak verilir', () => {
    expect(SRC).toMatch(/badge=\{`\$\{list\.length\} soru`\}/);
  });

  it('bir soru düzenlenirken kart AÇIK tutulur', () => {
    expect(SRC).toContain('forceOpen=');
  });

  it('bölüm rengi karta geçirilir', () => {
    expect(SRC).toContain('accentColor={mode.color}');
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/admin-lesson-question-pool.test.tsx
```

Beklenen: FAIL — sayfada `CollapsibleCard` yok.

- [ ] **Step 3: Import ekle**

`app/admin/content/lesson/[lessonId]/page.tsx` import bloğuna (`ExerciseForm` importunun ardına):

```tsx
import { CollapsibleCard } from '@/components/admin/CollapsibleCard';
```

- [ ] **Step 4: Soru listesi bloğunu karta al**

Dosyadaki şu blok:

```tsx
                          {list.length === 0 ? (
                            <p className="text-sm n-muted pl-2">Bu modda henüz soru yok.</p>
                          ) : (
                            <div className="pl-2">
                              {/* Soru kodları — dairesel kartlar, satırda 10 adet. Bir koda tıklayınca o soru düzenlenir. */}
                              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
```

şu hale getirilir (açılış kısmı; `list.map(...)` içeriği ve kapanışlar AYNEN kalır,
sadece yeni bir sarmalayıcı eklenir):

```tsx
                          {list.length === 0 ? (
                            <p className="text-sm n-muted pl-2">Bu modda henüz soru yok.</p>
                          ) : (
                            <div className="pl-2">
                              <CollapsibleCard
                                title={`${mode.label} Soru Havuzu`}
                                badge={`${list.length} soru`}
                                accentColor={mode.color}
                                forceOpen={editingExercise?.stepId === s.id && editingExercise.field === mode.field}
                              >
                              {/* Soru kodları — dairesel kartlar. Bir koda tıklayınca o soru düzenlenir. */}
                              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
```

Ve bu bloğun kapanışında, `</div>` (grid) ile `</div>` (pl-2) ARASINA kapanış eklenir:

```tsx
                              </div>
                              </CollapsibleCard>
                            </div>
                          )}
```

**NOT:** `list.map(...)` içindeki daire düğmelerinin kodu DEĞİŞMEZ — sadece etraflarına
kart sarılır. Soru verisine dokunulmaz (KURAL #4).

- [ ] **Step 5: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/admin-lesson-question-pool.test.tsx tests/admin-lesson-modes-share-form.test.tsx tests/admin-lesson-ui-persist.test.tsx
```

Beklenen: hepsi PASS.

- [ ] **Step 6: Tip kontrolü**

```bash
cd apps/web && npx tsc --noEmit
```

Beklenen: çıktı yok. Hata varsa JSX kapanış etiketleri eşleşmiyordur — Step 4'teki
açılış/kapanış çiftini yeniden kontrol et.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/admin/content/lesson/[lessonId]/page.tsx" apps/web/tests/admin-lesson-question-pool.test.tsx
git commit -m "feat: sorular acilir Soru Havuzu kartinda"
```

---

### Task 3: Cevap seçerken konum önizlemesi

**Files:**
- Create: `apps/web/components/admin/SavedPositionBoard.tsx`
- Modify: `apps/web/components/admin/ExerciseForm.tsx` (import + `SquarePicker` kullanım satırı)
- Test: `apps/web/tests/saved-position-board.test.tsx` (YENİ)

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/saved-position-board.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

/** Konum kaydedilmiş bir "Kareye Tıkla" sorusu — savedFen initial.fen'den dolar
 *  (ExerciseForm.tsx:179-181). */
const initial = {
  type: 'click_square' as const,
  instruction: 'Beyaz şaha tıkla',
  fen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  target_squares: ['e4'],
};

describe('Doğru kare seçerken konum önizlemesi', () => {
  it('kaydedilmiş konumu gösteren bir tahta vardır', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} initial={initial} />);
    expect(container.querySelector('[data-testid="saved-position-board"]')).toBeInTheDocument();
  });

  it('seçili cevap karesi tahtada işaretlenir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} initial={initial} />);
    const board = container.querySelector('[data-testid="saved-position-board"]') as HTMLElement;
    const overlay = board.querySelector('[data-square="e4"] > div') as HTMLElement;
    expect(overlay.style.borderRadius).toBe('50%');
  });

  it('önizleme tahtasına tıklamak seçimi DEĞİŞTİRMEZ', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} initial={initial} />);
    const board = container.querySelector('[data-testid="saved-position-board"]') as HTMLElement;
    fireEvent.click(board.querySelector('[data-square="a1"]')!);
    // Kare listesindeki "Seçili:" satırı değişmemeli — seçim yalnızca listeden yapılır.
    expect(screen.getByText(/Seçili: e4/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, KIRMIZI olduğunu gör**

```bash
cd apps/web && npx vitest run tests/saved-position-board.test.tsx
```

Beklenen: FAIL — `saved-position-board` test kimliği yok.

- [ ] **Step 3: `SavedPositionBoard.tsx` oluştur**

```tsx
'use client';
import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import type { CSSProperties } from 'react';
import { BOARD_CARD_BG, BOARD_STYLE, getBoardColors, getPieceSet } from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { ringStyle, RING_GREEN } from '@/lib/chess/squareMarker';

interface Props {
  /** "Konumu Kaydet" ile kilitlenen konum. */
  fen: string;
  /** Seçili cevap kareleri — halka ile işaretlenir. */
  marked: string[];
}

/**
 * Cevap kurulurken kaydedilmiş konumu gösteren SALT-OKUNUR tahta.
 *
 * Tıklanabilir DEĞİL: kare seçimi soldaki kare listesinden yapılır. İki ayrı
 * tıklama yolu olsaydı hangi tıklamanın ne yaptığı belirsizleşirdi.
 */
export function SavedPositionBoard({ fen, marked }: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  const squareStyles: Record<string, CSSProperties> = {};
  marked.forEach((sq) => { squareStyles[sq] = ringStyle(RING_GREEN); });

  return (
    <div
      data-testid="saved-position-board"
      className="rounded-xl p-2 flex-shrink-0"
      style={{ backgroundColor: BOARD_CARD_BG, width: 240 }}
    >
      <div className="aspect-square" style={BOARD_STYLE}>
        <Chessboard
          options={{
            position: fen,
            allowDragging: false,
            pieces: pieceSet,
            lightSquareStyle: { backgroundColor: boardColors.light },
            darkSquareStyle: { backgroundColor: boardColors.dark },
            showNotation: false,
            squareStyles,
          }}
        />
      </div>
      <p className="text-xs n-muted text-center mt-1">Kaydedilen konum</p>
    </div>
  );
}
```

- [ ] **Step 4: `ExerciseForm`'a bağla**

`components/admin/ExerciseForm.tsx` import bloğuna ekle:

```tsx
import { SavedPositionBoard } from './SavedPositionBoard';
```

Ve şu satırı:

```tsx
          <SquarePicker values={targets} onToggle={toggleTarget} />
```

şununla değiştir:

```tsx
          {/* Kare listesi SOLDA, kaydedilen konum SAĞDA — Zafer Hoca konuma
              bakarak cevabı kurabilsin. Dar ekranda alt alta iner. */}
          <div className="flex flex-wrap items-start gap-3">
            <SquarePicker values={targets} onToggle={toggleTarget} />
            {savedFen && <SavedPositionBoard fen={savedFen} marked={targets} />}
          </div>
```

- [ ] **Step 5: Testi çalıştır, YEŞİL olduğunu gör**

```bash
cd apps/web && npx vitest run tests/saved-position-board.test.tsx
```

Beklenen: PASS (3 test).

- [ ] **Step 6: Panel regresyonu**

```bash
cd apps/web && npx vitest run tests/exercise-form-square-picker-size.test.tsx tests/exercise-form-click-square-steps.test.tsx tests/click-mode-select.test.tsx tests/exercise-form-family.test.tsx tests/exercise-form-place-pieces.test.tsx
```

Beklenen: hepsi PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/admin/SavedPositionBoard.tsx apps/web/components/admin/ExerciseForm.tsx apps/web/tests/saved-position-board.test.tsx
git commit -m "feat: cevap secerken kaydedilen konum yanda gorunuyor"
```

---

### Task 4: Tam test kapısı, canlı doğrulama, yayına alma

- [ ] **Step 1: Ön yüz tam kapısı**

```bash
cd apps/web && npx tsc --noEmit && npx next lint && npx vitest run
```

Beklenen: `tsc` sessiz, `lint` sadece önceden var olan uyarılar, `vitest` hepsi PASS.

- [ ] **Step 2: Arka uç kapısı**

```bash
cd apps/api && python -m pytest -q
```

Beklenen: hepsi PASS (bu grup sunucuya dokunmuyor).

- [ ] **Step 3: Geliştirme sunucusunu başlat**

`preview_start` aracını `{ name: "chess-web" }` ile çağır.

- [ ] **Step 4: Gerçek tarayıcıda sür**

Admin paneli giriş korumalı olabilir; backend çalışmıyorsa gerçek ders verisi gelmez.
Bu durumda geçici bir doğrulama sayfası oluştur (alt çizgiyle BAŞLAMAYAN klasör adı),
`ExerciseForm`'u `initial={{type:'click_square', fen:'...', target_squares:['e4']}}` ile
ve `CollapsibleCard`'ı örnek içerikle render et; doğrulama bitince sayfayı SİL.

Doğrulanacaklar:
1. Havuz kartı kapalı başlıyor, başlıkta bölüm adı ve soru sayısı var
2. Tıklayınca açılıyor, tekrar tıklayınca kapanıyor
3. Cevap seçme adımında kare listesinin SAĞINDA tahta var, kaydedilen konumu gösteriyor
4. Seçili kare tahtada halkayla işaretli
5. Tahtaya tıklamak seçimi değiştirmiyor

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

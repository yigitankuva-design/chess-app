# Özel Sekmeler Ana Ekranda Açılsın Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sporcu ana sayfasındaki hızlı erişimde, Zafer hoca'nın eklediği sekmeler ayrı
sayfaya gitmek yerine "Maç Yap" gibi ana ekranda açılsın; alt sekmeler orada listelensin
ve tıklanınca yine orada açılsın. Pratik alt sekmelerinde kriter seçilince tam ekran maç
sayfasına geçilsin.

**Architecture:** Alt sekme listesi ana ekran ile `/custom/[id]` sayfasında ortak olacağı
için yeni bir `CustomTabPanel` bileşenine taşınır; iki yer de onu kullanır. Ana sayfadaki
`openTab` durumu artık yerleşik sekme anahtarının yanında özel sekme id'sini (sayı) de
tutar. Maç sayfası (`/play`) yeni bir `pool` moduyla, adresten gelen alt sekme kimliğine
göre konum havuzunu yükleyip kriter ekranını atlayarak maçı başlatır.

**Tech Stack:** Next.js/React/TypeScript (`apps/web`), Vitest + Testing Library.

---

## Dosya Yapısı

- **Yeni:** `apps/web/components/custom/CustomTabPanel.tsx` — bir özel sekmenin alt sekme
  akordiyonu (Pratik Yap özel satırı + pratik/yazı içerik dallanması). Tek sorumluluk:
  alt sekmeleri göstermek.
- **Değişir:** `apps/web/components/play/PositionPoolPractice.tsx` — kriterler dışarıdan
  hazır geldiğinde kriter ekranını atlamak için opsiyonel alan.
- **Değişir:** `apps/web/app/(child)/custom/[id]/page.tsx` — kendi akordiyonu yerine
  `CustomTabPanel` kullanır.
- **Değişir:** `apps/web/app/(child)/home/page.tsx` — özel sekme kutucukları bağlantı
  değil açılır düğme olur; açılınca `CustomTabPanel` gösterilir.
- **Değişir:** `apps/web/app/(child)/play/page.tsx` — `pool` modu + mevcut bir adres
  hatasının düzeltilmesi.

---

### Task 1: `writeUrl` düzey hatası (mevcut hata düzeltmesi)

`apps/web/app/(child)/play/page.tsx` içindeki `writeUrl`, adrese ham Stockfish değerini
(`c.level.skill`) yazıyor; ancak sayfanın okuyucu tarafı (satır ~52) bunu düzey numarası
(1-10) olarak yorumluyor. 10 seviyeli sisteme geçişte skill değerleri artık benzersiz
olmadığı için bu ikisi uyuşmuyor — "Ayarları değiştir" sonrası yenilenince yanlış düzey
açılabiliyor.

**Files:**
- Modify: `apps/web/app/(child)/play/page.tsx` (writeUrl içinde `q.set('skill', ...)`)
- Test: `apps/web/tests/play-mode-param.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/play-mode-param.test.tsx` içindeki son `it(...)` bloğundan SONRA, aynı
`describe` bloğunun içine ekle:

```tsx
  it('adres düzey NUMARASINI taşır, ham skill değerini değil (regresyon)', () => {
    renderWith('skill=1&depth=1&tc=3%2B2&mode=bot');
    // Düzey 1'in ham skill değeri 20; adres 1 taşıdığı için maç açılmalı.
    expect(screen.getByTestId('bot-game')).toBeInTheDocument();
    // Ham skill (20) düzey numarası olarak yorumlanırsa eşleşme olmaz:
    renderWith('skill=20&depth=1&tc=3%2B2&mode=bot');
    expect(screen.getAllByTestId('bot-game')).toHaveLength(1);
  });
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/play-mode-param.test.tsx`
Expected: FAIL — `skill=20` de bot-game açtığı için ikinci beklenti 2 eşleşme bulur

- [ ] **Step 3: `writeUrl`'ü düzelt**

`apps/web/app/(child)/play/page.tsx` içinde:

```typescript
    if (c) {
      // Adrese DÜZEY NUMARASI yazılır (1-10). Ham skill değeri 10 seviyeli
      // sistemde düzeyler arasında benzersiz DEĞİL — okuyucu taraf (quickLevel)
      // bunu düzey numarası olarak arıyor.
      q.set('skill', String(c.level.level));
      q.set('tc', c.timeControl.label);
      q.set('color', c.colorChoice);
    }
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/play-mode-param.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(child)/play/page.tsx" apps/web/tests/play-mode-param.test.tsx
git commit -m "fix: play adresine ham skill yerine düzey numarası yazılır"
```

---

### Task 2: `PositionPoolPractice` — hazır kriterle başlama

**Files:**
- Modify: `apps/web/components/play/PositionPoolPractice.tsx`
- Test: `apps/web/tests/position-pool-practice.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/position-pool-practice.test.tsx` dosyasındaki `describe` bloğunun içine,
mevcut testlerden sonra ekle (dosyanın en üstündeki mock'lar zaten kurulu):

```tsx
  it('initialCriteria verilince kriter ekranı ATLANIR, tahta gelir', async () => {
    const { LEVELS, ALL_TIMES } = await import('@/lib/play/levels');
    render(
      <PositionPoolPractice
        positions={POOL}
        initialCriteria={{ level: LEVELS[0], timeControl: ALL_TIMES[0], colorChoice: 'white' }}
      />,
    );
    expect(screen.queryByText(/Pratiğe Başla/)).not.toBeInTheDocument();
    expect(await screen.findByTestId('board')).toBeInTheDocument();
  });
```

Testin en üstündeki mock listesine `ChessBoard` mock'u ekle (dosyada yoksa):

```tsx
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/position-pool-practice.test.tsx`
Expected: FAIL — `initialCriteria` bilinmeyen alan, kriter ekranı hâlâ görünüyor

- [ ] **Step 3: Bileşeni güncelle**

`apps/web/components/play/PositionPoolPractice.tsx`:

```tsx
interface Props {
  positions: PoolPosition[];
  /** Kriterler dışarıda seçildiyse (ana ekrandan gelindi) kriter ekranı ATLANIR. */
  initialCriteria?: MatchCriteriaValue;
}

/**
 * Pratik Yap alt sekmelerinde (Açılış Pratiği Yap hariç) bota karşı konum
 * pratiği. Havuzdan rastgele bir konumla başlar; maç bitince "Aynı Konumu
 * Pratik Et" / "Farklı Bir Konumu Pratik Yap" kartları (BotGame'in
 * practiceActions prop'u üzerinden) görünür. Puan/skor KAYDEDİLMEZ.
 */
export function PositionPoolPractice({ positions, initialCriteria }: Props) {
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(initialCriteria ?? null);
  const [color, setColor] = useState<PieceColor>(
    initialCriteria ? resolveColor(initialCriteria.colorChoice) : 'w',
  );
  const [current, setCurrent] = useState<PoolPosition | null>(
    initialCriteria && positions.length > 0 ? pickRandomPosition(positions) : null,
  );
  const [matchKey, setMatchKey] = useState(0);
```

Geri kalan gövde (boş havuz kontrolü, kriter ekranı, `BotGame` çağrısı) AYNEN KALIR —
başka satır değişmez.

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/position-pool-practice.test.tsx`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/play/PositionPoolPractice.tsx apps/web/tests/position-pool-practice.test.tsx
git commit -m "feat: PositionPoolPractice — hazır kriterle kriter ekranını atlama"
```

---

### Task 3: `CustomTabPanel` — ortak alt sekme paneli

**Files:**
- Create: `apps/web/components/custom/CustomTabPanel.tsx`
- Test: `apps/web/tests/custom-tab-panel.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { CustomTabPanel } from '@/components/custom/CustomTabPanel';
import type { CustomTabDetail } from '@/lib/customTabsApi';

const PRATIK: CustomTabDetail = {
  id: 1, label: 'Pratik Yap', emoji: '🎯',
  sections: [{
    id: 10, order_index: 1, title: 'Süresiz Pratik', body: 'gizli metin', images: [],
    practice_positions: [{ id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }],
  }],
};

const BULMACA: CustomTabDetail = {
  id: 2, label: 'Bulmacalar', emoji: '🧩',
  sections: [{ id: 20, order_index: 1, title: 'Bölüm', body: 'normal metin', images: [], practice_positions: [] }],
};

describe('CustomTabPanel', () => {
  it('Pratik Yap sekmesinde sabit Açılış Pratiği Yap satırı vardır', () => {
    render(<CustomTabPanel tab={PRATIK} />);
    const link = screen.getByText('Açılış Pratiği Yap').closest('a');
    expect(link).toHaveAttribute('href', '/play?mode=opening');
  });

  it('Pratik Yap OLMAYAN sekmede Açılış Pratiği Yap YOKTUR', () => {
    render(<CustomTabPanel tab={BULMACA} />);
    expect(screen.queryByText('Açılış Pratiği Yap')).not.toBeInTheDocument();
  });

  it('alt sekme kapalıyken içerik görünmez, tıklayınca açılır', () => {
    render(<CustomTabPanel tab={BULMACA} />);
    expect(screen.queryByText('normal metin')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Bölüm'));
    expect(screen.getByText('normal metin')).toBeInTheDocument();
  });

  it('Pratik Yap alt sekmesinde yazı yerine kriter ekranı gelir', () => {
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    expect(screen.getByText(/Pratiğe Başla/)).toBeInTheDocument();
    expect(screen.queryByText('gizli metin')).not.toBeInTheDocument();
  });

  it('Pratiğe Başla maç sayfasına doğru adresle gider', async () => {
    push.mockClear();
    render(<CustomTabPanel tab={PRATIK} />);
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz' }));
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('mode=pool');
    expect(url).toContain('tab=1');
    expect(url).toContain('section=10');
    expect(url).toContain('skill=2');
    expect(url).toContain('color=white');
  });
});
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/custom-tab-panel.test.tsx`
Expected: FAIL — modül bulunamadı

- [ ] **Step 3: Bileşeni yaz**

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { CustomTabDetail } from '@/lib/customTabsApi';

interface Props {
  tab: CustomTabDetail;
}

/**
 * Bir özel sekmenin alt sekme listesi (akordiyon). Hem sporcu ana sayfasında
 * (kutucuk açılınca yerinde) hem /custom/[id] sayfasında AYNI bileşen kullanılır —
 * iki yerde iki farklı ekran olmaz.
 *
 * "Pratik Yap" sekmesi özeldir: en üstte sabit Açılış Pratiği Yap satırı durur ve
 * alt sekmeleri yazı/görsel yerine bota karşı pratik kriterlerini gösterir.
 */
export function CustomTabPanel({ tab }: Props) {
  const router = useRouter();
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);
  const isPratikYap = tab.label === 'Pratik Yap';

  return (
    <div className="space-y-2">
      {isPratikYap && (
        <Link href="/play?mode=opening"
          className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ textDecoration: 'none', background: 'var(--t-surface-2)' }}>
          <span className="text-xl leading-none">📖</span>
          <span className="font-bold t-premium">Açılış Pratiği Yap</span>
        </Link>
      )}

      {tab.sections.length === 0 && !isPratikYap && (
        <p className="t-muted">Henüz içerik eklenmedi</p>
      )}

      {tab.sections.map((s) => {
        const open = openSectionId === s.id;
        return (
          <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--t-surface-2)' }}>
            <button type="button"
              onClick={() => setOpenSectionId((p) => (p === s.id ? null : s.id))}
              aria-expanded={open}
              className="w-full flex items-center justify-between px-4 py-3 text-left">
              <span className="text-lg font-bold t-premium">{s.title}</span>
              <span className="t-muted">{open ? '▴' : '▾'}</span>
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-3">
                {isPratikYap ? (
                  s.practice_positions.length === 0 ? (
                    <p className="t-muted text-sm">Henüz konum eklenmedi.</p>
                  ) : (
                    <MatchCriteria
                      startLabel="Pratiğe Başla"
                      onStart={(v) => {
                        router.push(
                          `/play?mode=pool&tab=${tab.id}&section=${s.id}`
                          + `&skill=${v.level.level}`
                          + `&tc=${encodeURIComponent(v.timeControl.label)}`
                          + `&color=${v.colorChoice}`,
                        );
                      }}
                    />
                  )
                ) : (
                  <>
                    {s.body && <p className="t-muted whitespace-pre-wrap">{s.body}</p>}
                    {s.images.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {s.images.map((uri, i) => (
                          <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                            className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/custom-tab-panel.test.tsx`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/custom/CustomTabPanel.tsx apps/web/tests/custom-tab-panel.test.tsx
git commit -m "feat: CustomTabPanel — ortak alt sekme paneli"
```

---

### Task 4: `/custom/[id]` sayfası ortak paneli kullansın

**Files:**
- Modify: `apps/web/app/(child)/custom/[id]/page.tsx`
- Test: `apps/web/tests/custom-tab-view.test.tsx`

- [ ] **Step 1: Sayfayı sadeleştir**

`apps/web/app/(child)/custom/[id]/page.tsx` tamamen şu hâle gelir:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import { CustomTabPanel } from '@/components/custom/CustomTabPanel';

export default function CustomTabViewPage() {
  const params = useParams();
  const router = useRouter();
  const tabId = Number(params.id);
  const [tab, setTab] = useState<CustomTabDetail | null | undefined>(undefined);

  useEffect(() => {
    getCustomTab(tabId).then(setTab);
  }, [tabId]);

  if (tab === undefined) return <p className="t-muted p-4">Yükleniyor...</p>;
  if (tab === null) return <p className="text-rose-400 p-4">Sayfa bulunamadı</p>;

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="text-sm t-muted">← Geri</button>
      <h1 className="text-2xl font-extrabold t-premium flex items-center gap-2">
        <span>{tab.emoji}</span> <span>{tab.label}</span>
      </h1>
      <CustomTabPanel tab={tab} />
    </main>
  );
}
```

- [ ] **Step 2: Mevcut testleri çalıştır (regresyon)**

Run: `cd apps/web && npx vitest run tests/custom-tab-view.test.tsx`
Expected: PASS — sayfa aynı ekranı gösterdiği için mevcut 6 test geçmeli.
Geçmezse: hata mesajını oku; büyük ihtimalle testteki `next/navigation` mock'u
`useRouter` içinde `push` alanı içermiyordur (CustomTabPanel `push` kullanır).
O durumda testin en üstündeki mock'u şununla değiştir:

```tsx
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(child)/custom/[id]/page.tsx" apps/web/tests/custom-tab-view.test.tsx
git commit -m "refactor: /custom sayfası ortak CustomTabPanel'i kullanır"
```

---

### Task 5: Ana sayfada özel sekmeler yerinde açılsın

**Files:**
- Modify: `apps/web/app/(child)/home/page.tsx`
- Test: `apps/web/tests/home-custom-tabs.test.tsx`

- [ ] **Step 1: Mevcut testi yeni davranışa göre değiştir (RED önce)**

`apps/web/tests/home-custom-tabs.test.tsx` dosyasında, `@/lib/customTabsApi` mock'unu
genişlet ve testleri değiştir:

```tsx
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([
    { id: 5, order_index: 1, label: 'Turnuvalar', emoji: '📌' },
  ])),
  getCustomTab: vi.fn(() => Promise.resolve({
    id: 5, label: 'Turnuvalar', emoji: '📌',
    sections: [{ id: 50, order_index: 1, title: 'Kayıt', body: 'En az 8 yaş', images: [], practice_positions: [] }],
  })),
}));
```

`describe` bloğunun içeriğini şununla değiştir:

```tsx
describe('Ana sayfa — özel sekme kartı (B grubu)', () => {
  it('özel sekme kartı AYRI SAYFAYA GİTMEZ (link değil, düğme)', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.getByText('Turnuvalar').closest('a')).toBeNull();
  });

  it('karta tıklayınca alt sekmeler aynı ekranda görünür', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    fireEvent.click(screen.getByText('Turnuvalar'));
    await waitFor(() => screen.getByText('Kayıt'));
    expect(screen.getByText('Kayıt')).toBeInTheDocument();
  });
});
```

Dosyanın en üstündeki import satırına `fireEvent` ekle:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/home-custom-tabs.test.tsx`
Expected: FAIL — kart hâlâ `<a>` bağlantısı

- [ ] **Step 3: `openTab` durumunu özel sekme id'sini de tutacak şekilde genişlet**

`apps/web/app/(child)/home/page.tsx` içinde (satır ~167):

```typescript
  // Tek seferde yalnızca bir sekme açık (akordiyon). Sayı değer = Zafer hocanın
  // eklediği özel sekmenin id'si (yerleşik sekmelerle AYNI akordiyona girer).
  const [openTab, setOpenTab] = useState<TabKey | number | null>(null);
```

Aynı dosyada import satırlarına ekle:

```typescript
import { listCustomTabs, getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabSummary, CustomTabDetail } from '@/lib/customTabsApi';
import { CustomTabPanel } from '@/components/custom/CustomTabPanel';
```

(Mevcut `import { listCustomTabs } from '@/lib/customTabsApi';` ve
`import type { CustomTabSummary } from '@/lib/customTabsApi';` satırlarının YERİNE.)

`customTabs` state'inin hemen altına ekle:

```typescript
  /** Açılan özel sekmenin alt sekmeleri — açılınca yüklenir, tekrar açılınca
   *  yeniden istek atılmaz. */
  const [customTabDetails, setCustomTabDetails] = useState<Record<number, CustomTabDetail>>({});
```

- [ ] **Step 4: Özel sekme açma fonksiyonunu ekle**

`toggleTab` fonksiyonunun hemen ALTINA ekle:

```typescript
  /** Özel sekme kutucuğu — yerleşik sekmelerle aynı akordiyon kuralına girer. */
  function toggleCustomTab(id: number) {
    setOpenTab((prev) => (prev === id ? null : id));
    // Yerleşik dalların iç seçimleri sıfırlanır (toggleTab ile aynı davranış).
    setOpenLevel(null); setOpenLessonId(null); setOpenSubtopic(null);
    setOpenBot(false);
    if (!customTabDetails[id]) {
      getCustomTab(id).then((detail) => {
        if (detail) setCustomTabDetails((prev) => ({ ...prev, [id]: detail }));
      });
    }
  }
```

- [ ] **Step 5: Kutucuğu bağlantıdan düğmeye çevir ve paneli render et**

`apps/web/app/(child)/home/page.tsx` içindeki özel sekme bloğunu (satır ~340-345):

```tsx
          {/* Zafer hocanın eklediği ek sekmeler — ayrı sayfaya GİTMEZ, yerleşik
              sekmeler gibi ana ekranda açılır (kullanıcı kararı 2026-08-09). */}
          {customTabs.map((ct, i) => (
            <FeatureTab
              key={ct.id} emoji={ct.emoji} label={ct.label}
              color={CUSTOM_TAB_COLORS[i % CUSTOM_TAB_COLORS.length]}
              active={openTab === ct.id} onClick={() => toggleCustomTab(ct.id)}
            />
          ))}
```

Ardından, kutucuk ızgarasını kapatan `</div>` satırından HEMEN SONRA (yani
`{/* Maç Yap patikası ... */}` yorumunun hemen ÜSTÜNE) paneli ekle:

```tsx
        {/* Açık özel sekmenin alt sekmeleri — aynı ekranda */}
        {typeof openTab === 'number' && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }} className="mb-4">
            {customTabDetails[openTab]
              ? <CustomTabPanel tab={customTabDetails[openTab]} />
              : <p className="text-sm t-muted">Yükleniyor...</p>}
          </div>
        )}
```

- [ ] **Step 6: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/home-custom-tabs.test.tsx`
Expected: PASS (2 test)

- [ ] **Step 7: Diğer ana sayfa testlerini çalıştır (regresyon)**

Run: `cd apps/web && npx vitest run tests/home-play-modes.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(child)/home/page.tsx" apps/web/tests/home-custom-tabs.test.tsx
git commit -m "feat: ana ekranda özel sekmeler yerinde açılır"
```

---

### Task 6: `/play` — `pool` modu

**Files:**
- Modify: `apps/web/app/(child)/play/page.tsx`
- Test: `apps/web/tests/play-pool-mode.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const search = { value: '' };
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));
vi.mock('@/components/play/OfferBoard', () => ({ OfferBoard: () => <div /> }));
vi.mock('@/components/play/OpeningPractice', () => ({ OpeningPractice: () => <div /> }));
vi.mock('@/components/play/PositionPoolPractice', () => ({
  PositionPoolPractice: ({ positions, initialCriteria }: {
    positions: { id: string }[]; initialCriteria?: { level: { level: number } };
  }) => (
    <div data-testid="pool-practice"
      data-count={positions.length}
      data-level={initialCriteria ? initialCriteria.level.level : 'yok'} />
  ),
}));

const getCustomTab = vi.fn();
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: (id: number) => getCustomTab(id) }));

import PlayPage from '@/app/(child)/play/page';

const SECTION = {
  id: 10, order_index: 1, title: 'Süresiz Pratik', body: '', images: [],
  practice_positions: [{ id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }],
};

beforeEach(() => {
  getCustomTab.mockReset();
  getCustomTab.mockResolvedValue({ id: 1, label: 'Pratik Yap', emoji: '🎯', sections: [SECTION] });
});

describe('/play — pool modu', () => {
  it('havuzu yükler, kriterleri adresten alır ve pratiği başlatır', async () => {
    search.value = 'mode=pool&tab=1&section=10&skill=2&tc=5%2B0&color=white';
    render(<PlayPage />);
    const el = await screen.findByTestId('pool-practice');
    expect(el).toHaveAttribute('data-count', '1');
    expect(el).toHaveAttribute('data-level', '2');
  });

  it('alt sekme bulunamazsa bilgi mesajı gösterir', async () => {
    search.value = 'mode=pool&tab=1&section=999&skill=2&tc=5%2B0&color=white';
    render(<PlayPage />);
    await waitFor(() => screen.getByText(/Bu bölümde henüz konum yok/));
  });
});
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/play-pool-mode.test.tsx`
Expected: FAIL — `pool-practice` bulunamıyor

- [ ] **Step 3: `/play` sayfasına pool modunu ekle**

`apps/web/app/(child)/play/page.tsx` içinde import ekle:

```typescript
import { useEffect } from 'react';
import { getCustomTab } from '@/lib/customTabsApi';
import { PositionPoolPractice } from '@/components/play/PositionPoolPractice';
import type { PoolPosition } from '@/lib/play/positionPool';
```

(`useEffect`'i mevcut `import { useState, Suspense } from 'react';` satırına ekleyerek
`import { useState, useEffect, Suspense } from 'react';` yap.)

`Mode` tipini genişlet:

```typescript
type Mode = 'friend' | 'bot' | 'opening' | 'tournament' | 'pool';
```

`initialMode` hesabını değiştir (mevcut blokla yer değiştirir):

```typescript
  // Ana sayfadaki maç türü kartından gelinmişse o akışı doğrudan aç.
  // "pool" modu ana ekrandaki özel sekme alt sekmesinden gelir; kriterler
  // zaten seçilmiş olduğu için quickStart'tan ÖNCE gelir.
  const modeParam = searchParams.get('mode');
  const sectionParam = searchParams.get('section');
  const tabParam = searchParams.get('tab');
  const initialMode: Mode | null =
    modeParam === 'pool' && sectionParam && tabParam
      ? 'pool'
      : quickStart
        ? 'bot'
        : MODE_CARDS.some((c) => c.mode === modeParam)
          ? (modeParam as Mode)
          : null;
```

`gameKey` state'inin altına havuz durumunu ekle:

```typescript
  /** pool modu: seçilen alt sekmenin konum havuzu. undefined = yükleniyor. */
  const [poolPositions, setPoolPositions] = useState<PoolPosition[] | undefined>(undefined);
  const [poolTitle, setPoolTitle] = useState('');

  useEffect(() => {
    if (initialMode !== 'pool' || !tabParam || !sectionParam) return;
    getCustomTab(Number(tabParam)).then((detail) => {
      const section = detail?.sections.find((s) => s.id === Number(sectionParam));
      setPoolPositions(section?.practice_positions ?? []);
      setPoolTitle(section?.title ?? '');
    });
  }, [initialMode, tabParam, sectionParam]);
```

`backBtn` tanımından SONRA, `tournament` dalından ÖNCE pool dalını ekle:

```tsx
  // ── Konum havuzu pratiği (özel sekme alt sekmesinden gelindi) ───────────────
  if (mode === 'pool') {
    return (
      <main className="pb-12">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <p className="font-semibold text-sm">🎯 {poolTitle || 'Pratik'}</p>
        </div>
        {poolPositions === undefined ? (
          <p className="px-4 text-sm t-muted">Yükleniyor...</p>
        ) : poolPositions.length === 0 ? (
          <p className="px-4 text-sm t-muted">Bu bölümde henüz konum yok.</p>
        ) : (
          <PositionPoolPractice
            positions={poolPositions}
            initialCriteria={quickStart ?? undefined}
          />
        )}
      </main>
    );
  }
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/play-pool-mode.test.tsx`
Expected: PASS (2 test)

- [ ] **Step 5: Mevcut /play testlerini çalıştır (regresyon)**

Run: `cd apps/web && npx vitest run tests/play-mode-param.test.tsx tests/play-page-tabs.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(child)/play/page.tsx" apps/web/tests/play-pool-mode.test.tsx
git commit -m "feat: /play pool modu — özel sekme havuzuyla bot pratiği"
```

---

### Task 7: Tam test kapısı

**Files:** yok (sadece doğrulama)

- [ ] **Step 1: Tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: hata yok

- [ ] **Step 2: Lint**

Run: `cd apps/web && npx next lint`
Expected: yeni hata yok

- [ ] **Step 3: Tüm frontend testleri**

Run: `cd apps/web && npx vitest run`
Expected: hepsi PASS

- [ ] **Step 4: Backend testleri (bu iş backend'e dokunmuyor, yine de çalıştırılır)**

Run: `cd apps/api && python -m pytest -q`
Expected: hepsi PASS

- [ ] **Step 5: Kalan varsa dur, düzelt, Step 1'den tekrar başla**

---

### Task 8: Canlı doğrulama + push onayı

**Files:** yok

- [ ] **Step 1: Kullanıcıya sor**

"Bunu canlı olarak test edeyim mi?" — onay gelmeden yapılmaz.

- [ ] **Step 2: Onay gelirse — ana ekran akışı**

Dev sunucusunu `preview_start` ile aç. Sporcu ana sayfasında özel sekme kutucuğuna
tıkla; sayfanın DEĞİŞMEDİĞİNİ (adres aynı kaldığını) ve alt sekmelerin altta
göründüğünü `get_page_text` ile doğrula. Bir alt sekmeye tıklayıp kriter ekranının
geldiğini doğrula.

- [ ] **Step 3: Maç geçişi**

Kriterleri seçip "Pratiğe Başla"ya bas; `/play?mode=pool...` adresine geçildiğini ve
tahtanın açıldığını doğrula. Tahtanın altında 3 kartın (Terk Et / Aynı Konumu Pratik Et
/ Farklı Bir Konumu Pratik Yap) bulunduğunu doğrula.

- [ ] **Step 4: Sonucu kısa ve net raporla** — ne doğrulandı, ne doğrulanamadı.

- [ ] **Step 5: Push onayı**

"Ana koda göndereyim mi?" — açık onay olmadan `git push` YAPILMAZ.

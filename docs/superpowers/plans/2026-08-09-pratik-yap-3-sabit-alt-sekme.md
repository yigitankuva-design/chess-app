# Pratik Yap 3 Sabit Alt Sekme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Pratik Yap" sekmesinin altında her zaman 3 sabit alt sekme (Açılış Pratiği Yap,
Kazanç Konumunu Pratik Yap, Oyunsonu Pratiği Yap) kart + ikon görünümünde dursun;
hoca'nın kendi eklediği sekmeler korunsun.

**Architecture:** Sabit adlar/ikonlar/sıralama tek bir ortak dosyada (`pratikYap.ts`)
toplanır; admin ve sporcu ekranları oradan okur. İki yeni sabit alt sekme, mevcut alt
sekme yapısının (CustomTabSection) aynısıdır ve eksikse admin sayfası açılırken
kendiliğinden oluşturulur. Veri taşıma gerekmez.

**Tech Stack:** Next.js/React/TypeScript (`apps/web`), Vitest + Testing Library.

---

### Task 1: `pratikYap.ts` — ortak sabitler ve sıralama

**Files:**
- Create: `apps/web/lib/customTabs/pratikYap.ts`
- Test: `apps/web/tests/pratik-yap-sabit.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

```typescript
import { describe, it, expect } from 'vitest';
import {
  PRATIK_YAP_LABEL, OPENING_ROW, FIXED_SECTIONS,
  isFixedSection, sectionEmoji, sortPratikSections,
} from '@/lib/customTabs/pratikYap';

describe('pratikYap sabitleri', () => {
  it('sekme adı ve açılış satırı beklenen değerlerdedir', () => {
    expect(PRATIK_YAP_LABEL).toBe('Pratik Yap');
    expect(OPENING_ROW.title).toBe('Açılış Pratiği Yap');
    expect(OPENING_ROW.emoji).toBe('📖');
  });

  it('iki sabit alt sekme sırayla tanımlıdır', () => {
    expect(FIXED_SECTIONS.map((s) => s.title)).toEqual([
      'Kazanç Konumunu Pratik Yap',
      'Oyunsonu Pratiği Yap',
    ]);
  });

  it('isFixedSection sabit adları tanır, diğerlerini tanımaz', () => {
    expect(isFixedSection('Kazanç Konumunu Pratik Yap')).toBe(true);
    expect(isFixedSection('Oyunsonu Pratiği Yap')).toBe(true);
    expect(isFixedSection('Hocanın Sekmesi')).toBe(false);
  });

  it('sectionEmoji sabitlere ikon verir, diğerlerine vermez', () => {
    expect(sectionEmoji('Kazanç Konumunu Pratik Yap')).toBe('🏆');
    expect(sectionEmoji('Oyunsonu Pratiği Yap')).toBe('🏁');
    expect(sectionEmoji('Hocanın Sekmesi')).toBeNull();
  });

  it('sortPratikSections sabitleri öne, diğerlerini arkaya alır', () => {
    const list = [
      { title: 'Hocanın Sekmesi' },
      { title: 'Oyunsonu Pratiği Yap' },
      { title: 'Başka Sekme' },
      { title: 'Kazanç Konumunu Pratik Yap' },
    ];
    expect(sortPratikSections(list).map((s) => s.title)).toEqual([
      'Kazanç Konumunu Pratik Yap',
      'Oyunsonu Pratiği Yap',
      'Hocanın Sekmesi',
      'Başka Sekme',
    ]);
  });

  it('sabitler eksikken de hocanınkilerin sırası korunur', () => {
    const list = [{ title: 'A' }, { title: 'B' }];
    expect(sortPratikSections(list).map((s) => s.title)).toEqual(['A', 'B']);
  });
});
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/pratik-yap-sabit.test.ts`
Expected: FAIL — modül yok

- [ ] **Step 3: Uygula**

```typescript
/**
 * "Pratik Yap" sekmesinin SABİT yapısı — admin ve sporcu ekranları bu tek
 * kaynaktan okur (liste iki yerde ayrı ayrı yazılmaz).
 */

export const PRATIK_YAP_LABEL = 'Pratik Yap';

/** Alt sekme DEĞİL — açılış listesi sayfasına giden sabit bağlantı satırı. */
export const OPENING_ROW = { title: 'Açılış Pratiği Yap', emoji: '📖' };

/** Her zaman var olması gereken alt sekmeler (yoksa otomatik oluşturulur). */
export const FIXED_SECTIONS: { title: string; emoji: string }[] = [
  { title: 'Kazanç Konumunu Pratik Yap', emoji: '🏆' },
  { title: 'Oyunsonu Pratiği Yap', emoji: '🏁' },
];

/** Sabit alt sekmeler adı değiştirilemez / silinemez. */
export function isFixedSection(title: string): boolean {
  return FIXED_SECTIONS.some((s) => s.title === title);
}

/** Sabit alt sekmenin ikonu; hoca'nın kendi sekmesiyse null. */
export function sectionEmoji(title: string): string | null {
  return FIXED_SECTIONS.find((s) => s.title === title)?.emoji ?? null;
}

/**
 * Görüntüleme sırası: önce sabitler (tanımlı sırayla), sonra hoca'nın kendi
 * sekmeleri (kendi aralarındaki sıraları korunur). Kayıtlı veriye dokunmaz.
 */
export function sortPratikSections<T extends { title: string }>(sections: T[]): T[] {
  const fixed: T[] = [];
  for (const f of FIXED_SECTIONS) {
    const found = sections.find((s) => s.title === f.title);
    if (found) fixed.push(found);
  }
  const rest = sections.filter((s) => !isFixedSection(s.title));
  return [...fixed, ...rest];
}
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/pratik-yap-sabit.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/customTabs/pratikYap.ts apps/web/tests/pratik-yap-sabit.test.ts
git commit -m "feat: pratikYap.ts — Pratik Yap sabit alt sekme tanımları"
```

---

### Task 2: Admin — eksik sabit sekmeleri oluştur, sırala, kilitle

**Files:**
- Modify: `apps/web/app/admin/settings/tabs/page.tsx`
- Test: `apps/web/tests/admin-tabs-custom-subsections.test.tsx`

- [ ] **Step 1: Başarısız testleri yaz**

`apps/web/tests/admin-tabs-custom-subsections.test.tsx` dosyasının sonuna yeni bir
describe bloğu ekle:

```tsx
describe('Admin — Pratik Yap 3 sabit alt sekme', () => {
  it('eksik sabit alt sekmeler açılışta oluşturulur', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩', sections: [],
    });
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockImplementation(
      (_tabId: number, title: string) => Promise.resolve({
        id: title.length, order_index: 1, title, body: '', images: [], practice_positions: [],
      }),
    );

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));

    await waitFor(() => {
      expect(createCustomTabSection).toHaveBeenCalledWith(9, 'Kazanç Konumunu Pratik Yap', '', []);
    });
    await waitFor(() => {
      expect(createCustomTabSection).toHaveBeenCalledWith(9, 'Oyunsonu Pratiği Yap', '', []);
    });
  });

  it('sabit sekmeler zaten varsa TEKRAR oluşturulmaz', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', body: '', images: [], practice_positions: [] },
      ],
    });

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Kazanç Konumunu Pratik Yap'));
    expect(createCustomTabSection).not.toHaveBeenCalled();
  });

  it('sabit sekmelerde Düzenle/Sil YOK, hocanınkinde VAR', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩',
      sections: [
        { id: 1, order_index: 1, title: 'Kazanç Konumunu Pratik Yap', body: '', images: [], practice_positions: [] },
        { id: 2, order_index: 2, title: 'Oyunsonu Pratiği Yap', body: '', images: [], practice_positions: [] },
        { id: 3, order_index: 3, title: 'Hocanın Sekmesi', body: '', images: [], practice_positions: [] },
      ],
    });

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Hocanın Sekmesi'));

    expect(screen.queryByLabelText('Kazanç Konumunu Pratik Yap alt sekmesini sil')).toBeNull();
    expect(screen.queryByLabelText('Kazanç Konumunu Pratik Yap alt sekmesini düzenle')).toBeNull();
    expect(screen.getByLabelText('Hocanın Sekmesi alt sekmesini sil')).toBeInTheDocument();
    expect(screen.getByLabelText('Hocanın Sekmesi alt sekmesini düzenle')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/admin-tabs-custom-subsections.test.tsx`
Expected: FAIL (yeni 3 test)

- [ ] **Step 3: Sayfayı güncelle**

`apps/web/app/admin/settings/tabs/page.tsx` importlarına ekle:

```typescript
import {
  PRATIK_YAP_LABEL, OPENING_ROW, FIXED_SECTIONS,
  isFixedSection, sectionEmoji, sortPratikSections,
} from '@/lib/customTabs/pratikYap';
```

`toggleCustomTab` içindeki yükleme dalını, eksik sabitleri tamamlayacak şekilde
değiştir (mevcut `if (!customTabDetails[id]) { getCustomTab(id).then(...) }` bloğunun
YERİNE):

```typescript
    if (!customTabDetails[id]) {
      getCustomTab(id).then(async (detail) => {
        if (!detail) return;
        // "Pratik Yap" sekmesinde 3 sabit alt sekme HER ZAMAN bulunur; eksik
        // olanlar ilk açılışta oluşturulur (adına göre kontrol — iki kez oluşmaz).
        if (detail.label === PRATIK_YAP_LABEL) {
          for (const f of FIXED_SECTIONS) {
            if (detail.sections.some((s) => s.title === f.title)) continue;
            const created = await createCustomTabSection(id, f.title, '', []);
            if (created) detail = { ...detail, sections: [...detail.sections, created] };
          }
        }
        setCustomTabDetails((prev) => ({ ...prev, [id]: detail! }));
      });
    }
```

Sabit "Açılış Pratiği Yap" bağlantı satırını, diğer sekmelerle aynı kart görünümüne
getirmek için mevcut `{isPratikYap && (<Link href="/admin/openings" ...>)}` bloğunu
şununla değiştir:

```tsx
                  {isPratikYap && (
                    <Link href="/admin/openings"
                      className="flex items-center gap-3 p-3 rounded-lg hover:brightness-125 transition-all"
                      style={{ background: `${color}1a`, border: `1px solid ${color}66` }}>
                      <span className="text-xl leading-none">{OPENING_ROW.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color }}>{OPENING_ROW.title}</p>
                        <p className="text-xs n-muted">Açılış pratiği için açılış ekle ve kaldır</p>
                      </div>
                      <span className="text-sm" style={{ color }}>→</span>
                    </Link>
                  )}
```

Alt sekme listesini sıralı çiz — `detail.sections.map((s) => {` satırını değiştir:

```tsx
                      {(isPratikYap ? sortPratikSections(detail.sections) : detail.sections).map((s) => {
                        const sOpen = openSectionId === s.id;
                        const isEditing = editingSectionId === s.id;
                        const fixed = isPratikYap && isFixedSection(s.title);
                        const emoji = isPratikYap ? sectionEmoji(s.title) : null;
```

Başlık satırında ikonu göster — `<span className="text-sm font-semibold n-text flex-1">{s.title}</span>`
satırını değiştir:

```tsx
                                <span className="text-sm font-semibold n-text flex-1 flex items-center gap-2">
                                  {emoji && <span className="text-base leading-none">{emoji}</span>}
                                  {s.title}
                                </span>
```

Düzenle ve Sil düğmelerini sabitlerde çizme — iki düğmeyi `{!fixed && (<>...</>)}`
içine al:

```tsx
                              {!fixed && (
                                <>
                                  <button type="button" onClick={() => startEditSection(s)}
                                    aria-label={`${s.title} alt sekmesini düzenle`}
                                    className="px-2 py-1 rounded-md text-cyan-300 hover:bg-cyan-400/10 text-xs">
                                    Düzenle
                                  </button>
                                  <button type="button" onClick={() => removeAltSection(c.id, s.id)}
                                    aria-label={`${s.title} alt sekmesini sil`}
                                    className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">
                                    Sil
                                  </button>
                                </>
                              )}
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/admin-tabs-custom-subsections.test.tsx`
Expected: PASS (eski + yeni testler)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/settings/tabs/page.tsx apps/web/tests/admin-tabs-custom-subsections.test.tsx
git commit -m "feat: admin Pratik Yap — 3 sabit alt sekme (ikon, sıra, kilit)"
```

---

### Task 3: Sporcu — aynı sıra ve ikonlar

**Files:**
- Modify: `apps/web/components/custom/CustomTabPanel.tsx`
- Test: `apps/web/tests/custom-tab-panel.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

`apps/web/tests/custom-tab-panel.test.tsx` içindeki describe bloğuna ekle:

```tsx
  it('Pratik Yap sekmesinde sabit alt sekmeler ikonlu ve önce gelir', () => {
    const tab: CustomTabDetail = {
      id: 1, label: 'Pratik Yap', emoji: '🎯',
      sections: [
        { id: 30, order_index: 1, title: 'Hocanın Sekmesi', body: 'x', images: [], practice_positions: [] },
        { id: 31, order_index: 2, title: 'Oyunsonu Pratiği Yap', body: '', images: [], practice_positions: [] },
        { id: 32, order_index: 3, title: 'Kazanç Konumunu Pratik Yap', body: '', images: [], practice_positions: [] },
      ],
    };
    render(<CustomTabPanel tab={tab} />);
    const basliklar = screen.getAllByRole('button').map((b) => b.textContent || '');
    const sira = basliklar.filter((t) => /Kazanç|Oyunsonu|Hocanın/.test(t));
    expect(sira[0]).toContain('Kazanç Konumunu Pratik Yap');
    expect(sira[1]).toContain('Oyunsonu Pratiği Yap');
    expect(sira[2]).toContain('Hocanın Sekmesi');
    expect(sira[0]).toContain('🏆');
    expect(sira[1]).toContain('🏁');
  });
```

- [ ] **Step 2: Testi çalıştır, RED olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/custom-tab-panel.test.tsx`
Expected: FAIL — sıra yanlış / ikon yok

- [ ] **Step 3: Bileşeni güncelle**

`apps/web/components/custom/CustomTabPanel.tsx` importlarına ekle:

```typescript
import { sectionEmoji, sortPratikSections } from '@/lib/customTabs/pratikYap';
```

`{tab.sections.map((s) => {` satırını değiştir:

```tsx
      {(isPratikYap ? sortPratikSections(tab.sections) : tab.sections).map((s) => {
        const open = openSectionId === s.id;
        const emoji = isPratikYap ? sectionEmoji(s.title) : null;
```

Başlık satırını ikonlu yap — `<span className="text-lg font-bold t-premium">{s.title}</span>`
satırını değiştir:

```tsx
              <span className="text-lg font-bold t-premium flex items-center gap-2">
                {emoji && <span className="leading-none">{emoji}</span>}
                {s.title}
              </span>
```

- [ ] **Step 4: Testi çalıştır, GREEN olduğunu doğrula**

Run: `cd apps/web && npx vitest run tests/custom-tab-panel.test.tsx`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/custom/CustomTabPanel.tsx apps/web/tests/custom-tab-panel.test.tsx
git commit -m "feat: sporcu Pratik Yap panelinde sabit sekme sırası ve ikonlar"
```

---

### Task 4: Tam test kapısı

- [ ] **Step 1:** Run: `cd apps/web && npx tsc --noEmit` — Expected: hata yok
- [ ] **Step 2:** Run: `cd apps/web && npx next lint` — Expected: yeni hata yok
- [ ] **Step 3:** Run: `cd apps/web && npx vitest run` — Expected: hepsi PASS
- [ ] **Step 4:** Run: `cd apps/api && python -m pytest -q` — Expected: hepsi PASS
- [ ] **Step 5:** Kalan varsa dur, düzelt, Step 1'den tekrar başla

---

### Task 5: Canlı doğrulama ve yayın

Kullanıcı bu iş için canlı doğrulama ve yayını ÖNCEDEN onayladı
("direk uygula ve sonra canlıya al").

- [ ] **Step 1:** Dev sunucusunu `preview_start` ile aç, sahte veri sunucusu kur.
- [ ] **Step 2:** Admin sekmeler sayfasında Pratik Yap'ı aç; iki sabit alt sekmenin
  oluştuğunu, ikonlu ve doğru sırada göründüğünü, Düzenle/Sil düğmelerinin
  bulunmadığını doğrula.
- [ ] **Step 3:** Sporcu ana ekranında Pratik Yap'ı aç; aynı sıra ve ikonları doğrula.
- [ ] **Step 4:** Temizlik (sunucuları kapat, geçici dosyaları sil).
- [ ] **Step 5:** Sonucu kısa raporla ve `git push origin main`.

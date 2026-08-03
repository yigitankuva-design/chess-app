# Admin Panel — Başlık Düzenleme, Zorluk Renklendirme, Sabit Tahta (A Grubu) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zafer hoca'ya (1) modül/ders/ders-adımı başlıklarını panelden değiştirme, (2) Süresiz Pratik Yap soru havuzunda zorluğa göre renklendirme, (3) çoktan seçmeli soru tiplerinde Talimat ile Seçenek Sayısı arasında (opsiyonel) bir tahta ekleme özelliklerini kazandırmak.

**Architecture:** Üç bağımsız değişiklik seti. Başlık düzenleme mevcut PATCH uç noktalarını kullanır (backend değişikliği yok), yeni paylaşılan `InlineTitleEdit` bileşeniyle üç ekrana eklenir. Zorluk renklendirme mevcut `difficulty` alanını okuyup küçük bir yardımcı fonksiyonla renge çevirir. Sabit tahta, "Görüntü Ekle" tipinde var olan tahtanın yerini değiştirir; "Cümle Ekle" tipine ise `BoardEditor` bileşeni yeniden kullanılarak yeni bir opsiyonel `fen`/`sentence_show_board` alanı eklenir (backend'de küçük bir doğrulama genişlemesiyle).

**Tech Stack:** Next.js 15 (apps/web), FastAPI + SQLAlchemy async (apps/api), Vitest + Testing Library, pytest.

---

### Task 1: `difficultyColor()` yardımcı fonksiyonu

**Files:**
- Modify: `apps/web/lib/difficultyLabels.ts`
- Test: `apps/web/tests/difficulty-labels.test.ts` (yeni dosya)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { difficultyColor } from '@/lib/difficultyLabels';

describe('difficultyColor', () => {
  it('2 ve altı zorluk yeşil (Kolay) döner', () => {
    expect(difficultyColor(1)).toBe('#4ade80');
    expect(difficultyColor(2)).toBe('#4ade80');
  });
  it('3 zorluk mavi (Orta) döner', () => {
    expect(difficultyColor(3)).toBe('#60a5fa');
  });
  it('4 ve üstü zorluk kırmızı (Zor) döner', () => {
    expect(difficultyColor(4)).toBe('#f87171');
    expect(difficultyColor(5)).toBe('#f87171');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/web`): `npx vitest run tests/difficulty-labels.test.ts`
Expected: FAIL — `difficultyColor` is not exported

- [ ] **Step 3: Write minimal implementation**

Add to `apps/web/lib/difficultyLabels.ts` (after `nearestDifficultyValue`):

```ts
/** Zorluğu üç renge indirger — soru havuzu dairelerinde kullanılır (Kolay/Orta/Zor). */
export function difficultyColor(d: number): string {
  const v = nearestDifficultyValue(d);
  if (v === 1) return '#4ade80'; // Kolay — yeşil
  if (v === 3) return '#60a5fa'; // Orta — mavi
  return '#f87171'; // Zor — kırmızı
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/difficulty-labels.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/difficultyLabels.ts apps/web/tests/difficulty-labels.test.ts
git commit -m "feat: difficultyColor yardımcı fonksiyonu"
```

---

### Task 2: Havuz dairesi renk entegrasyonu (Süresiz Pratik Yap)

**Files:**
- Modify: `apps/web/app/admin/content/lesson/[lessonId]/page.tsx:339-369`
- Test: `apps/web/tests/admin-lesson-ui-persist.test.tsx` (yeni test eklenir — mevcut dosya)

- [ ] **Step 1: Write the failing test**

Mevcut `apps/web/tests/admin-lesson-ui-persist.test.tsx` dosyasındaki `STEPS` sabitine bir `board_exercises` sorusu ekle ve yeni bir `describe` bloğu ekle:

```tsx
const STEPS_WITH_QUESTIONS = [
  {
    id: 1, lesson_id: 7, order_index: 1, type: 'explanation',
    content_json: {
      title: 'Piyon Hareketleri',
      board_exercises: [
        { type: 'click_square', instruction: 'e4', target_squares: ['e4'], difficulty: 1 },
        { type: 'click_square', instruction: 'e5', target_squares: ['e5'], difficulty: 5 },
      ],
      board_exercises_timed: [
        { type: 'click_square', instruction: 'e4', target_squares: ['e4'], difficulty: 1 },
      ],
      board_exercises_test: [],
    },
    correct_answer_json: null,
  },
];

describe('Admin ders sayfası — havuz dairesi zorluk rengi (A grubu madde 4)', () => {
  it('Süresiz Pratik Yap havuzunda daireler zorluğa göre renklenir', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(STEPS_WITH_QUESTIONS) }),
    ) as unknown as typeof fetch);
    render(<AdminStepEditorPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));
    fireEvent.click(screen.getByText(/Sorular/));
    await waitFor(() => screen.getByText('Süresiz Pratik Yap'));
    fireEvent.click(screen.getByText('Süresiz Pratik Yap'));

    const circles = await screen.findAllByTitle(/./); // exerciseBadgeTitle her daireye title basar
    const kolay = circles.find((c) => c.textContent === '001')!;
    const zor = circles.find((c) => c.textContent === '002')!;
    expect(kolay.style.color).toBe('rgb(74, 222, 128)'); // #4ade80
    expect(zor.style.color).toBe('rgb(248, 113, 113)'); // #f87171
  });

  it('Süreli Pratik Yap havuzunda daireler MOD rengini korur (zorluğa göre değişmez)', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(STEPS_WITH_QUESTIONS) }),
    ) as unknown as typeof fetch);
    render(<AdminStepEditorPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));
    fireEvent.click(screen.getByText(/Sorular/));
    await waitFor(() => screen.getByText('Süreli Pratik Yap'));
    fireEvent.click(screen.getByText('Süreli Pratik Yap'));

    const circle = await screen.findByText('001');
    expect(circle.style.color).toBe('rgb(251, 191, 36)'); // #fbbf24 — mode.color
  });
});
```

Not: `codes[idx]` üç haneli kod üretir (`assignExerciseCodes`) — ilk soru `001`, ikinci `002` olur (mevcut davranış, `admin-lesson-ui-persist.test.tsx` dosyasındaki diğer testlerden aynı varsayım devam eder).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin-lesson-ui-persist.test.tsx`
Expected: FAIL — dairelerin rengi hâlâ `mode.color` (`rgb(45, 212, 191)`), Kolay/Zor ayrımı yok

- [ ] **Step 3: Write minimal implementation**

`apps/web/app/admin/content/lesson/[lessonId]/page.tsx` başına import ekle:

```ts
import { difficultyColor } from '@/lib/difficultyLabels';
```

Satır ~347-367'deki daire render bloğunu değiştir (mevcut hali Task açıklamasında gösterilmişti):

```tsx
{list.map((ex, idx) => {
  const editingThis = editingExercise?.stepId === s.id
    && editingExercise.field === mode.field && editingExercise.idx === idx;
  const circleColor = mode.field === 'board_exercises'
    ? difficultyColor((ex as { difficulty?: number }).difficulty ?? 1)
    : mode.color;
  return (
    <button
      key={idx}
      title={exerciseBadgeTitle(ex)}
      onClick={() => setEditingExercise(editingThis ? null : { stepId: s.id, field: mode.field, idx })}
      className="aspect-square rounded-full flex items-center justify-center font-mono font-bold transition-all"
      style={{
        fontSize: '0.85rem',
        border: `1.5px solid ${circleColor}`,
        background: editingThis ? circleColor : `color-mix(in srgb, ${circleColor} 12%, transparent)`,
        color: editingThis ? '#0b0f1a' : circleColor,
        boxShadow: editingThis ? `0 0 12px -2px ${circleColor}` : 'none',
      }}
    >
      {codes[idx]}
    </button>
  );
})}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin-lesson-ui-persist.test.tsx`
Expected: PASS (tüm testler, eskiler dahil)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/content/lesson/\[lessonId\]/page.tsx apps/web/tests/admin-lesson-ui-persist.test.tsx
git commit -m "feat: Süresiz Pratik Yap havuzunda zorluk renklendirmesi"
```

---

### Task 3: `InlineTitleEdit` bileşeni

**Files:**
- Create: `apps/web/components/admin/InlineTitleEdit.tsx`
- Test: `apps/web/tests/inline-title-edit.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineTitleEdit } from '@/components/admin/InlineTitleEdit';

describe('InlineTitleEdit', () => {
  it('düzenle tıklanınca input açılır, kaydet ile onSave çağrılır', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<InlineTitleEdit value="Eski Başlık" onSave={onSave} ariaLabel="Başlığı düzenle" />);
    fireEvent.click(screen.getByLabelText('Başlığı düzenle'));
    fireEvent.change(screen.getByLabelText('Başlığı düzenle'), { target: { value: 'Yeni Başlık' } });
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Yeni Başlık'));
  });

  it('boş başlık kaydedilmez, hata gösterilir', () => {
    const onSave = vi.fn();
    render(<InlineTitleEdit value="Başlık" onSave={onSave} ariaLabel="Başlığı düzenle" />);
    fireEvent.click(screen.getByLabelText('Başlığı düzenle'));
    fireEvent.change(screen.getByLabelText('Başlığı düzenle'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Kaydet'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Başlık boş olamaz')).toBeInTheDocument();
  });

  it('iptal ile eski değere döner, onSave çağrılmaz', () => {
    const onSave = vi.fn();
    render(<InlineTitleEdit value="Sabit" onSave={onSave} ariaLabel="Başlığı düzenle" />);
    fireEvent.click(screen.getByLabelText('Başlığı düzenle'));
    fireEvent.change(screen.getByLabelText('Başlığı düzenle'), { target: { value: 'Değişti' } });
    fireEvent.click(screen.getByText('İptal'));
    expect(screen.getByText('Sabit')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('düzenle butonuna tıklamak dış tıklama olaylarını (Link navigasyonu) durdurur', () => {
    const outerClick = vi.fn();
    const onSave = vi.fn();
    render(
      <div onClick={outerClick}>
        <InlineTitleEdit value="Başlık" onSave={onSave} ariaLabel="Başlığı düzenle" />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Başlığı düzenle'));
    expect(outerClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/inline-title-edit.test.tsx`
Expected: FAIL — module not found (`@/components/admin/InlineTitleEdit`)

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';
import { useState } from 'react';

interface Props {
  value: string;
  onSave: (next: string) => Promise<boolean>;
  ariaLabel: string;
  textClassName?: string;
}

/** Modül/ders/ders-adımı başlıkları için tekrar kullanılan satır-içi düzenleme.
 *  Tıklama olayları içeride durdurulur — bir `<Link>` içine konursa navigasyonu
 *  tetiklemez (KURAL: modül satırı tamamı tıklanabilir, düzenle butonu istisna). */
export function InlineTitleEdit({ value, onSave, ariaLabel, textClassName }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(value);
    setErr(null);
    setEditing(true);
  }

  async function save() {
    if (!draft.trim()) { setErr('Başlık boş olamaz'); return; }
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (ok) setEditing(false);
    else setErr('Kaydedilemedi');
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className={textClassName}>{value}</span>
        <button type="button" onClick={startEdit} aria-label={ariaLabel} title="Başlığı düzenle"
          className="text-white/40 hover:text-cyan-300 transition-colors">
          ✎
        </button>
      </span>
    );
  }

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2">
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        aria-label={ariaLabel} className="neon-input py-1 text-sm" autoFocus />
      <button type="button" onClick={save} disabled={saving}
        className="px-2 py-1 rounded-md text-xs bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50">
        {saving ? '...' : 'Kaydet'}
      </button>
      <button type="button" onClick={() => setEditing(false)}
        className="px-2 py-1 rounded-md text-xs bg-white/5 text-white/70 border border-white/15 hover:bg-white/10">
        İptal
      </button>
      {err && <span className="text-rose-400 text-xs">{err}</span>}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/inline-title-edit.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/InlineTitleEdit.tsx apps/web/tests/inline-title-edit.test.tsx
git commit -m "feat: InlineTitleEdit paylaşılan bileşeni"
```

---

### Task 4: Modül (düzey) adı düzenleme

**Files:**
- Modify: `apps/web/app/admin/content/page.tsx`
- Test: `apps/web/tests/admin-content-module-rename.test.tsx` (yeni dosya)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import AdminContentPage from '@/app/admin/content/page';

const ROWS = [{ id: 1, order_index: 1, name: 'Temel Düzey', lesson_count: 3 }];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    if (opts?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(ROWS) });
  }) as unknown as typeof fetch);
});

describe('Admin içerik sayfası — düzey adı düzenleme (A grubu madde 2)', () => {
  it('düzenle tıklanınca isim değişir ve PATCH /admin/modules/1 çağrılır', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));

    fireEvent.click(screen.getByLabelText('Temel Düzey düzey adını düzenle'));
    const input = screen.getByLabelText('Temel Düzey düzey adını düzenle');
    fireEvent.change(input, { target: { value: 'İleri Düzey' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain('/admin/modules/1');
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ name: 'İleri Düzey' });
    });
  });

  it('düzenle butonuna tıklamak düzey sayfasına gitmez (Link navigasyonu durur)', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    const editBtn = screen.getByLabelText('Temel Düzey düzey adını düzenle');
    const evt = fireEvent.click(editBtn);
    // preventDefault çağrıldıysa jsdom navigasyon denemez — hata fırlatmaz.
    expect(evt).toBe(false); // preventDefault sonrası dispatchEvent false döner
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin-content-module-rename.test.tsx`
Expected: FAIL — `getByLabelText('Temel Düzey düzey adını düzenle')` bulunamaz

- [ ] **Step 3: Write minimal implementation**

`apps/web/app/admin/content/page.tsx` başına import ekle:

```ts
import { InlineTitleEdit } from '@/components/admin/InlineTitleEdit';
```

`deleteModule` fonksiyonunun altına yeni fonksiyon ekle:

```ts
async function renameModule(id: number, name: string): Promise<boolean> {
  try {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/modules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) return false;
    await refresh();
    return true;
  } catch {
    return false;
  }
}
```

`<p className="font-bold n-text text-3xl">{m.name}</p>` satırını değiştir:

```tsx
<InlineTitleEdit
  value={m.name}
  onSave={(next) => renameModule(m.id, next)}
  ariaLabel={`${m.name} düzey adını düzenle`}
  textClassName="font-bold n-text text-3xl"
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin-content-module-rename.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/content/page.tsx apps/web/tests/admin-content-module-rename.test.tsx
git commit -m "feat: düzey adı panelden düzenlenebilir"
```

---

### Task 5: Ders başlığı düzenleme

**Files:**
- Modify: `apps/web/app/admin/content/[id]/page.tsx`
- Test: `apps/web/tests/admin-lessons-title-rename.test.tsx` (yeni dosya)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ back: vi.fn() }),
}));

import AdminModuleLessonsPage from '@/app/admin/content/[id]/page';

const LESSONS = [{
  id: 7, module_id: 1, order_index: 1, title: 'Piyon Hareketleri',
  estimated_minutes: 10, published: true, step_count: 2,
}];
const MODULES = [{ id: 1, order_index: 1, name: 'Temel Düzey', lesson_count: 1 }];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    if (opts?.method === 'PATCH') return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    if (url.includes('/lessons')) return Promise.resolve({ ok: true, json: () => Promise.resolve(LESSONS) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(MODULES) });
  }) as unknown as typeof fetch);
});

describe('Admin dersler sayfası — ders başlığı düzenleme (A grubu madde 2)', () => {
  it('düzenle tıklanınca başlık değişir ve PATCH /admin/lessons/7 çağrılır', async () => {
    render(<AdminModuleLessonsPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));

    fireEvent.click(screen.getByLabelText('Piyon Hareketleri ders başlığını düzenle'));
    fireEvent.change(screen.getByLabelText('Piyon Hareketleri ders başlığını düzenle'), {
      target: { value: 'Piyon ve At Hareketleri' },
    });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain('/admin/lessons/7');
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ title: 'Piyon ve At Hareketleri' });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin-lessons-title-rename.test.tsx`
Expected: FAIL — düzenle etiketi bulunamaz

- [ ] **Step 3: Write minimal implementation**

`apps/web/app/admin/content/[id]/page.tsx` başına import ekle:

```ts
import { InlineTitleEdit } from '@/components/admin/InlineTitleEdit';
```

`deleteLesson` fonksiyonunun altına ekle:

```ts
async function renameLesson(les: LessonRow, title: string): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/lessons/${les.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    });
    if (!r.ok) return false;
    await refresh();
    return true;
  } catch {
    return false;
  }
}
```

`<p className="font-semibold n-text truncate">{les.title}</p>` satırını değiştir:

```tsx
<InlineTitleEdit
  value={les.title}
  onSave={(next) => renameLesson(les, next)}
  ariaLabel={`${les.title} ders başlığını düzenle`}
  textClassName="font-semibold n-text truncate"
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin-lessons-title-rename.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/content/\[id\]/page.tsx apps/web/tests/admin-lessons-title-rename.test.tsx
git commit -m "feat: ders başlığı panelden düzenlenebilir"
```

---

### Task 6: Ders adımı (Alt Konu) başlığı düzenleme

**Files:**
- Modify: `apps/web/app/admin/content/lesson/[lessonId]/page.tsx`
- Test: `apps/web/tests/admin-lesson-ui-persist.test.tsx` (mevcut dosyaya eklenir)

- [ ] **Step 1: Write the failing test**

`admin-lesson-ui-persist.test.tsx`'e ekle (Task 2'de eklenen `STEPS_WITH_QUESTIONS`'ı kullanabilir, ama sade tutmak için orijinal `STEPS`'i kullanır):

```tsx
describe('Admin ders sayfası — Alt Konu başlığı düzenleme (A grubu madde 2)', () => {
  it('düzenle tıklanınca başlık değişir ve PATCH /admin/steps/1 içerik title günceller', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH') return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(STEPS) });
    }) as unknown as typeof fetch);

    render(<AdminStepEditorPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));

    fireEvent.click(screen.getByLabelText('Piyon Hareketleri başlığını düzenle'));
    fireEvent.change(screen.getByLabelText('Piyon Hareketleri başlığını düzenle'), {
      target: { value: 'Piyon ve Fil Hareketleri' },
    });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain('/admin/steps/1');
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.content_json.title).toBe('Piyon ve Fil Hareketleri');
      expect(body.content_json.board_exercises).toEqual([]); // diğer alanlar korunur
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin-lesson-ui-persist.test.tsx`
Expected: FAIL — düzenle etiketi bulunamaz

- [ ] **Step 3: Write minimal implementation**

`apps/web/app/admin/content/lesson/[lessonId]/page.tsx` başına import ekle:

```ts
import { InlineTitleEdit } from '@/components/admin/InlineTitleEdit';
```

`stepSummary` fonksiyonunun altına ekle:

```ts
async function renameStepTitle(s: StepRow, title: string): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/steps/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content_json: { ...s.content_json, title } }),
    });
    if (!r.ok) return false;
    await refresh();
    return true;
  } catch {
    return false;
  }
}
```

Satır 283'teki `<p className="font-semibold n-text truncate">{stepSummary(s)}</p>` satırını değiştir:

```tsx
{s.type === 'explanation' ? (
  <InlineTitleEdit
    value={stepSummary(s)}
    onSave={(next) => renameStepTitle(s, next)}
    ariaLabel={`${stepSummary(s)} başlığını düzenle`}
    textClassName="font-semibold n-text truncate"
  />
) : (
  <p className="font-semibold n-text truncate">{stepSummary(s)}</p>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin-lesson-ui-persist.test.tsx`
Expected: PASS (tüm testler)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/content/lesson/\[lessonId\]/page.tsx apps/web/tests/admin-lesson-ui-persist.test.tsx
git commit -m "feat: Alt Konu başlığı panelden düzenlenebilir"
```

---

### Task 7: "Görüntü Ekle" tahtası Talimat ile Seçenek Sayısı arasına taşınır

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx:281-294`
- Test: `apps/web/tests/choice-exercise-fields.test.tsx` (mevcut dosyaya eklenir)

- [ ] **Step 1: Write the failing test**

```tsx
it('image_question: tahta (MultiImagePlacer) talimat input\'undan SONRA görünür', () => {
  render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
  const instructionInput = screen.getByPlaceholderText('Talimat');
  const boardCheckbox = screen.queryByText('Sporcu tahtayı da görsün');
  // Henüz görsel eklenmedi — checkbox yok. Görsel eklemeden önce DOM sırasını
  // input'un tahta alanından ÖNCE mi sonra mı geldiğine bakarak doğrula:
  // instruction input, "Bilgisayardan Seç" etiketinden SONRA gelmeli (madde 5).
  const uploadLabel = screen.getByText('Bilgisayardan Seç');
  const position = uploadLabel.compareDocumentPosition(instructionInput);
  // Node.DOCUMENT_POSITION_FOLLOWING = 4 → instruction, upload alanından SONRA
  expect(position & 4).toBeTruthy();
  expect(boardCheckbox).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-exercise-fields.test.tsx`
Expected: FAIL — şu an talimat input'u görsel alanından ÖNCE geliyor (`position & 4` false)

- [ ] **Step 3: Write minimal implementation**

`ChoiceExerciseFields.tsx`'te `kind === 'image_question'` dalındaki JSX'i yeniden sırala: talimat `<input>`'u (satır ~292-294), görsel seçici bloğunun (satır ~226-291) EN BAŞINA taşı; `MultiImagePlacer` + "Sporcu tahtayı da görsün" checkbox'ı (satır ~281-291) ise EN SONA (talimattan sonra) alınır. Somut olarak mevcut blok:

```tsx
<div className="space-y-2">
  <span className="text-xs n-muted block">Soru görselleri</span>
  {/* ...dosya seç / havuzdan seç / yapıştır butonları (değişmez)... */}
  {/* ...havuza ekle satırı (değişmez)... */}
  {/* Madde 5: tahta artık Talimat'tan SONRA — sıra değişti. */}
  <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
    placeholder="Talimat" className="neon-input" />
  <div className="space-y-2">
    <MultiImagePlacer images={images} onChange={setImages} />
    {images.length > 0 && (
      <label className="flex items-center gap-2 text-xs n-muted">
        <input type="checkbox" checked={showBoard}
          onChange={(e) => setShowBoard(e.target.checked)}
          className="h-4 w-4 accent-cyan-400" />
        Sporcu tahtayı da görsün
      </label>
    )}
  </div>
</div>
```

(Yalnızca talimat `<input>` ile `MultiImagePlacer`+checkbox bloğunun YERİ değişti — dosya seç/havuzdan seç/yapıştır/havuza-ekle blokları aynı konumda, görsel seçicinin başında kalır.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/choice-exercise-fields.test.tsx`
Expected: PASS (tüm testler, eskiler dahil — davranış değişmedi, sadece DOM sırası)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/tests/choice-exercise-fields.test.tsx
git commit -m "feat: Görüntü Ekle tahtası Talimat sonrasına taşındı"
```

---

### Task 8: `SentenceQuestionEx` tipi genişletilir + runtime board render

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx:111-121`
- Modify: `apps/web/components/lesson-steps/ChoiceQuestionVisual.tsx`
- Test: `apps/web/tests/choice-question-visual.test.tsx` (yeni dosya — mevcut değilse oluştur; varsa ekle)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChoiceQuestionVisual } from '@/components/lesson-steps/ChoiceQuestionVisual';
import type { SentenceQuestionEx } from '@/components/lesson-steps/BoardExercise';

const BASE: SentenceQuestionEx = {
  type: 'sentence_question', instruction: 'Hangi kare?', answer_kind: 'sentence',
  options: ['a', 'b'], correct_index: 0,
};

describe('ChoiceQuestionVisual — sentence_question tahtası (A grubu madde 5)', () => {
  it('fen yoksa hiçbir şey render etmez (mevcut davranış korunur)', () => {
    const { container } = render(<ChoiceQuestionVisual exercise={BASE} />);
    expect(container.querySelector('[data-testid="sentence-board"]')).not.toBeInTheDocument();
  });

  it('fen var ve sentence_show_board false DEĞİLSE tahta gösterilir', () => {
    const ex: SentenceQuestionEx = { ...BASE, fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1' };
    const { container } = render(<ChoiceQuestionVisual exercise={ex} />);
    expect(container.querySelector('[data-testid="sentence-board"]')).toBeInTheDocument();
  });

  it('sentence_show_board false ise fen dolu olsa da tahta gösterilmez', () => {
    const ex: SentenceQuestionEx = {
      ...BASE, fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1', sentence_show_board: false,
    };
    const { container } = render(<ChoiceQuestionVisual exercise={ex} />);
    expect(container.querySelector('[data-testid="sentence-board"]')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-question-visual.test.tsx`
Expected: FAIL — `fen`/`sentence_show_board` `SentenceQuestionEx`'te yok (tip hatası), `data-testid="sentence-board"` hiç render edilmiyor

- [ ] **Step 3: Write minimal implementation**

`apps/web/components/lesson-steps/BoardExercise.tsx` — `SentenceQuestionEx` arayüzüne ekle:

```ts
export interface SentenceQuestionEx {
  type: 'sentence_question';
  instruction: string;
  answer_kind: 'sentence' | 'image';
  options: string[];
  correct_index: number;
  success_msg?: string;
  fail_msg?: string;
  code?: string;
  difficulty?: number;
  /** Talimat ile Seçenek Sayısı arasında gösterilen opsiyonel sabit tahta (A grubu madde 5). */
  fen?: string;
  /** Sporcu tahtayı görsün mü — varsayılan true (fen doluysa). */
  sentence_show_board?: boolean;
}
```

`apps/web/components/lesson-steps/ChoiceQuestionVisual.tsx` başına import ekle:

```ts
import { Chessboard } from 'react-chessboard';
import { BOARD_CARD_BG, BOARD_STYLE, getBoardColors, getPieceSet } from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
```

`ChoiceQuestionVisual` fonksiyonunun içine (return'den önce) ekle:

```ts
const { settings } = useSettings();
const boardColors = getBoardColors(settings.board);
const pieceSet = getPieceSet(settings.board.pieces);
```

Return bloğunun en başına (ilk `{exercise.type === 'image_question' && ...}` satırından önce) ekle:

```tsx
{exercise.type === 'sentence_question' && exercise.fen && exercise.sentence_show_board !== false && (
  <div data-testid="sentence-board" className="rounded-xl p-2" style={{ backgroundColor: BOARD_CARD_BG, maxWidth: 240, margin: '0 auto' }}>
    <div className="aspect-square" style={BOARD_STYLE}>
      <Chessboard options={{
        position: exercise.fen,
        allowDragging: false,
        pieces: pieceSet,
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        showNotation: false,
      }} />
    </div>
  </div>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/choice-question-visual.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/components/lesson-steps/ChoiceQuestionVisual.tsx apps/web/tests/choice-question-visual.test.tsx
git commit -m "feat: Cümle Ekle sorularında opsiyonel sabit tahta render"
```

---

### Task 9: "Cümle Ekle" tipine tahta kurma arayüzü

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Modify: `apps/web/components/admin/ExerciseForm.tsx:20-60` (`BoardExercise` arayüzü)
- Test: `apps/web/tests/choice-exercise-fields.test.tsx` (mevcut dosyaya eklenir)

- [ ] **Step 1: Write the failing test**

```tsx
it('sentence_question: tahta kurulup kaydedilirse submit fen ve sentence_show_board gönderir', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);

  fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Hangi kare?' } });
  // Tahta varsayılan boş — taş eklemeden checkbox'ı kapatıp tekrar açarak alanın
  // var olduğunu doğrula (asıl sürükle-bırak testi BoardEditor'ün kendi testinde var).
  const boardShowCheckbox = screen.getByLabelText('Sporcu tahtayı da görsün (Cümle Ekle)');
  expect(boardShowCheckbox).toBeChecked();
  fireEvent.click(boardShowCheckbox);
  expect(boardShowCheckbox).not.toBeChecked();

  const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
  fireEvent.change(optionInputs[0], { target: { value: 'A' } });
  fireEvent.change(optionInputs[1], { target: { value: 'B' } });
  fireEvent.click(screen.getByText('2 seçenek'));
  fireEvent.click(screen.getByText('Cümle'));
  fireEvent.click(screen.getByText('Kolay'));
  fireEvent.click(screen.getByText('Soruyu ekle'));

  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    type: 'sentence_question',
    sentence_show_board: false,
  }));
});

it('sentence_question: tahta kurulmazsa (boş) fen gönderilmez', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);
  fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Soru?' } });
  const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
  fireEvent.change(optionInputs[0], { target: { value: 'A' } });
  fireEvent.change(optionInputs[1], { target: { value: 'B' } });
  fireEvent.click(screen.getByText('2 seçenek'));
  fireEvent.click(screen.getByText('Cümle'));
  fireEvent.click(screen.getByText('Kolay'));
  fireEvent.click(screen.getByText('Soruyu ekle'));
  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  const call = onSubmit.mock.calls[0][0];
  expect(call.fen).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-exercise-fields.test.tsx`
Expected: FAIL — `'Sporcu tahtayı da görsün (Cümle Ekle)'` etiketi yok

- [ ] **Step 3: Write minimal implementation**

`apps/web/components/admin/ExerciseForm.tsx`'teki `BoardExercise` arayüzüne ekle (mevcut `fen?: string` alanı zaten var — yorumunu güncelle, yeni alan ekle):

```ts
  /** Sadece tahta tipleri (Konum Ekle) VE sentence_question (madde 5) için. */
  fen?: string;
  ...
  /** Sadece sentence_question için — sporcu tahtayı görsün mü (madde 5, varsayılan true). */
  sentence_show_board?: boolean;
```

`apps/web/components/admin/ChoiceExerciseFields.tsx` başına import ekle:

```ts
import { BoardEditor } from '@/components/BoardEditor';
```

Dosyanın üstüne (import'lardan sonra) sabit ekle:

```ts
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';
```

Component içine yeni state'ler ekle (mevcut `showBoard` state'inin yanına):

```ts
const [sentenceFen, setSentenceFen] = useState(draft?.sentenceFen ?? initial?.fen ?? EMPTY_FEN);
const [sentenceTurn, setSentenceTurn] = useState<'w' | 'b'>('w');
const [sentenceShowBoard, setSentenceShowBoard] = useState(
  draft?.sentenceShowBoard ?? initial?.sentence_show_board ?? true,
);
```

`ChoiceDraft` arayüzüne ekle (`apps/web/components/admin/ChoiceExerciseFields.tsx` üstündeki interface):

```ts
export interface ChoiceDraft {
  instruction: string;
  images: PlacedImage[];
  optionCount: 2 | 3 | 4;
  answerKind: 'sentence' | 'image';
  options: string[];
  correctIndex: number;
  successMsg: string;
  failMsg: string;
  difficulty: number;
  optionCountChosen: boolean;
  answerKindChosen: boolean;
  difficultyChosen: boolean;
  imageShowBoard: boolean;
  sentenceFen: string;
  sentenceShowBoard: boolean;
}
```

`onDraftChange` `useEffect`'ine yeni alanları ekle (hem obje hem dependency array):

```ts
useEffect(() => {
  onDraftChange?.({
    instruction, images, optionCount, answerKind,
    options, correctIndex, successMsg, failMsg, difficulty,
    optionCountChosen, answerKindChosen, difficultyChosen,
    imageShowBoard: showBoard,
    sentenceFen, sentenceShowBoard,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [instruction, images, optionCount, answerKind, options,
    correctIndex, successMsg, failMsg, difficulty,
    optionCountChosen, answerKindChosen, difficultyChosen, showBoard,
    sentenceFen, sentenceShowBoard]);
```

`kind === 'sentence_question'` dalına (talimat `<input>`'undan hemen sonra) ekle:

```tsx
<input value={instruction} onChange={(e) => setInstruction(e.target.value)}
  placeholder="Soru cümlesi (örn. Atın hareket şekli nasıldır?)" className="neon-input" />
<div className="space-y-2">
  <span className="text-xs n-muted block">Tahta (opsiyonel)</span>
  <div style={{ maxWidth: 260 }}>
    <BoardEditor fen={sentenceFen} turn={sentenceTurn}
      onChange={setSentenceFen} onTurnChange={setSentenceTurn} />
  </div>
  <label className="flex items-center gap-2 text-xs n-muted">
    <input type="checkbox" checked={sentenceShowBoard}
      onChange={(e) => setSentenceShowBoard(e.target.checked)}
      aria-label="Sporcu tahtayı da görsün (Cümle Ekle)"
      className="h-4 w-4 accent-cyan-400" />
    Sporcu tahtayı da görsün
  </label>
</div>
```

`submit()` fonksiyonundaki `base` objesine ekle (mevcut `if (kind === 'image_question') {...}` bloğunun yanına):

```ts
if (kind === 'sentence_question' && sentenceFen !== EMPTY_FEN) {
  base.fen = sentenceFen;
  base.sentence_show_board = sentenceShowBoard;
}
```

`submit()`'in başarılı bitişindeki reset bloğuna ekle (mevcut `if (!editing) {...}` içine):

```ts
setSentenceFen(EMPTY_FEN); setSentenceTurn('w'); setSentenceShowBoard(true);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/choice-exercise-fields.test.tsx`
Expected: PASS (tüm testler)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/components/admin/ExerciseForm.tsx apps/web/tests/choice-exercise-fields.test.tsx
git commit -m "feat: Cümle Ekle sorularına opsiyonel tahta kurma"
```

---

### Task 10: Backend — `sentence_question` için opsiyonel `fen` doğrulaması

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py:599-601`
- Test: `apps/api/tests/test_sentence_question_fen.py` (yeni dosya)

- [ ] **Step 1: Write the failing test**

Mevcut `apps/api/tests/test_click_piece_validation.py` ile birebir aynı desen —
HTTP client/fixture GEREKMEZ, `_validate_board_exercises` doğrudan çağrılır:

```python
import pytest
from fastapi import HTTPException

from chess_api.routers.admin import _validate_board_exercises

BASE_FEN = "8/8/8/8/4K3/8/8/R7 w - - 0 1"


def _sentence_ex(**over):
    ex = {
        "type": "sentence_question",
        "instruction": "Hangi kare?",
        "answer_kind": "sentence",
        "options": ["a", "b"],
        "correct_index": 0,
    }
    ex.update(over)
    return ex


def test_gecerli_fen_kabul_edilir():
    _validate_board_exercises([_sentence_ex(fen=BASE_FEN)])


def test_bozuk_fen_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_sentence_ex(fen="bozuk-fen-degeri")])
    assert e.value.status_code == 400


def test_fen_olmadan_da_kabul_edilir():
    _validate_board_exercises([_sentence_ex()])
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/api`): `python -m pytest tests/test_sentence_question_fen.py -v`
Expected: `test_bozuk_fen_reddedilir` FAIL (400 bekleniyor, hiç hata fırlatılmıyor) — bozuk FEN şu an hiç kontrol edilmiyor

- [ ] **Step 3: Write minimal implementation**

`apps/api/chess_api/routers/admin.py` içindeki `_validate_choice_exercise` fonksiyonunun `else:  # sentence_question` dalını genişlet:

```python
    else:  # sentence_question
        if not (ex.get("instruction") or "").strip():
            raise HTTPException(status_code=400, detail="Cümle sorusu için soru metni gerekli")
        fen = ex.get("fen")
        if fen is not None:
            _validate_fen(fen)
```

(`_validate_fen` fonksiyonu dosyada zaten tanımlı — satır 1001 civarı, Python'da modül seviyesindeki fonksiyonlar çağrı anında çözüldüğü için tanım sırası sorun teşkil etmez.)

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_sentence_question_fen.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_sentence_question_fen.py
git commit -m "feat(api): sentence_question için opsiyonel fen doğrulaması"
```

---

### Task 11: Tam test kapısı + canlı doğrulama

**Files:** (yok — sadece doğrulama)

- [ ] **Step 1: Frontend tam gate**

Run (in `apps/web`):
```bash
npx tsc --noEmit && npx next lint && npx vitest run
```
Expected: tsc 0 hata, lint 0 hata, tüm testler (mevcut + bu plandaki yeniler) PASS.

- [ ] **Step 2: Backend tam gate**

Run (in `apps/api`):
```bash
python -m pytest -q
```
Expected: tüm testler PASS (mevcut regresyon + Task 10'daki 3 yeni test).

- [ ] **Step 3: Canlı doğrulama (KURAL #6) — kullanıcıya sormadan ÖNCE bu adımı yapma**

Kullanıcıya "canlı doğrulayayım mı?" diye sor. Onay gelirse:
- Panel'de bir düzey adını, bir ders başlığını, bir Alt Konu başlığını değiştirip kaydet, sayfa yenilenince kalıcı olduğunu doğrula.
- Süresiz Pratik Yap havuzunda farklı zorluktaki sorularının farklı renkte (yeşil/mavi/kırmızı) göründüğünü, Süreli Pratik Yap'ta hâlâ tek renk (mod rengi) olduğunu doğrula.
- "Cümle Ekle" ile tahta kurup kaydedilen bir soruyu pratik ekranında (sporcu tarafı) aç, tahtanın Talimat altında göründüğünü doğrula; "sporcu görsün" kapalıyken tahtanın görünmediğini doğrula.
- "Görüntü Ekle" tipinde tahtanın artık Talimat'tan sonra göründüğünü doğrula.

- [ ] **Step 4: Commit (varsa küçük düzeltmeler)**

```bash
git add -A
git commit -m "test: A grubu tam test kapısı doğrulaması"
```

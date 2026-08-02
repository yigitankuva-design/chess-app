# Görsel Editörü v2 ve Pratik Akış Düzeltmeleri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin "Görüntü Ekle" akışını çoklu görsel (her biri ayrı konum/boyut/ton),
şeffaflık ve gerçek vektör (SVG) dönüşümüyle genişletmek; sporcu pratik akışındaki
iki gerçek hatayı (yanlış cevap sonrası kaybolan "Sonraki Soruya Geç" butonu +
sayfa yenilemesiyle aynı soruyu tekrar çözebilme; bitmiş oturumun son sorusunda
takılı kalma) kök nedenden düzeltmek.

**Architecture:** Mevcut `lib/chess/imagePlacement.ts` saf mantığı tek-görsel
`ImagePlacer.tsx`'ten çoklu-görsel `MultiImagePlacer.tsx`'e (aynı sürükle/
boyutlandır matematiği, N görsel üzerinde tekrarlanır) taşınıyor; eski
`ImagePlacer.tsx` tamamen siliniyor (yerini alıyor). Backend/tip katmanında
`prompt_image` (tekil, eski) ve `prompt_images` (dizi, yeni) ayrı alanlar —
eski sorular hiç dokunulmadan eskisi gibi çalışır. Şeffaflık istemci-taraflı
canvas ile, vektörleştirme istemci-taraflı `imagetracerjs` kütüphanesiyle —
ikisi de sunucuya dokunmaz. Pratik akışındaki iki hata, `BoardExercise.tsx`'in
cevap durumunu `lib/play/practiceSession.ts` üzerinden kalıcı hale getirmesiyle
düzeltiliyor.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, vitest + @testing-library/react
(apps/web); FastAPI + pytest (apps/api); `imagetracerjs` (yeni npm bağımlılığı).

**Spec:** `docs/superpowers/specs/2026-08-02-gorsel-editoru-v2-ve-pratik-akis-duzeltmeleri-design.md`

---

### Task 1: `lib/chess/imagePlacement.ts` — yeni görsel için varsayılan konum

**Files:**
- Modify: `apps/web/lib/chess/imagePlacement.ts`
- Modify: `apps/web/tests/image-placement.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/image-placement.test.ts`:

```ts
import { defaultPlacementForIndex } from '@/lib/chess/imagePlacement';

describe('defaultPlacementForIndex', () => {
  it('ilk görsel tam ortada başlar', () => {
    expect(defaultPlacementForIndex(0)).toEqual({ x: 50, y: 50, w: 40, h: 40, tone: 0 });
  });

  it('sonraki görseller üst üste binmesin diye kaydırılır', () => {
    const p1 = defaultPlacementForIndex(1);
    expect(p1.x).not.toBe(50);
    expect(p1.y).not.toBe(50);
  });

  it('kaydırma tahta sınırları içinde kalır (clamp)', () => {
    for (let i = 0; i < 20; i++) {
      const p = defaultPlacementForIndex(i);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/image-placement.test.ts`
Expected: FAIL — `defaultPlacementForIndex` bulunamadı.

- [ ] **Step 3: Write the implementation**

Add to `apps/web/lib/chess/imagePlacement.ts` (dosyanın sonuna):

```ts
/** Çoklu görsel eklerken her yeni görselin varsayılan konumu — üst üste
 *  binmesinler diye indekse göre hafifçe kaydırılır (5 adımda bir tekrar eder). */
export function defaultPlacementForIndex(index: number): ImagePlacement {
  const step = index % 5;
  const offset = step * 8;
  return clampPlacement({
    x: DEFAULT_PLACEMENT.x - 16 + offset,
    y: DEFAULT_PLACEMENT.y - 16 + offset,
    w: DEFAULT_PLACEMENT.w,
    h: DEFAULT_PLACEMENT.h,
    tone: 0,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/image-placement.test.ts`
Expected: PASS (15 tests — 12 eski + 3 yeni).

- [ ] **Step 5: Commit**

```bash
cd apps/web
git add lib/chess/imagePlacement.ts tests/image-placement.test.ts
git commit -m "feat(admin): coklu gorsel icin varsayilan konum kaydirma"
```

---

### Task 2: `components/admin/MultiImagePlacer.tsx` — çoklu görsel editörü (ImagePlacer'ın yerini alır)

**Files:**
- Create: `apps/web/components/admin/MultiImagePlacer.tsx`
- Delete: `apps/web/components/admin/ImagePlacer.tsx`
- Create: `apps/web/tests/multi-image-placer.test.tsx`
- Delete: `apps/web/tests/image-placer.test.tsx`

- [ ] **Step 1: Delete the superseded single-image files**

```bash
cd apps/web
git rm components/admin/ImagePlacer.tsx tests/image-placer.test.tsx
```

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiImagePlacer } from '@/components/admin/MultiImagePlacer';
import { DEFAULT_PLACEMENT } from '@/lib/chess/imagePlacement';

const IMG1 = { uri: 'data:image/png;base64,AAA', ...DEFAULT_PLACEMENT };
const IMG2 = { uri: 'data:image/png;base64,BBB', x: 30, y: 30, w: 20, h: 20, tone: 0 };

describe('MultiImagePlacer', () => {
  it('birden fazla görseli aynı anda render eder', () => {
    render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={vi.fn()} />);
    expect(screen.getByAltText('Görsel 1')).toBeInTheDocument();
    expect(screen.getByAltText('Görsel 2')).toBeInTheDocument();
  });

  it('görsele tıklamak onu seçer, ton kaydırıcısını gösterir', () => {
    render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Görsel ton ayarı')).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByAltText('Görsel 1'), { clientX: 0, clientY: 0 });
    expect(screen.getByLabelText('Görsel ton ayarı')).toBeInTheDocument();
  });

  it('seçili görseli sürüklemek onChange ile SADECE o görselin konumunu değiştirir', () => {
    const onChange = vi.fn();
    const { container } = render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={onChange} />);
    const boardWrap = container.querySelector('[data-drag-root]') as HTMLElement;
    boardWrap.getBoundingClientRect = () => ({
      width: 200, height: 200, left: 0, top: 0, right: 200, bottom: 200, x: 0, y: 0, toJSON() {},
    });
    fireEvent.pointerDown(screen.getByAltText('Görsel 1'), { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(boardWrap, { clientX: 120, clientY: 100 });
    const next = onChange.mock.calls[0][0];
    expect(next[0].x).toBe(60);
    expect(next[1]).toEqual(IMG2);
  });

  it('seçili görseli sil butonu diziden çıkarır', () => {
    const onChange = vi.fn();
    render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByAltText('Görsel 2'), { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByText('Sil'));
    expect(onChange).toHaveBeenCalledWith([IMG1]);
  });

  it('ton kaydırıcısı sadece seçili görseli değiştirir', () => {
    const onChange = vi.fn();
    render(<MultiImagePlacer images={[IMG1, IMG2]} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByAltText('Görsel 2'), { clientX: 0, clientY: 0 });
    fireEvent.change(screen.getByLabelText('Görsel ton ayarı'), { target: { value: '6' } });
    const next = onChange.mock.calls[0][0];
    expect(next[0]).toEqual(IMG1);
    expect(next[1].tone).toBe(6);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/multi-image-placer.test.tsx`
Expected: FAIL — `Cannot find module '@/components/admin/MultiImagePlacer'`

- [ ] **Step 4: Write the implementation**

```tsx
'use client';
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';
import {
  type ImagePlacement, clampPlacement, dragToPercent, resizeToPercent, toneToFilter,
} from '@/lib/chess/imagePlacement';

export interface PlacedImage extends ImagePlacement {
  uri: string;
}

interface Props {
  images: PlacedImage[];
  onChange: (images: PlacedImage[]) => void;
}

type DragMode = 'move' | 'resize' | null;

/** Zafer Hoca'nın BİRDEN FAZLA görseli aynı boş tahta üzerinde ayrı ayrı
 *  sürükleyip boyutlandırdığı, ton ayarladığı editör. Tek görsellik
 *  ImagePlacer.tsx'in yerine geçer — aynı sürükle/boyutlandır matematiğini
 *  (lib/chess/imagePlacement.ts) N görsel üzerinde tekrarlar. */
export function MultiImagePlacer({ images, onChange }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; placement: ImagePlacement } | null>(null);
  const [mode, setMode] = useState<DragMode>(null);
  const [selected, setSelected] = useState<number | null>(null);

  function startDrag(e: ReactPointerEvent, i: number, m: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(i);
    dragStart.current = { x: e.clientX, y: e.clientY, placement: images[i] };
    setMode(m);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!mode || selected === null || !dragStart.current || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;
    const next = mode === 'move'
      ? dragToPercent(dragStart.current.placement, deltaX, deltaY, rect.width, rect.height)
      : resizeToPercent(dragStart.current.placement, deltaX, deltaY, rect.width, rect.height);
    onChange(images.map((img, i) => (i === selected ? { ...img, ...next } : img)));
  }

  function endDrag() {
    setMode(null);
    dragStart.current = null;
  }

  function removeSelected() {
    if (selected === null) return;
    onChange(images.filter((_, i) => i !== selected));
    setSelected(null);
  }

  function setTone(tone: number) {
    if (selected === null) return;
    const clamped = clampPlacement({ ...images[selected], tone });
    onChange(images.map((img, i) => (i === selected ? { ...img, ...clamped } : img)));
  }

  const sel = selected !== null ? images[selected] : null;

  return (
    <div className="space-y-2">
      <p className="text-xs n-muted">
        Bir görsele <b>tıkla</b> seç, <b>sürükle</b> taşı, köşesindeki mavi
        tutamaçtan <b>boyutlandır</b>
      </p>
      <div
        ref={boardRef}
        data-drag-root
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ maxWidth: 320 }}
      >
        <EmptyBoardGrid>
          {images.map((img, i) => (
            <img
              key={i}
              src={img.uri}
              alt={`Görsel ${i + 1}`}
              draggable={false}
              onPointerDown={(e) => startDrag(e, i, 'move')}
              className="absolute cursor-move select-none"
              style={{
                left: `${img.x}%`,
                top: `${img.y}%`,
                width: `${img.w}%`,
                height: `${img.h}%`,
                transform: 'translate(-50%, -50%)',
                filter: toneToFilter(img.tone),
                objectFit: 'contain',
                outline: selected === i ? '2px dashed #22d3ee' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
          {sel && selected !== null && (
            <div
              role="button"
              aria-label="Boyutlandır"
              onPointerDown={(e) => startDrag(e, selected, 'resize')}
              className="absolute cursor-nwse-resize"
              style={{
                left: `${sel.x + sel.w / 2}%`,
                top: `${sel.y + sel.h / 2}%`,
                width: 16,
                height: 16,
                transform: 'translate(-50%, -50%)',
                background: '#22d3ee',
                borderRadius: 4,
                border: '2px solid white',
              }}
            />
          )}
        </EmptyBoardGrid>
      </div>
      {sel && (
        <div className="flex items-center gap-2 flex-wrap" style={{ maxWidth: 320 }}>
          <span className="text-xs n-muted">Ton</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={sel.tone}
            aria-label="Görsel ton ayarı"
            onChange={(e) => setTone(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs n-muted w-6 text-right">{sel.tone}</span>
          <button type="button" onClick={removeSelected}
            className="px-2 py-1 rounded-lg text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40 hover:bg-rose-400/20">
            Sil
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/multi-image-placer.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add components/admin/MultiImagePlacer.tsx tests/multi-image-placer.test.tsx
git rm --cached components/admin/ImagePlacer.tsx tests/image-placer.test.tsx 2>/dev/null; true
git commit -m "feat(admin): MultiImagePlacer - coklu gorsel surukle/boyutlandir/ton (ImagePlacer'in yerine)"
```

---

### Task 3: `PoolPicker.tsx` — çoklu seçim modu

**Files:**
- Modify: `apps/web/components/admin/PoolPicker.tsx`
- Test: `apps/web/tests/pool-picker-multi-select.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PoolPicker } from '@/components/admin/PoolPicker';
import * as poolApi from '@/lib/admin/poolApi';

vi.mock('@/lib/admin/poolApi', async () => {
  const actual = await vi.importActual<typeof poolApi>('@/lib/admin/poolApi');
  return { ...actual, fetchPoolImages: vi.fn() };
});

describe('PoolPicker — çoklu seçim (onSelectMultiple)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tek seçim modu (onSelect) eski davranışı korur — tıklayınca hemen seçer ve kapanır', async () => {
    vi.mocked(poolApi.fetchPoolImages).mockResolvedValue([
      { id: 1, category: 'Hayvanlar', data_uri: 'data:image/png;base64,A' },
    ]);
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<PoolPicker onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText('Hayvanlar'));
    const img = await screen.findByAltText('Hayvanlar havuz görseli');
    fireEvent.click(img);
    expect(onSelect).toHaveBeenCalledWith('data:image/png;base64,A');
    expect(onClose).toHaveBeenCalled();
  });

  it('çoklu seçim modunda (onSelectMultiple) farklı kategorilerden seçimler sepette birikir', async () => {
    vi.mocked(poolApi.fetchPoolImages)
      .mockResolvedValueOnce([{ id: 1, category: 'Hayvanlar', data_uri: 'data:image/png;base64,A' }])
      .mockResolvedValueOnce([{ id: 2, category: 'Bitkiler', data_uri: 'data:image/png;base64,B' }]);
    const onSelectMultiple = vi.fn();
    render(<PoolPicker onSelectMultiple={onSelectMultiple} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Hayvanlar'));
    const img1 = await screen.findByLabelText('Hayvanlar havuz görseli');
    fireEvent.click(img1);

    fireEvent.click(screen.getByText('Bitkiler'));
    const img2 = await screen.findByLabelText('Bitkiler havuz görseli');
    fireEvent.click(img2);

    expect(screen.getByLabelText('Hayvanlar havuz görseli (seçili)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Seçilenleri Ekle (2)'));
    expect(onSelectMultiple).toHaveBeenCalledWith([
      'data:image/png;base64,A', 'data:image/png;base64,B',
    ]);
  });

  it('çoklu seçim modunda tekrar tıklamak seçimi geri alır', async () => {
    vi.mocked(poolApi.fetchPoolImages).mockResolvedValue([
      { id: 1, category: 'Hayvanlar', data_uri: 'data:image/png;base64,A' },
    ]);
    render(<PoolPicker onSelectMultiple={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Hayvanlar'));
    const img = await screen.findByLabelText('Hayvanlar havuz görseli');
    fireEvent.click(img);
    expect(await screen.findByLabelText('Hayvanlar havuz görseli (seçili)')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Hayvanlar havuz görseli (seçili)'));
    await waitFor(() => expect(screen.queryByText(/Seçilenleri Ekle/)).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pool-picker-multi-select.test.tsx`
Expected: FAIL — `onSelectMultiple` prop yok, görseller `<img onClick>` olarak render ediliyor
(`aria-label` yok, `getByLabelText` bulamıyor).

- [ ] **Step 3: Write the implementation**

Replace `apps/web/components/admin/PoolPicker.tsx` entirely:

```tsx
'use client';
import { useState } from 'react';
import { POOL_CATEGORIES, fetchPoolImages } from '@/lib/admin/poolApi';
import type { PoolImage } from '@/lib/admin/poolApi';

interface Props {
  onClose: () => void;
  /** Tek seçim modu (varsayılan) — tıklayınca hemen seçer ve paneli kapatır. */
  onSelect?: (dataUri: string) => void;
  /** Çoklu seçim modu — verilirse panel çoklu-seçim UI'ına geçer: tıklama
   *  seçimi aç/kapa yapar, kategori değiştirince seçimler SİLİNMEZ, "Seçilenleri
   *  Ekle" butonuyla toplu onaylanır. */
  onSelectMultiple?: (dataUris: string[]) => void;
}

/**
 * Kategoriye göre havuzdan görsel seçme paneli.
 *
 * Modal DEĞİL, satır-içi genişleyen panel — admin panelinde hiçbir yerde modal
 * kullanılmıyor (kontrol edildi), tutarlılık için aynı dil.
 */
export function PoolPicker({ onClose, onSelect, onSelectMultiple }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [images, setImages] = useState<PoolImage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [basket, setBasket] = useState<string[]>([]);
  const multi = !!onSelectMultiple;

  async function pick(c: string) {
    setCategory(c);
    setLoading(true);
    setImages(null);
    const list = await fetchPoolImages(c);
    setImages(list);
    setLoading(false);
  }

  function toggle(uri: string) {
    setBasket((prev) => (prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri]));
  }

  function confirmMulti() {
    if (basket.length === 0) return;
    onSelectMultiple?.(basket);
    onClose();
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-cyan-400/40 bg-cyan-400/[0.06] space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold n-muted uppercase tracking-widest flex-1">
          Havuzdan Seç{multi && basket.length > 0 ? ` (${basket.length} seçili)` : ''}
        </p>
        <button type="button" onClick={onClose}
          className="px-2.5 py-1 rounded-md text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Kapat
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {POOL_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => pick(c)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
              category === c
                ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                : 'border-white/15 text-white/70 hover:bg-white/5'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {category === null && (
        <p className="text-xs n-muted">Yukarıdan bir kategori seç.</p>
      )}
      {loading && <p className="text-xs n-muted">Yükleniyor...</p>}
      {!loading && images?.length === 0 && (
        <p className="text-xs n-muted">
          Bu kategoride henüz görsel yok. &ldquo;Bilgisayardan Seç&rdquo; ile ekleyip
          havuza kaydedebilirsin.
        </p>
      )}
      {!loading && images && images.length > 0 && (
        <div className="grid grid-cols-6 gap-2">
          {images.map((img) => {
            const on = basket.includes(img.data_uri);
            const label = `${img.category} havuz görseli${on ? ' (seçili)' : ''}`;
            if (!multi) {
              return (
                <img
                  key={img.id}
                  src={img.data_uri}
                  alt={label}
                  onClick={() => { onSelect?.(img.data_uri); onClose(); }}
                  className="cursor-pointer rounded-md bg-white/5 border border-white/10 hover:border-cyan-400 transition-colors"
                  style={{ width: 56, height: 56, objectFit: 'contain' }}
                />
              );
            }
            return (
              <button
                key={img.id}
                type="button"
                aria-label={label}
                onClick={() => toggle(img.data_uri)}
                className="relative rounded-md bg-white/5 transition-colors p-0"
                style={{
                  width: 56, height: 56,
                  border: on ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <img src={img.data_uri} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                {on && (
                  <span aria-hidden="true" className="absolute top-0.5 right-0.5 text-cyan-300 text-xs font-bold"
                    style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '0 3px' }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {multi && basket.length > 0 && (
        <button type="button" onClick={confirmMulti}
          className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25">
          Seçilenleri Ekle ({basket.length})
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pool-picker-multi-select.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Run regression check for existing PoolPicker usages**

Run: `npx vitest run tests/choice-exercise-paste-image.test.tsx tests/choice-exercise-image-delete.test.tsx`
Expected: PASS — bu testler `onSelect` (tek seçim) yolunu kullanan option-image
akışlarını doğrular; API'nin geri kalanı değişmedi.

- [ ] **Step 6: Commit**

```bash
git add components/admin/PoolPicker.tsx tests/pool-picker-multi-select.test.tsx
git commit -m "feat(admin): PoolPicker coklu secim modu (onSelectMultiple)"
```

---

### Task 4: Backend — `prompt_images` dizisi doğrulaması

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Modify: `apps/api/tests/test_board_exercises.py`

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/tests/test_board_exercises.py`:

```python
@pytest.mark.asyncio
async def test_image_question_accepts_prompt_images_array(client, db):
    les = await _lesson(db, order=210)
    tok = await _teacher_token(client, email="multi1@t.com")
    img_a = "data:image/png;base64," + "A" * 100
    img_b = "data:image/png;base64," + "B" * 100
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "İki görsele bak",
         "prompt_images": [
             {"uri": img_a, "x": 30, "y": 30, "w": 20, "h": 20, "tone": 0},
             {"uri": img_b, "x": 70, "y": 70, "w": 20, "h": 20, "tone": 5},
         ],
         "answer_kind": "sentence", "options": ["a", "b"], "correct_index": 0},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_image_question_rejects_empty_prompt_images(client, db):
    les = await _lesson(db, order=211)
    tok = await _teacher_token(client, email="multi2@t.com")
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "Soru", "prompt_images": [],
         "answer_kind": "sentence", "options": ["a", "b"], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_image_question_rejects_out_of_range_element_in_prompt_images(client, db):
    les = await _lesson(db, order=212)
    tok = await _teacher_token(client, email="multi3@t.com")
    img_a = "data:image/png;base64," + "A" * 100
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "Soru",
         "prompt_images": [{"uri": img_a, "x": 150, "y": 30, "w": 20, "h": 20, "tone": 0}],
         "answer_kind": "sentence", "options": ["a", "b"], "correct_index": 0},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_image_question_legacy_prompt_image_still_accepted(client, db):
    """Eski tekil format hâlâ çalışmalı — geriye uyumluluk (KURAL #3)."""
    les = await _lesson(db, order=213)
    tok = await _teacher_token(client, email="multi4@t.com")
    small_img = "data:image/png;base64," + "A" * 100
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "Soru", "prompt_image": small_img,
         "answer_kind": "sentence", "options": ["a", "b"], "correct_index": 0},
    ])
    assert r.status_code == 201
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_board_exercises.py -k multi -v` (from `apps/api`)
Expected: `test_image_question_accepts_prompt_images_array` FAIL (400 — `prompt_image`
zorunlu sanılıyor, `prompt_images` tanınmıyor); `test_image_question_rejects_empty_prompt_images`
ve `rejects_out_of_range` da FAIL (400 bekleniyor ama farklı/yanlış sebep ya da
hiç kontrol yok); `legacy_prompt_image_still_accepted` zaten PASS.

- [ ] **Step 3: Write the implementation**

In `apps/api/chess_api/routers/admin.py`, add a new function right after
`_validate_image_placement` (which stays UNCHANGED, still used for the legacy
single-field path):

```python
def _validate_prompt_images(images: object) -> None:
    """Yeni çoklu-görsel formatı: her biri kendi konum/boyut/ton bilgisiyle
    bir liste. Boş liste veya liste-olmayan reddedilir."""
    if not isinstance(images, list) or len(images) == 0:
        raise HTTPException(status_code=400, detail="En az bir soru görseli gerekli")
    if len(images) > 20:
        raise HTTPException(status_code=400, detail="En fazla 20 görsel eklenebilir")
    ranges = (("x", 0, 100), ("y", 0, 100), ("w", 5, 90), ("h", 5, 90), ("tone", 0, 10))
    for idx, img in enumerate(images):
        if not isinstance(img, dict):
            raise HTTPException(status_code=400, detail=f"{idx + 1}. görsel geçersiz")
        _check_data_uri_size(img.get("uri"), f"{idx + 1}. görsel")
        for field, lo, hi in ranges:
            val = img.get(field)
            if not isinstance(val, (int, float)) or isinstance(val, bool) or val < lo or val > hi:
                raise HTTPException(
                    status_code=400,
                    detail=f"{idx + 1}. görsel {field} {lo}-{hi} arasında olmalı",
                )
```

Replace the `image_question` branch of `_validate_choice_exercise` (currently):

```python
    if ex_type == "image_question":
        img = ex.get("prompt_image")
        if not img:
            raise HTTPException(status_code=400, detail="Görsel soru için görsel gerekli")
        _check_data_uri_size(img, "Soru görseli")
        _validate_image_placement(ex)
```

with:

```python
    if ex_type == "image_question":
        images = ex.get("prompt_images")
        legacy_img = ex.get("prompt_image")
        if images is not None:
            _validate_prompt_images(images)
        elif legacy_img:
            _check_data_uri_size(legacy_img, "Soru görseli")
            _validate_image_placement(ex)
        else:
            raise HTTPException(status_code=400, detail="Görsel soru için görsel gerekli")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_board_exercises.py -v` (from `apps/api`)
Expected: tüm testler (eskiler + 4 yeni) PASS.

- [ ] **Step 5: Commit**

```bash
cd apps/api
git add chess_api/routers/admin.py tests/test_board_exercises.py
git commit -m "feat(api): prompt_images dizisi dogrulamasi (coklu gorsel)"
```

---

### Task 5: Tip tanımları — `PlacedImage` ve `prompt_images`

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`

- [ ] **Step 1: Add the field to `BoardExercise` (admin form type)**

In `apps/web/components/admin/ExerciseForm.tsx`, add right after the existing
`image_show_board?: boolean;` line:

```ts
  /** Sadece image_question için — YENİ çoklu görsel formatı. Varsa
   *  image_x/y/w/h/tone/prompt_image (eski tekil format) yok sayılır. */
  prompt_images?: { uri: string; x: number; y: number; w: number; h: number; tone: number }[];
```

- [ ] **Step 2: Add the same field to `ImageQuestionEx` (student-facing type)**

In `apps/web/components/lesson-steps/BoardExercise.tsx`, add to `ImageQuestionEx`
right after `image_show_board?: boolean;`:

```ts
  prompt_images?: { uri: string; x: number; y: number; w: number; h: number; tone: number }[];
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` (from `apps/web`)
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd apps/web
git add components/admin/ExerciseForm.tsx components/lesson-steps/BoardExercise.tsx
git commit -m "feat: prompt_images alani tiplere eklendi (coklu gorsel)"
```

---

### Task 6: `ChoiceExerciseFields.tsx` — çoklu görsel entegrasyonu

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Test: `apps/web/tests/choice-exercise-multi-image.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ChoiceExerciseFields — çoklu görsel (madde 3)', () => {
  it('birden fazla görsel eklendiğinde hepsi MultiImagePlacer içinde görünür', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} initial={{
      type: 'image_question', instruction: 'x',
      prompt_images: [
        { uri: 'data:image/png;base64,A', x: 30, y: 30, w: 20, h: 20, tone: 0 },
        { uri: 'data:image/png;base64,B', x: 70, y: 70, w: 20, h: 20, tone: 0 },
      ],
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    expect(await screen.findByAltText('Görsel 1')).toBeInTheDocument();
    expect(screen.getByAltText('Görsel 2')).toBeInTheDocument();
  });

  it('eski tekil prompt_image ile düzenlemeye girince tek elemanlı diziye çevrilir', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} initial={{
      type: 'image_question', instruction: 'x', prompt_image: 'data:image/png;base64,LEGACY',
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    expect(await screen.findByAltText('Görsel 1')).toBeInTheDocument();
  });

  it('görsel yokken kaydet butonu kilitli kalır', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
  });

  it('kaydet çağrısı prompt_images dizisini gönderir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="image_question" onSubmit={onSubmit} initial={{
      type: 'image_question', instruction: 'Talimat metni',
      prompt_images: [{ uri: 'data:image/png;base64,A', x: 50, y: 50, w: 40, h: 40, tone: 0 }],
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.prompt_images).toEqual([
      { uri: 'data:image/png;base64,A', x: 50, y: 50, w: 40, h: 40, tone: 0 },
    ]);
    expect(sent.prompt_image).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-exercise-multi-image.test.tsx`
Expected: FAIL — component hâlâ tekil `promptImage`/`ImagePlacer` kullanıyor,
`prompt_images` yazmıyor.

- [ ] **Step 3: Write the implementation**

In `apps/web/components/admin/ChoiceExerciseFields.tsx`:

Replace the import block (currently lines 1-11) with:

```tsx
'use client';
import { useState, useEffect } from 'react';
import type { BoardExercise, QuestionFamily } from './ExerciseForm';
import { compressImageToDataUri } from '@/lib/imageCompress';
import { DIFFICULTY_LABELS, nearestDifficultyValue } from '@/lib/difficultyLabels';
import { PoolPicker } from './PoolPicker';
import { choiceSteps, firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import { StepList } from './StepList';
import { POOL_CATEGORIES, addPoolImage } from '@/lib/admin/poolApi';
import { MultiImagePlacer } from './MultiImagePlacer';
import type { PlacedImage } from './MultiImagePlacer';
import { defaultPlacementForIndex } from '@/lib/chess/imagePlacement';
```

Replace `ChoiceDraft` (currently has `promptImage: string`, `imagePlacement`,
`imageShowBoard`) — remove those three fields, add:

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
}
```

Replace the `promptImage` state and the `placement`/`showBoard` states
(currently `const [promptImage, setPromptImage] = useState(...)` through the
`showBoard` line) with a single normalized array, built from EITHER the new
`prompt_images` OR the legacy `prompt_image` + flat fields:

```ts
  const [images, setImages] = useState<PlacedImage[]>(() => {
    if (draft?.images) return draft.images;
    if (initial?.prompt_images) return initial.prompt_images;
    if (initial?.prompt_image) {
      return [{
        uri: initial.prompt_image,
        x: initial.image_x ?? 50, y: initial.image_y ?? 50,
        w: initial.image_w ?? 40, h: initial.image_h ?? 40,
        tone: initial.image_tone ?? 0,
      }];
    }
    return [];
  });
  const [showBoard, setShowBoard] = useState(
    draft?.imageShowBoard ?? initial?.image_show_board ?? true,
  );
```

Remove the now-unused `promptImage` references everywhere else in the file and
replace them as described below. Update the `useEffect` that writes the draft:

```ts
  useEffect(() => {
    onDraftChange?.({
      instruction, images, optionCount, answerKind,
      options, correctIndex, successMsg, failMsg, difficulty,
      optionCountChosen, answerKindChosen, difficultyChosen,
      imageShowBoard: showBoard,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruction, images, optionCount, answerKind, options,
      correctIndex, successMsg, failMsg, difficulty,
      optionCountChosen, answerKindChosen, difficultyChosen, showBoard]);
```

Replace `onPromptImageFile` (single-file) with a multi-file handler:

```ts
  async function onPromptImagesFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImgErr(null);
    try {
      const compressed = await Promise.all(Array.from(files).map((f) => compressImageToDataUri(f)));
      setImages((prev) => [
        ...prev,
        ...compressed.map((uri, i) => ({ uri, ...defaultPlacementForIndex(prev.length + i) })),
      ]);
    } catch {
      setImgErr('Görsel çok büyük, daha küçük bir görsel seçin');
    }
  }
```

Replace `saveToPool` (which saved the single `promptImage`) to save the LAST
added image (kept simple — pool-adding one specific image at a time, not the
whole set):

```ts
  async function saveToPool() {
    if (images.length === 0) return;
    setPoolAddMsg(null);
    const ok = await addPoolImage(poolAddCategory, images[images.length - 1].uri);
    setPoolAddMsg(ok ? 'Havuza eklendi ✓' : 'Havuza eklenemedi');
  }
```

Replace `handlePromptImagePaste`:

```ts
  async function handlePromptImagePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    await onPromptImagesFiles(dt.files);
  }
```

In `validate()`, replace `if (kind === 'image_question' && !promptImage) return 'Soru görseli gerekli';`
with:

```ts
    if (kind === 'image_question' && images.length === 0) return 'En az bir soru görseli gerekli';
```

In `submit()`, replace the `if (kind === 'image_question') { ... }` block
(which wrote `base.prompt_image`/`image_x`/etc.) with:

```ts
    if (kind === 'image_question') {
      base.prompt_images = images;
      base.image_show_board = showBoard;
    }
```

In `submit()`'s reset block (`if (!editing) { ... }`), replace
`setPromptImage(''); ... setPlacement(DEFAULT_PLACEMENT); setShowBoard(true);`
with:

```ts
        setImages([]); setShowBoard(true);
```

In the JSX, replace the ENTIRE `image_question` branch's image section — from
the `<span className="text-xs n-muted block">Soru görseli</span>` line through
the closing of the old `promptImage &&` blocks and the old `<ImagePlacer .../>`
block — with:

```tsx
        <div className="space-y-2">
          <span className="text-xs n-muted block">Soru görselleri</span>
          <input type="file" accept="image/*" multiple className="hidden" id="prompt-image-input"
            onChange={(e) => onPromptImagesFiles(e.target.files)} />
          <label htmlFor="prompt-image-input"
            className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
            Bilgisayardan Seç
          </label>
          <button type="button"
            onClick={() => setOpenPoolFor((p) => (p === 'prompt' ? null : 'prompt'))}
            className="ml-2 px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-400/20">
            Havuzdan Seç
          </button>
          <div
            role="button"
            tabIndex={0}
            onPaste={handlePromptImagePaste}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs
              border border-dashed border-white/25 text-white/50 cursor-text
              focus:border-cyan-400 focus:text-cyan-200 outline-none ml-2"
          >
            📋 Buraya tıkla, sonra Ctrl+V ile yapıştır
          </div>
          {openPoolFor === 'prompt' && (
            <PoolPicker
              onSelectMultiple={(uris) => {
                setImages((prev) => [
                  ...prev,
                  ...uris.map((uri, i) => ({ uri, ...defaultPlacementForIndex(prev.length + i) })),
                ]);
                setPoolAddMsg(null);
              }}
              onClose={() => setOpenPoolFor(null)}
            />
          )}
          {images.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="n-muted">Havuza da eklensin mi? (son eklenen görsel)</span>
              <select
                aria-label="Havuz kategorisi"
                value={poolAddCategory}
                onChange={(e) => { setPoolAddCategory(e.target.value); setPoolAddMsg(null); }}
                className="neon-input py-1 text-xs"
              >
                <option value="">Kategori seç</option>
                {POOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={saveToPool} disabled={!poolAddCategory}
                className="px-3 py-1 rounded-lg text-xs bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40">
                Havuza Ekle
              </button>
              {poolAddMsg && <span className="n-muted">{poolAddMsg}</span>}
            </div>
          )}
          {images.length > 0 && (
            <div className="space-y-2">
              <MultiImagePlacer images={images} onChange={setImages} />
              <label className="flex items-center gap-2 text-xs n-muted">
                <input type="checkbox" checked={showBoard}
                  onChange={(e) => setShowBoard(e.target.checked)}
                  className="h-4 w-4 accent-cyan-400" />
                Sporcu tahtayı da görsün
              </label>
            </div>
          )}
          <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
            placeholder="Talimat" className="neon-input" />
        </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/choice-exercise-multi-image.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run regression checks**

Run: `npx vitest run tests/choice-exercise-paste-image.test.tsx tests/choice-exercise-image-delete.test.tsx tests/exercise-form-family.test.tsx tests/choice-exercise-image-placement.test.tsx`
Expected: `choice-exercise-image-placement.test.tsx` will FAIL — it tests the
OLD single-image API (`ImagePlacer`, `image_x` output) which this task
intentionally replaces. Delete that test file (its coverage is now provided
by `choice-exercise-multi-image.test.tsx` + `multi-image-placer.test.tsx`):

```bash
git rm tests/choice-exercise-image-placement.test.tsx
```

Re-run: `npx vitest run tests/choice-exercise-paste-image.test.tsx tests/choice-exercise-image-delete.test.tsx tests/exercise-form-family.test.tsx`
Expected: PASS — these exercise the option-image (single-select `PoolPicker`)
path, unaffected by this task.

- [ ] **Step 6: Commit**

```bash
git add components/admin/ChoiceExerciseFields.tsx tests/choice-exercise-multi-image.test.tsx
git commit -m "feat(admin): ChoiceExerciseFields coklu gorsel entegrasyonu (madde 3)"
```

---

### Task 7: `ChoiceQuestionBody.tsx` — çoklu görsel render (sporcu ekranı)

**Files:**
- Modify: `apps/web/components/lesson-steps/ChoiceQuestionBody.tsx`
- Test: `apps/web/tests/choice-question-body-multi-image.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoiceQuestionBody } from '@/components/lesson-steps/ChoiceQuestionBody';
import type { ImageQuestionEx } from '@/components/lesson-steps/BoardExercise';

const BASE: ImageQuestionEx = {
  type: 'image_question', instruction: 'Bak', prompt_image: 'data:image/png;base64,LEGACY',
  answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
};

describe('ChoiceQuestionBody — çoklu görsel (madde 3)', () => {
  it('prompt_images varsa hepsini kendi konum/ton bilgisiyle render eder', () => {
    render(<ChoiceQuestionBody exercise={{
      ...BASE, prompt_image: undefined, prompt_images: [
        { uri: 'data:image/png;base64,A', x: 30, y: 30, w: 20, h: 20, tone: 0 },
        { uri: 'data:image/png;base64,B', x: 70, y: 70, w: 20, h: 20, tone: 5 },
      ], image_show_board: true,
    }} disabled={false} onAnswer={vi.fn()} />);
    expect(screen.getByTestId('empty-board-grid')).toBeInTheDocument();
    const img1 = screen.getByAltText('Görsel 1') as HTMLImageElement;
    const img2 = screen.getByAltText('Görsel 2') as HTMLImageElement;
    expect(img1.style.left).toBe('30%');
    expect(img2.style.filter).toBe('grayscale(0.5)');
  });

  it('prompt_images YOKSA eski davranış (tekil prompt_image, düz görünüm) korunur', () => {
    render(<ChoiceQuestionBody exercise={BASE} disabled={false} onAnswer={vi.fn()} />);
    expect(screen.queryByTestId('empty-board-grid')).not.toBeInTheDocument();
    expect(screen.getByAltText('Soru görseli')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-question-body-multi-image.test.tsx`
Expected: FAIL — `prompt_images` hiç işlenmiyor, `Görsel 1`/`Görsel 2` altyazıları
render edilmiyor.

- [ ] **Step 3: Write the implementation**

Replace `apps/web/components/lesson-steps/ChoiceQuestionBody.tsx` entirely:

```tsx
'use client';
import type { ChoiceTypeConfig } from './BoardExercise';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';
import { toneToFilter } from '@/lib/chess/imagePlacement';

interface Props {
  exercise: ChoiceTypeConfig;
  disabled: boolean;
  onAnswer: (index: number) => void;
}

export function ChoiceQuestionBody({ exercise, disabled, onAnswer }: Props) {
  const gridCols = exercise.options.length === 2 ? 'grid-cols-2'
    : exercise.options.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2';

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/choice-question-body-multi-image.test.tsx tests/choice-question-body-image-placement.test.tsx`
Expected: PASS (2 + 3 = 5 tests) — eski tekil-yerleşim testleri de değişmeden geçer.

- [ ] **Step 5: Commit**

```bash
git add components/lesson-steps/ChoiceQuestionBody.tsx tests/choice-question-body-multi-image.test.tsx
git commit -m "feat: ChoiceQuestionBody coklu gorsel render (madde 3)"
```

---

### Task 8: `lib/imageTransparency.ts` — arka planı şeffaflaştırma (madde 5)

**Files:**
- Create: `apps/web/lib/imageTransparency.ts`
- Test: `apps/web/tests/image-transparency.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { floodFillTransparent } from '@/lib/imageTransparency';

function makeImageData(width: number, height: number, pixels: [number, number, number, number][]): {
  width: number; height: number; data: Uint8ClampedArray;
} {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach(([r, g, b, a], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  });
  return { width, height, data };
}

describe('floodFillTransparent', () => {
  it('kenardan başlayıp beyaz zemini şeffaf yapar, ortadaki şekli korur', () => {
    // 3x3: kenar hepsi beyaz, tam orta siyah (şekil)
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const black: [number, number, number, number] = [0, 0, 0, 255];
    const img = makeImageData(3, 3, [
      white, white, white,
      white, black, white,
      white, white, white,
    ]);
    floodFillTransparent(img, 245);
    const alphaAt = (x: number, y: number) => img.data[(y * 3 + x) * 4 + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(1, 1)).toBe(255);
  });

  it('görselin İÇİNDEKİ beyaz alan (dıştan ulaşılamayan) şeffaf YAPILMAZ', () => {
    // 3x3: kenar siyah çerçeve, tam orta beyaz — beyaz nokta dıştan izole
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const black: [number, number, number, number] = [0, 0, 0, 255];
    const img = makeImageData(3, 3, [
      black, black, black,
      black, white, black,
      black, black, black,
    ]);
    floodFillTransparent(img, 245);
    const alphaAt = (x: number, y: number) => img.data[(y * 3 + x) * 4 + 3];
    expect(alphaAt(1, 1)).toBe(255);
    expect(alphaAt(0, 0)).toBe(255);
  });

  it('eşik değerine göre "beyaza yakın" toleransı ayarlanabilir', () => {
    const offWhite: [number, number, number, number] = [250, 250, 250, 255];
    const img = makeImageData(1, 1, [offWhite]);
    floodFillTransparent(img, 245);
    expect(img.data[3]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/image-transparency.test.ts`
Expected: FAIL — `Cannot find module '@/lib/imageTransparency'`

- [ ] **Step 3: Write the implementation**

```ts
/** Canvas ImageData ile aynı şekle sahip, DOM'a bağımlı olmayan tip —
 *  jsdom/happy-dom gerçek ImageData sınıfını desteklemediği için testte
 *  düz obje verilebilsin diye ayrı tanımlandı. */
export interface RawImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function isNearWhite(r: number, g: number, b: number, threshold: number): boolean {
  return r >= threshold && g >= threshold && b >= threshold;
}

/**
 * Görselin KENARLARINDAN başlayıp bitişik beyaza-yakın pikselleri şeffaf yapar
 * (BFS flood-fill). Görselin İÇİNDEKİ beyaz alanlar (dıştan ulaşılamayan,
 * örn. bir gözün beyazı) etkilenmez — sadece zeminle bağlantılı bölge silinir.
 * `imageData` YERİNDE (in-place) değiştirilir.
 */
export function floodFillTransparent(imageData: RawImageData, threshold: number): void {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  function enqueue(x: number, y: number) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    const p = idx * 4;
    if (isNearWhite(data[p], data[p + 1], data[p + 2], threshold)) {
      queue.push(idx);
    }
  }

  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const p = idx * 4;
    data[p + 3] = 0;
    const x = idx % width;
    const y = Math.floor(idx / width);
    enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1);
  }
}

/** Bir data-URI görselini canvas'a çizip şeffaflaştırıp yeni bir PNG
 *  data-URI olarak döner. Tarayıcı-taraflı — sunucu gerekmez. */
export async function makeBackgroundTransparent(dataUri: string, threshold = 245): Promise<string> {
  const img = await loadImage(dataUri);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas desteklenmiyor');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  floodFillTransparent(imageData, threshold);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel okunamadı'));
    img.src = dataUri;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/image-transparency.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/imageTransparency.ts tests/image-transparency.test.ts
git commit -m "feat(admin): floodFillTransparent - gorsel arka plani seffaflastirma (madde 5)"
```

---

### Task 9: `lib/imageVectorize.ts` — SVG'ye çevirme (madde 4)

**Files:**
- Create: `apps/web/types/imagetracerjs.d.ts`
- Create: `apps/web/lib/imageVectorize.ts`
- Test: `apps/web/tests/image-vectorize.test.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install the library**

```bash
cd apps/web
npm install imagetracerjs
```

Expected: `package.json`'a `"imagetracerjs": "^1.2.6"` eklenir.

- [ ] **Step 2: Add the ambient type declaration**

`imagetracerjs`'in resmi TypeScript tipleri yok. Create `apps/web/types/imagetracerjs.d.ts`:

```ts
declare module 'imagetracerjs' {
  interface ImageTracerStatic {
    imageToSVG(url: string, callback: (svgstring: string) => void, options?: Record<string, unknown>): void;
  }
  const ImageTracer: ImageTracerStatic;
  export default ImageTracer;
}
```

- [ ] **Step 3: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('imagetracerjs', () => ({
  default: {
    imageToSVG: vi.fn((_url: string, callback: (svg: string) => void) => {
      callback('<svg><path d="M0 0"/></svg>');
    }),
  },
}));

import { vectorizeImage } from '@/lib/imageVectorize';

describe('vectorizeImage', () => {
  it('imagetracerjs callback sonucunu base64 SVG data-URI olarak döner', async () => {
    const result = await vectorizeImage('data:image/png;base64,AAA');
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    const decoded = decodeURIComponent(escape(atob(result.split(',')[1])));
    expect(decoded).toBe('<svg><path d="M0 0"/></svg>');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/image-vectorize.test.ts`
Expected: FAIL — `Cannot find module '@/lib/imageVectorize'`

- [ ] **Step 5: Write the implementation**

```ts
import ImageTracer from 'imagetracerjs';

/**
 * Raster görseli (data: URI) otomatik SVG çizgilerine çevirir (potrace-benzeri
 * izleme). Basit ikon/çizim tarzı görsellerde iyi çalışır; fotoğraflarda
 * detay kaybıyla çizgi-tabanlı bir sonuç üretir — bu kütüphanenin doğası,
 * hata değil. Tamamen tarayıcı-taraflı, sunucuya hiçbir şey eklenmez.
 */
export function vectorizeImage(dataUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      ImageTracer.imageToSVG(dataUri, (svgstring: string) => {
        const encoded = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgstring)))}`;
        resolve(encoded);
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Vektörleştirme başarısız'));
    }
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/image-vectorize.test.ts`
Expected: PASS (1 test)

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit` (from `apps/web`)
Expected: 0 errors (ambient `.d.ts` dosyası `tsconfig.json`'daki `"**/*.ts"`
deseniyle otomatik dahil edilir).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json types/imagetracerjs.d.ts lib/imageVectorize.ts tests/image-vectorize.test.ts
git commit -m "feat(admin): vectorizeImage - imagetracerjs ile SVG'ye cevirme (madde 4)"
```

---

### Task 10: Şeffaf Yap / Vektöre Çevir butonları — `MultiImagePlacer.tsx`'e ekleme

**Files:**
- Modify: `apps/web/components/admin/MultiImagePlacer.tsx`
- Modify: `apps/web/tests/multi-image-placer.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/multi-image-placer.test.tsx`. First update its import
line to also bring in `waitFor` (not needed by the Task 2 tests, but required
here):

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

Then append:

```tsx
vi.mock('@/lib/imageTransparency', () => ({
  makeBackgroundTransparent: vi.fn().mockResolvedValue('data:image/png;base64,TRANSPARENT'),
}));
vi.mock('@/lib/imageVectorize', () => ({
  vectorizeImage: vi.fn().mockResolvedValue('data:image/svg+xml;base64,VECTOR'),
}));

describe('MultiImagePlacer — şeffaflık ve vektörleştirme (madde 4/5)', () => {
  it('"Şeffaf Yap" seçili görselin uri\'sini şeffaflaştırılmış haliyle değiştirir', async () => {
    const onChange = vi.fn();
    render(<MultiImagePlacer images={[IMG1]} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByAltText('Görsel 1'), { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByText('Şeffaf Yap'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([
      { ...IMG1, uri: 'data:image/png;base64,TRANSPARENT' },
    ]));
  });

  it('"Vektöre Çevir" seçili görselin uri\'sini SVG haliyle değiştirir', async () => {
    const onChange = vi.fn();
    render(<MultiImagePlacer images={[IMG1]} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByAltText('Görsel 1'), { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByText('Vektöre Çevir'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([
      { ...IMG1, uri: 'data:image/svg+xml;base64,VECTOR' },
    ]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/multi-image-placer.test.tsx`
Expected: FAIL — "Şeffaf Yap"/"Vektöre Çevir" butonları henüz yok.

- [ ] **Step 3: Write the implementation**

In `apps/web/components/admin/MultiImagePlacer.tsx`, add imports:

```ts
import { makeBackgroundTransparent } from '@/lib/imageTransparency';
import { vectorizeImage } from '@/lib/imageVectorize';
```

Add state and handlers inside the component (after `setTone`):

```ts
  const [transforming, setTransforming] = useState(false);

  async function applyTransparency() {
    if (selected === null) return;
    setTransforming(true);
    try {
      const uri = await makeBackgroundTransparent(images[selected].uri);
      onChange(images.map((img, i) => (i === selected ? { ...img, uri } : img)));
    } finally {
      setTransforming(false);
    }
  }

  async function applyVectorize() {
    if (selected === null) return;
    setTransforming(true);
    try {
      const uri = await vectorizeImage(images[selected].uri);
      onChange(images.map((img, i) => (i === selected ? { ...img, uri } : img)));
    } finally {
      setTransforming(false);
    }
  }
```

In the JSX, inside the `{sel && (...)}` toolbar block, add two buttons right
before the existing "Sil" button:

```tsx
          <button type="button" onClick={applyTransparency} disabled={transforming}
            className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 disabled:opacity-40">
            {transforming ? '...' : 'Şeffaf Yap'}
          </button>
          <button type="button" onClick={applyVectorize} disabled={transforming}
            className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 disabled:opacity-40">
            {transforming ? '...' : 'Vektöre Çevir'}
          </button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/multi-image-placer.test.tsx`
Expected: PASS (7 tests — 5 eski + 2 yeni)

- [ ] **Step 5: Commit**

```bash
git add components/admin/MultiImagePlacer.tsx tests/multi-image-placer.test.tsx
git commit -m "feat(admin): Seffaf Yap / Vektore Cevir butonlari (madde 4/5)"
```

---

### Task 11: `BoardExercise.tsx` — yanlış cevap akışı düzeltmesi (madde 6)

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-fail-persistence.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { SentenceQuestionEx } from '@/components/lesson-steps/BoardExercise';

const EX: SentenceQuestionEx = {
  type: 'sentence_question', instruction: 'Soru?', answer_kind: 'sentence',
  options: ['Yanlış', 'Doğru'], correct_index: 1,
};

describe('BoardExercise — yanlış cevap kalıcılığı (madde 6)', () => {
  it('noRetry modunda yanlış cevap sonrası "Sonraki Soruya Geç" 1.8sn sonra da EKRANDA KALIR', async () => {
    vi.useFakeTimers();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry />);
    fireEvent.click(screen.getByText('Yanlış'));
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
    vi.advanceTimersByTime(2000);
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('initialAnswer="wrong" ile mount edilince soru KİLİTLİ ve geribildirimli başlar', () => {
    const onAnswered = vi.fn();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry
      initialIndex={0} initialAnswer="wrong" onAnswered={onAnswered} />);
    expect(screen.getByText('Sonraki Soruya Geç')).toBeInTheDocument();
    expect(screen.getByText('Yanlış!')).toBeInTheDocument();
    // Kilitliyken şıklara tıklamak hiçbir şey değiştirmemeli (tekrar çözülemez).
    fireEvent.click(screen.getByText('Doğru'));
    expect(onAnswered).not.toHaveBeenCalled();
  });

  it('yanlış cevapta onAnswered(index, doneCount, "wrong") çağrılır', () => {
    const onAnswered = vi.fn();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry
      onAnswered={onAnswered} />);
    fireEvent.click(screen.getByText('Yanlış'));
    expect(onAnswered).toHaveBeenCalledWith(0, 0, 'wrong');
  });

  it('doğru cevapta onAnswered(index, doneCount, "correct") çağrılır', () => {
    const onAnswered = vi.fn();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry
      onAnswered={onAnswered} />);
    fireEvent.click(screen.getByText('Doğru'));
    expect(onAnswered).toHaveBeenCalledWith(0, 1, 'correct');
  });

  it('initialDoneCount restore edilince ilerleme ikinci kez sayılmaz', () => {
    const onAnswered = vi.fn();
    render(<BoardExercise exercises={[EX, EX]} done={false} onCorrect={vi.fn()} noRetry
      initialIndex={1} initialDoneCount={1} onAnswered={onAnswered} />);
    fireEvent.click(screen.getByText('Doğru'));
    expect(onAnswered).toHaveBeenCalledWith(1, 2, 'correct');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/board-exercise-fail-persistence.test.tsx`
Expected: FAIL — buton 1.8sn sonra kayboluyor; `initialAnswer`/`onAnswered`/
`initialDoneCount` prop'ları henüz yok.

- [ ] **Step 3: Write the implementation**

In `apps/web/components/lesson-steps/BoardExercise.tsx`, extend `Props`
(currently ends with `onIndexChange?: (index: number) => void;`):

```ts
  /** Sayfa yenilemesinde currentIdx'teki sorunun ÖNCEKİ sonucu. 'wrong' ise
   *  soru kilitli ve geribildirimli başlar — TEKRAR ÇÖZÜLEMEZ (madde 6). */
  initialAnswer?: 'correct' | 'wrong' | null;
  /** Sayfa yenilemesinde restore edilecek doğru-sayısı — succeed() tekrar
   *  +1 yapıp ilerlemeyi ikinci kez saymasın diye. */
  initialDoneCount?: number;
  /** Her cevaplamada (doğru/yanlış) çağrılır — üst sayfa kalıcı hale getirsin. */
  onAnswered?: (index: number, doneCount: number, answer: 'correct' | 'wrong') => void;
```

Replace the component's parameter destructuring and the first few state
declarations (currently `initialIndex = 0, onIndexChange,` through
`const [playedMove, ...]`):

```ts
export function BoardExercise({
  exercises, done, onCorrect, onFinish, noRetry = false,
  initialIndex = 0, onIndexChange, initialAnswer = null, initialDoneCount,
  onAnswered,
}: Props) {
  // Sinirlar icinde tutulur: kayitli sira soru sayisindan buyukse patlamaz.
  const [currentIdx, setCurrentIdx] = useState(
    initialIndex > 0 && initialIndex < exercises.length ? initialIndex : 0,
  );
  const [doneCount, setDoneCount] = useState(done ? exercises.length : (initialDoneCount ?? 0));
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>(
    done ? 'success' : initialAnswer === 'correct' ? 'success' : initialAnswer === 'wrong' ? 'fail' : 'idle',
  );
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(!!initialAnswer && initialIndex < exercises.length - 1);
  const [clickedSquare, setClickedSquare] = useState<string | null>(null);
  const [allAttempted, setAllAttempted] = useState(false);
  /** Madde 1: Suresiz Pratik'te yanlis cevaptan sonra tekrar deneme YOK;
   *  soru kilitlenir, sporcu "Sonraki Soruya Geç" ile ilerler. */
  const [failLocked, setFailLocked] = useState(initialAnswer === 'wrong');
  /** İlk render'da initialAnswer'dan gelen durumu KORUR — aşağıdaki
   *  index-değişince-sıfırla efekti bu durumu hemen ezmesin diye (madde 6). */
  const skipFirstReset = useRef(!!initialAnswer);
  /** Madde 6: dogru cevaplanan Tasi Oynat (eski format) sorusunun oynanan
   *  hamlesi — geribildirim karti altindaki notasyon karti icin. */
  const [playedMove, setPlayedMove] = useState<{ from: string; to: string } | null>(null);
```

Replace the reset-per-index `useEffect` (currently the one starting with
`useEffect(() => { if (done) return; setStatus('idle'); ...`):

```ts
  // Reset per-exercise state when index changes
  useEffect(() => {
    if (done) return;
    if (skipFirstReset.current) {
      // İlk mount'ta initialAnswer'dan gelen durumu koru — sıfırlama.
      skipFirstReset.current = false;
      return;
    }
    setStatus('idle');
    setFeedback('');
    setSelected(null);
    setShowNext(false);
    setClickedSquare(null);
    setFailLocked(false);
    setPlayedMove(null);
    onIndexChange?.(currentIdx);
    // onIndexChange kasten bagimlilikta DEGIL: her renderda yeni fonksiyon
    // gelirse efekt bosuna tekrar calisir ve durum sifirlanir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, done]);
```

Replace `succeed`:

```ts
  const succeed = (piece?: string | null) => {
    if (piece) playPieceSound(piece);
    setStatus('success');
    setSelected(null);
    const next = doneCount + 1;
    setDoneCount(next);
    onAnswered?.(currentIdx, next, 'correct');
    // Bitiş tespiti currentIdx tabanlı (doneCount tabanlı DEĞİL) — çünkü yanlış
    // cevapta da ilerleme olan click_square'de doneCount artık currentIdx'ten
    // geride kalabilir. Mevcut tipler için (her soru doğru cevaplanmak
    // zorunda) bu ikisi zaten eşdeğerdi, bu yüzden davranış değişmiyor.
    if (!isLastQuestion) {
      setShowNext(true);
    } else {
      // Oturum bitti — doğru sayısı `next` (bu soru dahil).
      onFinish?.({ correct: next, total });
      if (next >= total) {
        if (!done) onCorrect();
      } else {
        setAllAttempted(true);
      }
    }
  };
```

Replace `fail` — bu, önceki (setTimeout HER ZAMAN çalışan) sürümdeki kök hatayı
düzeltir: artık `noRetry` modundayken zamanlayıcı hiç çalışmaz:

```ts
  const fail = (msg: string) => {
    setStatus('fail');
    setFeedback(msg);
    setSelected(null);
    if (noRetry) {
      setFailLocked(true);
      onAnswered?.(currentIdx, doneCount, 'wrong');
      if (!isLastQuestion) {
        setShowNext(true);
      } else {
        // Son soru yanlis: dogru sayisi ARTMAZ, oturum burada biter.
        onFinish?.({ correct: doneCount, total });
        setAllAttempted(true);
      }
    } else {
      // Retry İZİN VERİLEN modlarda (noRetry=false) geçici uyarı — 1.8sn
      // sonra kendiliğinden kapanır, sporcu aynı soruyu tekrar dener.
      setTimeout(() => setStatus('idle'), 1800);
    }
  };
```

Replace `failNoRetry`:

```ts
  const failNoRetry = (msg: string) => {
    setStatus('fail');
    setFeedback(msg);
    setSelected(null);
    onAnswered?.(currentIdx, doneCount, 'wrong');
    if (!isLastQuestion) {
      setShowNext(true);
    } else {
      // Oturum bitti — bu soru YANLIŞ olduğu için doneCount artmadı.
      onFinish?.({ correct: doneCount, total });
      setAllAttempted(true);
    }
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/board-exercise-fail-persistence.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Run regression checks**

Run: `npx vitest run tests/board-exercise-click-square.test.tsx tests/board-exercise-onfinish.test.tsx tests/board-exercise-question-reset.test.tsx tests/board-exercise-no-retry.test.tsx tests/board-exercise-two-card-feedback.test.tsx`
Expected: PASS — mevcut davranış (retry-izinli modlarda 1.8sn'lik geçici
uyarı, click_square'in kendi akışı) değişmedi.

- [ ] **Step 6: Commit**

```bash
git add components/lesson-steps/BoardExercise.tsx tests/board-exercise-fail-persistence.test.tsx
git commit -m "fix: yanlis cevap sonrasi Sonraki Soruya Gec butonu kaybolmasin + kalicilik (madde 6)"
```

---

### Task 12: `lib/play/practiceSession.ts` — cevap durumunu da saklama

**Files:**
- Modify: `apps/web/lib/play/practiceSession.ts`
- Test: `apps/web/tests/practice-session.test.ts` (varsa genişlet, yoksa oluştur)

- [ ] **Step 1: Check for an existing test file**

Run: `ls apps/web/tests/practice-session*.test.ts 2>/dev/null || echo "yok"` (proje kökünden)

Eğer dosya varsa mevcut testleri KORUYARAK aşağıdaki yeni testleri EKLE; yoksa
sıfırdan oluştur (aşağıdaki tam içerikle).

- [ ] **Step 2: Write the failing test**

Create/extend `apps/web/tests/practice-session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sessionKey, loadSession, saveSession, clearSession } from '@/lib/play/practiceSession';

describe('practiceSession', () => {
  beforeEach(() => sessionStorage.clear());

  it('sessionKey stepId ve moda göre benzersiz anahtar üretir', () => {
    expect(sessionKey(42, 'suresiz')).toBe('bsa:pratik:42:suresiz');
  });

  it('kayıt yoksa null döner', () => {
    expect(loadSession(sessionKey(1, 'suresiz'))).toBeNull();
  });

  it('kaydedilen oturum currentAnswer ve doneCount ile birlikte geri yüklenir', () => {
    const key = sessionKey(1, 'suresiz');
    saveSession(key, { items: ['a', 'b', 'c'], index: 1, currentAnswer: 'wrong', doneCount: 1 });
    expect(loadSession(key)).toEqual({ items: ['a', 'b', 'c'], index: 1, currentAnswer: 'wrong', doneCount: 1 });
  });

  it('eski (currentAnswer/doneCount alanı olmayan) kayıtlar bozulmadan okunur — geriye uyumluluk', () => {
    const key = sessionKey(1, 'suresiz');
    sessionStorage.setItem(key, JSON.stringify({ items: ['a', 'b'], index: 1 }));
    expect(loadSession(key)).toEqual({ items: ['a', 'b'], index: 1, currentAnswer: null, doneCount: 0 });
  });

  it('clearSession kaydı siler', () => {
    const key = sessionKey(1, 'suresiz');
    saveSession(key, { items: ['a'], index: 0, currentAnswer: null, doneCount: 0 });
    clearSession(key);
    expect(loadSession(key)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/practice-session.test.ts`
Expected: FAIL — `saveSession`'ın ikinci argümanı `currentAnswer`/`doneCount`
kabul etmiyor (tip hatası derleme sırasında, veya `loadSession` bu alanları
dönmüyor).

- [ ] **Step 4: Write the implementation**

Replace `apps/web/lib/play/practiceSession.ts` entirely:

```ts
/** Pratik oturumunu sayfa yenilemesine dayanıklı saklama (madde 4, 6, 7, 9).
 *
 *  Neden sessionStorage: oturum bilgisi KALICI olmamalı — sporcu sekmeyi
 *  kapatınca (veya yeniden giriş yapınca) yeni bir set çekilsin. Yenilemede
 *  (F5) ise aynı sorularda, aynı sırada, aynı cevap durumunda kalınır.
 *
 *  Saklanan veri KULLANICI CEVABININ DOĞRU/YANLIŞ OLDUĞU bilgisidir (madde 6
 *  — sayfa yenilemesiyle aynı soru tekrar çözülemesin diye), asıl PUANLAMA
 *  yine sunucuda kalır.
 */

export interface StoredSession<T> {
  /** Gösterilen soru seti (karıştırılmış hali). */
  items: T[];
  /** Kalınan sorunun sırası. */
  index: number;
  /** index'teki sorunun cevap durumu — 'wrong' ise soru KİLİTLİ ve
   *  geribildirimli kalır, sayfa yenilense bile tekrar çözülemez (madde 6). */
  currentAnswer: 'correct' | 'wrong' | null;
  /** O ana kadar doğru sayılan soru sayısı — sayfa yenilenince ilerlemenin
   *  ikinci kez sayılmaması için. */
  doneCount: number;
}

export function sessionKey(stepId: number | string, mode: string): string {
  return `bsa:pratik:${stepId}:${mode}`;
}

export function loadSession<T>(key: string): StoredSession<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession<T>>;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    const index = Number.isInteger(parsed.index) ? (parsed.index as number) : 0;
    // Bozuk/eski kayit ekrani kilitlemesin: sira daima sinir icinde.
    const clampedIndex = Math.min(Math.max(index, 0), parsed.items.length - 1);
    const currentAnswer = parsed.currentAnswer === 'correct' || parsed.currentAnswer === 'wrong'
      ? parsed.currentAnswer : null;
    const doneCount = Number.isInteger(parsed.doneCount) ? (parsed.doneCount as number) : 0;
    return { items: parsed.items, index: clampedIndex, currentAnswer, doneCount };
  } catch {
    return null;
  }
}

export function saveSession<T>(key: string, data: StoredSession<T>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* kota dolu olabilir — pratik yine calisir, sadece yenilemede set degisir */
  }
}

export function clearSession(key: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(key); } catch { /* yok say */ }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/practice-session.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/play/practiceSession.ts tests/practice-session.test.ts
git commit -m "feat: practiceSession - cevap durumu (currentAnswer/doneCount) da saklanir (madde 6)"
```

---

### Task 13: `pratik/[mode]/page.tsx` — üç modda noRetry + kalıcılık kablolaması + oturum bitince temizleme

**Files:**
- Modify: `apps/web/app/(child)/pratik/[mode]/page.tsx`
- Test: `apps/web/tests/pratik-page-persistence.test.tsx` (varsa genişlet)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { sessionKey, saveSession, loadSession } from '@/lib/play/practiceSession';

vi.mock('next/navigation', () => ({
  useParams: () => ({ mode: 'suresiz' }),
  useSearchParams: () => new URLSearchParams('konu=Test&step=165&ders=42'),
}));
vi.mock('@/lib/practice/practiceApi', () => ({
  fetchLessonScores: vi.fn().mockResolvedValue(null),
  submitPracticeResult: vi.fn().mockResolvedValue({ score: 100, best_score: 100, improved: true }),
}));

import PratikPage from '@/app/(child)/pratik/[mode]/page';

const EX = {
  type: 'sentence_question' as const, instruction: 'S?', answer_kind: 'sentence' as const,
  options: ['Y', 'D'], correct_index: 1, code: '001',
};

describe('pratik/[mode]/page — madde 7 (oturum bitince temizlenir)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ steps: [{ id: 165, type: 'explanation', content_json: { board_exercises: [EX] } }] }),
    }));
  });

  it('oturum bittiğinde (tek soruluk set, cevaplanınca) kayıt sessionStorage\'dan silinir', async () => {
    render(<PratikPage />);
    const btn = await screen.findByText('D');
    fireEvent.click(btn);
    await waitFor(() => expect(loadSession(sessionKey(165, 'suresiz'))).toBeNull());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pratik-page-persistence.test.tsx`
Expected: FAIL — `handleFinish` henüz `clearSession` çağırmıyor, kayıt hâlâ mevcut.

- [ ] **Step 3: Write the implementation**

In `apps/web/app/(child)/pratik/[mode]/page.tsx`:

Add two new state variables right after `const [startIndex, setStartIndex] = useState(0);`:

```ts
  /** Yenilemeden sonra kalinan sorunun cevap durumu (madde 6). */
  const [startAnswer, setStartAnswer] = useState<'correct' | 'wrong' | null>(null);
  /** Yenilemeden sonra restore edilecek doğru-sayısı (madde 6). */
  const [startDoneCount, setStartDoneCount] = useState(0);
```

In the exercise-loading `useEffect`, replace the `if (saved) { ... }` block:

```ts
        if (saved) {
          setExercises(saved.items);
          setStartIndex(saved.index);
          setStartAnswer(saved.currentAnswer);
          setStartDoneCount(saved.doneCount);
          setSolved(saved.doneCount);
          setLoading(false);
          return;
        }
```

And replace the "new pick" lines right after it:

```ts
        setExercises(picked);
        setStartIndex(0);
        setStartAnswer(null);
        setStartDoneCount(0);
        saveSession(key, { items: picked, index: 0, currentAnswer: null, doneCount: 0 });
```

Replace `handleFinish` (add `clearSession` right before `setFinished`):

```ts
  /** Oturum bitti: puanı sunucuya yaz, sonuç ekranını hazırla. */
  async function handleFinish(r: { correct: number; total: number }) {
    const localScore = scorePercent(r.correct, r.total);
    const before = scores?.[stepId]?.[modeKey] ?? 0;

    const saved = await submitPracticeResult(stepId, modeKey, r.correct, r.total);
    const score = saved?.score ?? localScore;

    // Kilit YALNIZCA sunucuya yazılabildiyse açılmış sayılır — aksi halde
    // öğrenciye açıldı deyip yenilemede kapalı bulmasına yol açardık.
    const opened = saved !== null && before < UNLOCK_THRESHOLD && score >= UNLOCK_THRESHOLD;
    setUnlockedNow(opened ? unlockedLabel(modeKey) : null);

    if (saved !== null) {
      setScores((prev) => ({
        ...(prev ?? {}),
        [stepId]: { ...(prev?.[stepId] ?? {}), [modeKey]: saved.best_score },
      }));
    }
    // Madde 7: oturum bitti — kayıt silinir, bir dahaki girişte taze bir set
    // hazırlanır (aksi halde bitmiş setin SON sorusuyla karşılaşılıyordu).
    clearSession(sessionKey(stepId, slug));
    setFinished({ correct: r.correct, total: r.total, score });
  }
```

Replace `handleRetry`'s reset lines (add the two new state resets):

```ts
  function handleRetry() {
    setFinished(null);
    setUnlockedNow(null);
    setSolved(0);
    setLeft(TIMED_SECONDS);
    setTimeUp(false);
    setRunId((n) => n + 1);
    // Yeni tur: saklanan oturum silinir, sporcu 1. sorudan baslar.
    clearSession(sessionKey(stepId, slug));
    setStartIndex(0);
    setStartAnswer(null);
    setStartDoneCount(0);
  }
```

Finally, replace the `<BoardExercise .../>` call site (madde 6 — `noRetry`
artık üç modda da koşulsuz `true`, ve yeni kalıcılık prop'ları):

```tsx
          <BoardExercise
            key={runId}
            exercises={exercises}
            done={false}
            onCorrect={() => setSolved((s) => Math.min(s + 1, exercises.length))}
            onFinish={handleFinish}
            /* Madde 6: üç modda da (Süresiz/Süreli/Test) yanlış cevaptan
               sonra tekrar deneme YOK; sporcu "Sonraki Soruya Geç" ile ilerler. */
            noRetry
            initialIndex={startIndex}
            initialAnswer={startAnswer}
            initialDoneCount={startDoneCount}
            onIndexChange={(i) => {
              if (exercises) saveSession(sessionKey(stepId, slug), {
                items: exercises, index: i, currentAnswer: null, doneCount: solved,
              });
            }}
            onAnswered={(index, doneCount, answer) => {
              if (exercises) saveSession(sessionKey(stepId, slug), {
                items: exercises, index, currentAnswer: answer, doneCount,
              });
            }}
          />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pratik-page-persistence.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add app/\(child\)/pratik/\[mode\]/page.tsx tests/pratik-page-persistence.test.tsx
git commit -m "fix: pratik sayfasi - 3 modda noRetry + kalicilik + oturum bitince temizleme (madde 6/7)"
```

---

### Task 14: Tam test kapısı

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: apps/web tam kapı**

Run (from `apps/web`):
```bash
npx tsc --noEmit
npx next lint
npx vitest run
```
Expected: tsc 0 hata; lint sadece mevcut pre-existing uyarılar; vitest tüm
dosyalar PASS.

- [ ] **Step 2: apps/api tam kapı**

Run (from `apps/api`):
```bash
python -m pytest -q
```
Expected: tüm testler PASS.

- [ ] **Step 3: Build**

Run (from `apps/web`):
```bash
npm run build
```
Expected: başarılı, hata yok.

---

### Task 15: Canlı doğrulama (KURAL #6) — madde 1, 2 dahil hepsi

**Files:** yok

- [ ] **Step 1: Dev sunucularını başlat, admin panelinde giriş yap**

- [ ] **Step 2: Madde 1 doğrulaması**

Bir görsel ekle, ton kaydırıcısını yavaşça sürükle — tahtadaki görselin renk
tonunun ANLIK değiştiğini gözle teyit et. Gecikme varsa kök nedeni bul, düzelt.

- [ ] **Step 3: Madde 2 doğrulaması**

Tüm adımları tamamlayıp "Soruyu ekle"ye bas — sorunun gerçekten eklendiğini
(liste yenilenip yeni sorunun göründüğünü) teyit et. Başarısız olursa kök
nedeni bul, düzelt.

- [ ] **Step 4: Madde 3-5 doğrulaması**

Havuzdan farklı kategorilerden (Hayvanlar + Bitkiler) birkaç görsel seç,
hepsinin sepette biriktiğini ve "Seçilenleri Ekle" ile tahtaya düştüğünü
doğrula. Her görseli ayrı ayrı sürükleyip boyutlandır. Bir görsele "Şeffaf
Yap" uygula, arka planın kaybolduğunu gözle. Başka bir görsele "Vektöre
Çevir" uygula, sonucun SVG çizgilerine dönüştüğünü gözle.

- [ ] **Step 5: Madde 6-7 doğrulaması (sporcu tarafı)**

Süresiz Pratik'te bilerek yanlış cevap ver — "Sonraki Soruya Geç" butonunun
birkaç saniye sonra da ekranda kaldığını doğrula. Sayfayı yenile (F5) —
sorunun hâlâ kilitli/geribildirimli göründüğünü, tekrar çözülemediğini
doğrula. 20 soruyu bitirip sonuçtan ayrılıp (Tekrar Dene'ye basmadan) tekrar
Süresiz Pratik'e gir — YENİ bir 1. sorudan başladığını doğrula (eski davranış:
son soruyla karşılaşma). Süreli ve Kendini Test Et'te de yanlış cevap sonrası
aynı kilit/buton davranışını doğrula.

- [ ] **Step 6: Kullanıcıya rapor**

Ne test edildi, ne gözlemlendi (ekran görüntüleriyle), hangi adımlar otomatik
testlerle hangi adımlar canlı tarayıcıyla doğrulandı — açıkça ayırarak
raporla (KURAL #1).

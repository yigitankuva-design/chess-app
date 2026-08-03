# Tahtaya Çizim Sistemi (C Grubu) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zafer hoca'nın her soru tipinde tahtaya serbest yazı/şekil/renk ekleyip (boyutlandırıp, döndürüp, Ctrl+Z ile geri alıp) kaydedebildiği, sporcu tarafında da görünen bir çizim katmanı kurmak.

**Architecture:** Konum GEREKTİREN tüm soru tiplerinde (Kareye Tıkla, Taşı Oynat, Taş Nerde, Taşa Tıkla) çizim katmanı, konum **kaydedildikten sonraki** salt-okunur önizleme üzerine bindirilir (`SavedPositionBoard` — B grubunda kurulmuştu). Bu, her tipin kendi canlı-düzenleme tahtasının (sürükle-taş-yerleştir vb.) farklı iç yapısına dokunmadan TEK bir entegrasyon noktası sağlar. Cümle Ekle/Görüntü Ekle tiplerinde de aynı şekilde kendi (opsiyonel) tahtalarının üzerine bindirilir. Saf geometri (`lib/chess/paintItems.ts`) mevcut `imagePlacement.ts`'in sürükle/boyutlandır desenini genişletir, üstüne döndürme ekler. Tek bir salt-okunur render bileşeni (`PaintItemView`) hem düzenleme hem sporcu-görünümünde kullanılır.

**Tech Stack:** Next.js 15 + React (apps/web), FastAPI (apps/api), Vitest + Testing Library, pytest.

---

### Task 1: `lib/chess/paintItems.ts` — saf veri modeli ve geometri

**Files:**
- Create: `apps/web/lib/chess/paintItems.ts`
- Test: `apps/web/tests/paint-items.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  PALETTE, SHAPES, newTextItem, newShapeItem, dragItem, resizeItem, rotateItem,
  clampCoord, clampSize, clampFontSize, clampRotation,
} from '@/lib/chess/paintItems';
import type { ShapePaintItem, TextPaintItem } from '@/lib/chess/paintItems';

describe('paintItems — sabitler', () => {
  it('10 renk içerir', () => expect(PALETTE).toHaveLength(10));
  it('6 şekil içerir', () => expect(SHAPES).toHaveLength(6));
});

describe('paintItems — sınırlama fonksiyonları', () => {
  it('koordinat 0-100 arasına sıkıştırılır', () => {
    expect(clampCoord(-5)).toBe(0);
    expect(clampCoord(150)).toBe(100);
    expect(clampCoord(50)).toBe(50);
  });
  it('boyut 2-90 arasına sıkıştırılır', () => {
    expect(clampSize(0)).toBe(2);
    expect(clampSize(200)).toBe(90);
  });
  it('punto 12-72 arasına sıkıştırılır', () => {
    expect(clampFontSize(1)).toBe(12);
    expect(clampFontSize(999)).toBe(72);
  });
  it('döndürme 0-359 arasına normalize edilir', () => {
    expect(clampRotation(-10)).toBe(350);
    expect(clampRotation(370)).toBe(10);
  });
});

describe('paintItems — oluşturma', () => {
  it('newTextItem varsayılan yazı ve punto ile döner', () => {
    const t = newTextItem(50, 50, '#ef4444');
    expect(t.kind).toBe('text');
    expect(t.text).toBe('Yazı');
    expect(t.fontSize).toBe(24);
    expect(t.color).toBe('#ef4444');
    expect(t.id).toBeTruthy();
  });
  it('newShapeItem varsayılan boyutla döner', () => {
    const s = newShapeItem('circle', 30, 40, '#3b82f6');
    expect(s.kind).toBe('shape');
    expect(s.shape).toBe('circle');
    expect(s.w).toBe(15);
    expect(s.h).toBe(15);
  });
  it('iki öğenin id\'si farklıdır', () => {
    const a = newTextItem(0, 0, '#000000');
    const b = newTextItem(0, 0, '#000000');
    expect(a.id).not.toBe(b.id);
  });
});

describe('paintItems — sürükleme/boyutlandırma/döndürme', () => {
  const shape: ShapePaintItem = { id: 'x', kind: 'shape', shape: 'square', x: 50, y: 50, w: 20, h: 20, rotation: 0, color: '#000000' };

  it('dragItem piksel deltasını yüzdeye çevirip merkeze ekler', () => {
    const next = dragItem(shape, 50, 0, 200, 200); // %25 sağa
    expect(next.x).toBe(75);
    expect(next.y).toBe(50);
  });
  it('resizeItem genişlik/yüksekliği büyütür', () => {
    const next = resizeItem(shape, 20, 20, 200, 200) as ShapePaintItem;
    expect(next.w).toBeGreaterThan(20);
    expect(next.h).toBeGreaterThan(20);
  });
  it('rotateItem işaretçi konumuna göre açı hesaplar', () => {
    // Merkez (100,100), işaretçi tam sağda (150,100) -> üstten başlayan açı sistemine göre 90°
    const next = rotateItem(shape, 100, 100, 150, 100);
    expect(next.rotation).toBeCloseTo(90, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/web`): `npx vitest run tests/paint-items.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

`apps/web/lib/chess/paintItems.ts`:

```ts
export type ShapeKind = 'circle' | 'square' | 'rectangle' | 'star' | 'arrow' | 'question';

export interface PaintItemBase {
  id: string;
  x: number;
  y: number;
  rotation: number;
  color: string;
}
export interface TextPaintItem extends PaintItemBase {
  kind: 'text';
  text: string;
  fontSize: number;
}
export interface ShapePaintItem extends PaintItemBase {
  kind: 'shape';
  shape: ShapeKind;
  w: number;
  h: number;
}
export type PaintItem = TextPaintItem | ShapePaintItem;

export const PALETTE: { name: string; color: string }[] = [
  { name: 'Siyah', color: '#000000' },
  { name: 'Beyaz', color: '#ffffff' },
  { name: 'Kırmızı', color: '#ef4444' },
  { name: 'Mavi', color: '#3b82f6' },
  { name: 'Yeşil', color: '#22c55e' },
  { name: 'Mor', color: '#a855f7' },
  { name: 'Turuncu', color: '#f97316' },
  { name: 'Turkuaz', color: '#14b8a6' },
  { name: 'Kahverengi', color: '#92400e' },
  { name: 'Sarı', color: '#eab308' },
];

export const SHAPES: { shape: ShapeKind; label: string }[] = [
  { shape: 'circle', label: 'Daire' },
  { shape: 'square', label: 'Kare' },
  { shape: 'rectangle', label: 'Dikdörtgen' },
  { shape: 'star', label: 'Yıldız' },
  { shape: 'arrow', label: 'Ok' },
  { shape: 'question', label: 'Soru İşareti' },
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function clampCoord(v: number): number { return clamp(v, 0, 100); }
export function clampSize(v: number): number { return clamp(v, 2, 90); }
export function clampFontSize(v: number): number { return clamp(v, 12, 72); }
export function clampRotation(v: number): number {
  const m = v % 360;
  return m < 0 ? m + 360 : m;
}

let counter = 0;
export function makeId(): string {
  counter += 1;
  return `p${Date.now()}${counter}`;
}

export function newTextItem(x: number, y: number, color: string): TextPaintItem {
  return { id: makeId(), kind: 'text', x: clampCoord(x), y: clampCoord(y), rotation: 0, color, text: 'Yazı', fontSize: 24 };
}

export function newShapeItem(shape: ShapeKind, x: number, y: number, color: string): ShapePaintItem {
  return { id: makeId(), kind: 'shape', shape, x: clampCoord(x), y: clampCoord(y), rotation: 0, color, w: 15, h: 15 };
}

export function dragItem(item: PaintItem, deltaPxX: number, deltaPxY: number, boxPxW: number, boxPxH: number): PaintItem {
  if (boxPxW <= 0 || boxPxH <= 0) return item;
  return { ...item, x: clampCoord(item.x + (deltaPxX / boxPxW) * 100), y: clampCoord(item.y + (deltaPxY / boxPxH) * 100) };
}

export function resizeItem(item: ShapePaintItem, deltaPxX: number, deltaPxY: number, boxPxW: number, boxPxH: number): ShapePaintItem {
  if (boxPxW <= 0 || boxPxH <= 0) return item;
  return {
    ...item,
    w: clampSize(item.w + (deltaPxX / boxPxW) * 100 * 2),
    h: clampSize(item.h + (deltaPxY / boxPxH) * 100 * 2),
  };
}

/** İşaretçinin merkeze göre açısını hesaplar. Tutamaç merkezin ÜSTÜNDE durduğu
 *  için (0° = yukarı), atan2'nin standart "sağ=0°" çıktısına +90° eklenir. */
export function rotateItem(item: PaintItem, centerPxX: number, centerPxY: number, pointerPxX: number, pointerPxY: number): PaintItem {
  const angleRad = Math.atan2(pointerPxY - centerPxY, pointerPxX - centerPxX);
  const deg = (angleRad * 180) / Math.PI + 90;
  return { ...item, rotation: clampRotation(deg) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/paint-items.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/chess/paintItems.ts apps/web/tests/paint-items.test.ts
git commit -m "feat: paintItems saf veri modeli ve geometri"
```

---

### Task 2: `PaintItemView` — tek öğeyi çizen salt-okunur bileşen

**Files:**
- Create: `apps/web/components/PaintItemView.tsx`
- Test: `apps/web/tests/paint-item-view.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PaintItemView } from '@/components/PaintItemView';
import type { TextPaintItem, ShapePaintItem } from '@/lib/chess/paintItems';

const TEXT: TextPaintItem = { id: 't1', kind: 'text', x: 50, y: 50, rotation: 0, color: '#ef4444', text: 'Merhaba', fontSize: 30 };
const CIRCLE: ShapePaintItem = { id: 's1', kind: 'shape', shape: 'circle', x: 20, y: 30, w: 10, h: 10, rotation: 45, color: '#3b82f6' };
const ARROW: ShapePaintItem = { id: 's2', kind: 'shape', shape: 'arrow', x: 40, y: 40, w: 20, h: 10, rotation: 0, color: '#22c55e' };
const QMARK: ShapePaintItem = { id: 's3', kind: 'shape', shape: 'question', x: 60, y: 60, w: 15, h: 15, rotation: 0, color: '#000000' };

describe('PaintItemView', () => {
  it('metin öğesini doğru renk/punto/metinle render eder', () => {
    const { getByTestId } = render(<PaintItemView item={TEXT} />);
    const el = getByTestId('paint-item-t1');
    expect(el.textContent).toBe('Merhaba');
    expect(el.style.color).toBe('rgb(239, 68, 68)');
    expect(el.style.fontSize).toBe('30px');
  });

  it('daire öğesi border-radius ve döndürme uygular', () => {
    const { getByTestId } = render(<PaintItemView item={CIRCLE} />);
    const el = getByTestId('paint-item-s1');
    expect(el.style.borderRadius).toBe('50%');
    expect(el.style.transform).toContain('rotate(45deg)');
  });

  it('ok şekli svg olarak render edilir', () => {
    const { getByTestId } = render(<PaintItemView item={ARROW} />);
    expect(getByTestId('paint-item-s2').tagName).toBe('svg');
  });

  it('soru işareti "?" karakteri render eder', () => {
    const { getByTestId } = render(<PaintItemView item={QMARK} />);
    expect(getByTestId('paint-item-s3').textContent).toBe('?');
  });

  it('onPointerDown verilirse tıklanabilir olur (etkileşimli mod)', () => {
    const onPointerDown = vi.fn();
    const { getByTestId } = render(<PaintItemView item={TEXT} onPointerDown={onPointerDown} />);
    expect(getByTestId('paint-item-t1').style.cursor).toBe('move');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/paint-item-view.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

`apps/web/components/PaintItemView.tsx`:

```tsx
'use client';
import type { CSSProperties, PointerEvent } from 'react';
import type { PaintItem, ShapePaintItem } from '@/lib/chess/paintItems';

interface Props {
  item: PaintItem;
  selected?: boolean;
  onPointerDown?: (e: PointerEvent) => void;
}

function outline(selected?: boolean): CSSProperties {
  return { outline: selected ? '2px dashed #22d3ee' : 'none', outlineOffset: 2 };
}

function shapeBoxStyle(item: ShapePaintItem): CSSProperties {
  return {
    position: 'absolute',
    left: `${item.x}%`,
    top: `${item.y}%`,
    width: `${item.w}%`,
    height: `${item.h}%`,
    transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
  };
}

export function PaintItemView({ item, selected, onPointerDown }: Props) {
  const cursor = onPointerDown ? 'move' : 'default';

  if (item.kind === 'text') {
    return (
      <span
        data-testid={`paint-item-${item.id}`}
        onPointerDown={onPointerDown}
        style={{
          position: 'absolute',
          left: `${item.x}%`,
          top: `${item.y}%`,
          transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
          color: item.color,
          fontSize: item.fontSize,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          cursor,
          ...outline(selected),
        }}
      >
        {item.text}
      </span>
    );
  }

  if (item.shape === 'arrow') {
    return (
      <svg
        data-testid={`paint-item-${item.id}`}
        onPointerDown={onPointerDown}
        style={{ ...shapeBoxStyle(item), cursor, ...outline(selected) }}
        viewBox="0 0 100 100"
        fill={item.color}
      >
        <polygon points="10,55 60,55 60,35 90,50 60,65 60,55" />
      </svg>
    );
  }

  if (item.shape === 'question') {
    return (
      <span
        data-testid={`paint-item-${item.id}`}
        onPointerDown={onPointerDown}
        style={{
          ...shapeBoxStyle(item),
          color: item.color,
          fontWeight: 900,
          fontSize: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor,
          ...outline(selected),
        }}
      >
        ?
      </span>
    );
  }

  if (item.shape === 'star') {
    return (
      <div
        data-testid={`paint-item-${item.id}`}
        onPointerDown={onPointerDown}
        style={{
          ...shapeBoxStyle(item),
          background: item.color,
          clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
          cursor,
          ...outline(selected),
        }}
      />
    );
  }

  // circle / square / rectangle
  return (
    <div
      data-testid={`paint-item-${item.id}`}
      onPointerDown={onPointerDown}
      style={{
        ...shapeBoxStyle(item),
        borderRadius: item.shape === 'circle' ? '50%' : 0,
        border: `3px solid ${item.color}`,
        boxSizing: 'border-box',
        cursor,
        ...outline(selected),
      }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/paint-item-view.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/PaintItemView.tsx apps/web/tests/paint-item-view.test.tsx
git commit -m "feat: PaintItemView salt-okunur çizim öğesi bileşeni"
```

---

### Task 3: `PaintEditor` — etkileşimli düzenleme katmanı

**Files:**
- Create: `apps/web/components/admin/PaintEditor.tsx`
- Test: `apps/web/tests/paint-editor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaintEditor } from '@/components/admin/PaintEditor';

function setup(items: import('@/lib/chess/paintItems').PaintItem[] = []) {
  const onChange = vi.fn();
  const utils = render(
    <PaintEditor items={items} onChange={onChange}>
      <div style={{ width: 200, height: 200 }} data-testid="board-placeholder" />
    </PaintEditor>,
  );
  return { ...utils, onChange };
}

describe('PaintEditor', () => {
  it('araç panelinde yazı, 6 şekil ve 10 renk butonu vardır', () => {
    setup();
    expect(screen.getByText('Yazı')).toBeInTheDocument();
    expect(screen.getByText('Daire')).toBeInTheDocument();
    expect(screen.getByText('Ok')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Siyah|Beyaz|Kırmızı|Mavi|Yeşil|Mor|Turuncu|Turkuaz|Kahverengi|Sarı/ })).toHaveLength(10);
  });

  it('araç seçip tahtaya tıklayınca yeni öğe eklenir', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByText('Daire'));
    fireEvent.pointerDown(screen.getByTestId('paint-board-box'), { clientX: 50, clientY: 50 });
    expect(onChange).toHaveBeenCalled();
    const added = onChange.mock.calls[0][0];
    expect(added).toHaveLength(1);
    expect(added[0].kind).toBe('shape');
    expect(added[0].shape).toBe('circle');
  });

  it('araç seçili değilken tahtaya tıklamak öğe eklemez', () => {
    const { onChange } = setup();
    fireEvent.pointerDown(screen.getByTestId('paint-board-box'), { clientX: 50, clientY: 50 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('seçili öğe için Sil butonu öğeyi kaldırır', () => {
    const item = { id: 'x1', kind: 'shape' as const, shape: 'circle' as const, x: 50, y: 50, w: 15, h: 15, rotation: 0, color: '#000000' };
    const { onChange } = setup([item]);
    fireEvent.pointerDown(screen.getByTestId('paint-item-x1'));
    fireEvent.click(screen.getByText('Sil'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('Ctrl+Z bir önceki duruma döner', () => {
    const item = { id: 'x1', kind: 'shape' as const, shape: 'circle' as const, x: 50, y: 50, w: 15, h: 15, rotation: 0, color: '#000000' };
    const { onChange, container } = setup([item]);
    fireEvent.pointerDown(screen.getByTestId('paint-item-x1'));
    fireEvent.click(screen.getByText('Sil')); // history'ye [item] pushlanır, items=[] olur
    fireEvent.keyDown(container.firstChild as Element, { key: 'z', ctrlKey: true });
    expect(onChange).toHaveBeenLastCalledWith([item]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/paint-editor.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

`apps/web/components/admin/PaintEditor.tsx`:

```tsx
'use client';
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { PaintItemView } from '@/components/PaintItemView';
import {
  PALETTE, SHAPES, newTextItem, newShapeItem, dragItem, resizeItem, rotateItem,
} from '@/lib/chess/paintItems';
import type { PaintItem, ShapeKind } from '@/lib/chess/paintItems';

interface Props {
  items: PaintItem[];
  onChange: (items: PaintItem[]) => void;
  children: ReactNode;
}

type Tool = { kind: 'text' } | { kind: 'shape'; shape: ShapeKind } | null;
type DragMode = 'move' | 'resize' | 'rotate' | null;

export function PaintEditor({ items, onChange, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; item: PaintItem } | null>(null);
  const history = useRef<PaintItem[][]>([]);
  const [tool, setTool] = useState<Tool>(null);
  const [color, setColor] = useState(PALETTE[0].color);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<DragMode>(null);

  function pushHistory() {
    history.current = [...history.current, items].slice(-20);
  }

  function undo() {
    const prev = history.current.pop();
    if (prev) onChange(prev);
  }

  function onBoxPointerDown(e: ReactPointerEvent) {
    if (mode) return; // öğe sürükleme zaten kendi handler'ında yönetiliyor
    if (!tool || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    pushHistory();
    const item = tool.kind === 'text' ? newTextItem(x, y, color) : newShapeItem(tool.shape, x, y, color);
    onChange([...items, item]);
    setSelected(item.id);
    setTool(null);
  }

  function startDrag(e: ReactPointerEvent, id: string, m: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    const item = items.find((it) => it.id === id);
    if (!item) return;
    pushHistory();
    setSelected(id);
    dragStart.current = { x: e.clientX, y: e.clientY, item };
    setMode(m);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!mode || !selected || !dragStart.current || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const start = dragStart.current.item;
    let next: PaintItem = start;
    if (mode === 'move') {
      next = dragItem(start, e.clientX - dragStart.current.x, e.clientY - dragStart.current.y, rect.width, rect.height);
    } else if (mode === 'resize' && start.kind === 'shape') {
      next = resizeItem(start, e.clientX - dragStart.current.x, e.clientY - dragStart.current.y, rect.width, rect.height);
    } else if (mode === 'rotate') {
      const centerPxX = rect.left + (start.x / 100) * rect.width;
      const centerPxY = rect.top + (start.y / 100) * rect.height;
      next = rotateItem(start, centerPxX, centerPxY, e.clientX, e.clientY);
    }
    onChange(items.map((it) => (it.id === selected ? next : it)));
  }

  function endDrag() {
    setMode(null);
    dragStart.current = null;
  }

  function removeSelected() {
    if (!selected) return;
    pushHistory();
    onChange(items.filter((it) => it.id !== selected));
    setSelected(null);
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  }

  const sel = items.find((it) => it.id === selected) ?? null;

  return (
    <div className="flex gap-3" onKeyDown={onKeyDown} tabIndex={0}>
      <div
        ref={boxRef}
        data-testid="paint-board-box"
        onPointerDown={onBoxPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ position: 'relative', maxWidth: 240 }}
      >
        {children}
        {items.map((item) => (
          <PaintItemView key={item.id} item={item} selected={item.id === selected}
            onPointerDown={(e) => startDrag(e, item.id, 'move')} />
        ))}
        {sel && sel.kind === 'shape' && (
          <div role="button" aria-label="Boyutlandır" onPointerDown={(e) => startDrag(e, sel.id, 'resize')}
            style={{
              position: 'absolute', left: `${sel.x + sel.w / 2}%`, top: `${sel.y + sel.h / 2}%`,
              width: 14, height: 14, transform: 'translate(-50%,-50%)',
              background: '#22d3ee', borderRadius: 4, border: '2px solid white',
            }} />
        )}
        {sel && (
          <div role="button" aria-label="Döndür" onPointerDown={(e) => startDrag(e, sel.id, 'rotate')}
            style={{
              position: 'absolute', left: `${sel.x}%`, top: `${Math.max(sel.y - 15, 2)}%`,
              width: 12, height: 12, transform: 'translate(-50%,-50%)',
              background: '#facc15', borderRadius: '50%', border: '2px solid white',
            }} />
        )}
      </div>
      <div className="space-y-2" style={{ minWidth: 140 }}>
        <p className="text-xs n-muted">Yazı-Şekil-Renk Ekle (opsiyonel)</p>
        <button type="button" onClick={() => setTool({ kind: 'text' })}
          className={`px-2 py-1 rounded text-xs border block ${tool?.kind === 'text' ? 'border-cyan-400 text-cyan-200' : 'border-white/15 text-white/70'}`}>
          Yazı
        </button>
        <div className="flex flex-wrap gap-1">
          {SHAPES.map((s) => (
            <button key={s.shape} type="button" onClick={() => setTool({ kind: 'shape', shape: s.shape })}
              className={`px-2 py-1 rounded text-xs border ${tool?.kind === 'shape' && tool.shape === s.shape ? 'border-cyan-400 text-cyan-200' : 'border-white/15 text-white/70'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {PALETTE.map((p) => (
            <button key={p.color} type="button" aria-label={p.name} onClick={() => setColor(p.color)}
              style={{ width: 20, height: 20, background: p.color, border: color === p.color ? '2px solid #22d3ee' : '1px solid #ffffff40', borderRadius: 4 }} />
          ))}
        </div>
        {sel && (
          <div className="space-y-1">
            {sel.kind === 'text' && (
              <>
                <input value={sel.text} aria-label="Yazı metni"
                  onChange={(e) => onChange(items.map((it) => (it.id === sel.id ? { ...it, text: e.target.value } : it)))}
                  className="neon-input text-xs" />
                <input type="range" min={12} max={72} value={sel.fontSize} aria-label="Punto"
                  onChange={(e) => onChange(items.map((it) => (it.id === sel.id ? { ...it, fontSize: Number(e.target.value) } : it)))} />
              </>
            )}
            <button type="button" onClick={removeSelected}
              className="px-2 py-1 rounded text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40">
              Sil
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/paint-editor.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/PaintEditor.tsx apps/web/tests/paint-editor.test.tsx
git commit -m "feat: PaintEditor etkileşimli çizim katmanı"
```

---

### Task 4: "Yazı-Şekil-Renk Ekle" adımı — 4 dosya, 5 fonksiyon

**Files:**
- Modify: `apps/web/lib/admin/movePieceSteps.ts`
- Modify: `apps/web/lib/admin/clickPieceSteps.ts`
- Modify: `apps/web/lib/admin/placePiecesSteps.ts`
- Modify: `apps/web/lib/admin/questionSteps.ts`
- Test: `apps/web/tests/click-piece-steps.test.ts`, `apps/web/tests/question-steps.test.ts` (mevcut dosyalara eklenir), yeni: `apps/web/tests/move-piece-steps-paint.test.ts`, `apps/web/tests/place-pieces-steps-paint.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/tests/move-piece-steps-paint.test.ts` (yeni):

```ts
import { describe, it, expect } from 'vitest';
import { movePieceSteps, MOVE_PIECE_STEP_LABELS } from '@/lib/admin/movePieceSteps';
import type { MovePieceStepState } from '@/lib/admin/movePieceSteps';

const EMPTY_STATE: MovePieceStepState = {
  instruction: '', setupFen: '8/8/8/8/8/8/8/8 w - - 0 1', turnChosen: false,
  moveFen: null, moves: [], notationSaved: false, difficultyChosen: false,
};

describe('movePieceSteps — Yazı-Şekil-Renk Ekle adımı', () => {
  it('adım listesinde "Yazı-Şekil-Renk Ekle" bulunur, Soruyu Ekle\'den ÖNCE gelir', () => {
    expect(MOVE_PIECE_STEP_LABELS).toContain('Yazı-Şekil-Renk Ekle');
    const paintIdx = MOVE_PIECE_STEP_LABELS.indexOf('Yazı-Şekil-Renk Ekle');
    const addIdx = MOVE_PIECE_STEP_LABELS.indexOf('Soruyu Ekle');
    expect(paintIdx).toBeLessThan(addIdx);
  });

  it('opsiyonel — hiçbir şey eklenmese de adım done sayılır', () => {
    const steps = movePieceSteps(EMPTY_STATE);
    const paintStep = steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle');
    expect(paintStep?.done).toBe(true);
  });
});
```

`apps/web/tests/place-pieces-steps-paint.test.ts` (yeni) — aynı desen:

```ts
import { describe, it, expect } from 'vitest';
import { placePiecesSteps, PLACE_PIECES_STEP_LABELS } from '@/lib/admin/placePiecesSteps';
import type { PlacePiecesStepState } from '@/lib/admin/placePiecesSteps';

const EMPTY_STATE: PlacePiecesStepState = {
  instruction: '', setupFen: '8/8/8/8/8/8/8/8 w - - 0 1', savedFen: null,
  selectedPiece: null, pieces: [], answerSaved: false, turnChosen: false, difficultyChosen: false,
};

describe('placePiecesSteps — Yazı-Şekil-Renk Ekle adımı', () => {
  it('adım listesinde bulunur ve opsiyoneldir', () => {
    expect(PLACE_PIECES_STEP_LABELS).toContain('Yazı-Şekil-Renk Ekle');
    const steps = placePiecesSteps(EMPTY_STATE);
    expect(steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle')?.done).toBe(true);
  });
});
```

Mevcut `apps/web/tests/click-piece-steps.test.ts` dosyasına ekle:

```ts
it('Yazı-Şekil-Renk Ekle adımı bulunur ve opsiyoneldir', () => {
  const steps = clickPieceSteps({
    instruction: '', setupFen: '8/8/8/8/8/8/8/8 w - - 0 1', savedFen: null,
    pieceSquares: [], answerSaved: false, turnChosen: false, difficultyChosen: false,
  });
  expect(steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle')?.done).toBe(true);
});
```

Mevcut `apps/web/tests/question-steps.test.ts` dosyasına ekle:

```ts
it('choiceSteps: Yazı-Şekil-Renk Ekle adımı bulunur ve opsiyoneldir', () => {
  const steps = choiceSteps({
    instruction: '', promptImage: '', optionCountChosen: false, answerKindChosen: false,
    options: [], answerKind: 'sentence', difficultyChosen: false,
  }, 'sentence_question');
  expect(steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle')?.done).toBe(true);
});

it('clickSquareSteps: Yazı-Şekil-Renk Ekle adımı bulunur ve opsiyoneldir', () => {
  const steps = clickSquareSteps({
    instruction: '', setupFen: '8/8/8/8/8/8/8/8 w - - 0 1', turnChosen: false,
    savedFen: null, targets: [], clickModeChosen: false, difficultyChosen: false,
  });
  expect(steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle')?.done).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/move-piece-steps-paint.test.ts tests/place-pieces-steps-paint.test.ts tests/click-piece-steps.test.ts tests/question-steps.test.ts`
Expected: FAIL — "Yazı-Şekil-Renk Ekle" hiçbir listede yok

- [ ] **Step 3: Write minimal implementation**

`movePieceSteps.ts`'te `MOVE_PIECE_STEP_LABELS`'ı değiştir:

```ts
export const MOVE_PIECE_STEP_LABELS = [
  'Talimatı Gir',
  'Konum Diz',
  'Hamle Sırasını Belirle',
  'Konumu Kaydet',
  'Cevap Hamlelerini Yap ve Notasyon Oluştur',
  'Notasyonu Kaydet',
  'Zorluk Düzeyini Belirle',
  'Yazı-Şekil-Renk Ekle',
  'Soruyu Ekle',
] as const;
```

`movePieceSteps()` fonksiyonundaki `done` dizisine, `difficultyChosen`'dan sonra `true` ekle:

```ts
export function movePieceSteps(s: MovePieceStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    hasPieces(s.setupFen),
    s.turnChosen,
    s.moveFen !== null,
    s.moves.length > 0,
    s.notationSaved,
    s.difficultyChosen,
    true, // Yazı-Şekil-Renk Ekle — opsiyonel, hiçbir zaman kilitlemez
  ];
  const all = [...done, done.every(Boolean)];
  return MOVE_PIECE_STEP_LABELS.map((label, i) => ({ no: i + 1, label, done: all[i] }));
}
```

`clickPieceSteps.ts`'te `CLICK_PIECE_STEP_LABELS`'a ekle:

```ts
export const CLICK_PIECE_STEP_LABELS = [
  'Talimatı Gir',
  'Konumu Diz',
  'Konumu Kaydet',
  'Cevap Taşlarını Seç',
  'Taş Seçimini Kaydet',
  'Hamle Sırasını Belirle',
  'Zorluk Düzeyini Belirle',
  'Yazı-Şekil-Renk Ekle',
] as const;
```

`clickPieceSteps()`'teki `done` dizisine ekle:

```ts
export function clickPieceSteps(s: ClickPieceStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    hasPieces(s.setupFen) || s.savedFen !== null,
    s.savedFen !== null,
    s.pieceSquares.length > 0,
    s.answerSaved,
    s.turnChosen,
    s.difficultyChosen,
    true, // Yazı-Şekil-Renk Ekle
  ];
  const all = [...done, done.every(Boolean)];
  return [...CLICK_PIECE_STEP_LABELS, 'Soruyu Ekle'].map((label, i) => ({
    no: i + 1, label, done: all[i],
  }));
}
```

`placePiecesSteps.ts`'te aynı desen — `PLACE_PIECES_STEP_LABELS`'a ekle:

```ts
export const PLACE_PIECES_STEP_LABELS = [
  'Talimatı Gir',
  'Konumu Diz',
  'Konumu Kaydet',
  'Konuma Eklenecek Taşları Belirle',
  'Taşların Doğru Karelerini Belirle',
  'Cevabı Kaydet',
  'Hamle Sırasını Belirle',
  'Zorluk Düzeyini Belirle',
  'Yazı-Şekil-Renk Ekle',
] as const;
```

`placePiecesSteps()`'teki `done` dizisine ekle:

```ts
export function placePiecesSteps(s: PlacePiecesStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    hasPieces(s.setupFen) || s.savedFen !== null,
    s.savedFen !== null,
    s.selectedPiece !== null || s.pieces.length > 0,
    s.pieces.length > 0,
    s.answerSaved,
    s.turnChosen,
    s.difficultyChosen,
    true, // Yazı-Şekil-Renk Ekle
  ];
  const all = [...done, done.every(Boolean)];
  return [...PLACE_PIECES_STEP_LABELS, 'Soruyu Ekle'].map((label, i) => ({
    no: i + 1, label, done: all[i],
  }));
}
```

`questionSteps.ts`'teki `choiceSteps` ve `clickSquareSteps` fonksiyonlarındaki `base` dizisine, son elemandan sonra (difficulty'den sonra, `unshift`'ten önce fark etmez — sona eklenir) ekle:

```ts
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
    ['Yazı-Şekil-Renk Ekle', true],
  ];
  if (kind === 'image_question') {
    base.unshift(['Soru Görseli Seç', s.promptImage.length > 0]);
  }
  return withFinal(base.map(([l]) => l), base.map(([, d]) => d));
}

export function clickSquareSteps(s: ClickSquareStepState): StepInfo[] {
  const base: [string, boolean][] = [
    ['Talimatı Gir', s.instruction.trim().length > 0],
    ['Konum Diz', hasPieces(s.setupFen) || s.savedFen !== null],
    ['Hamle Sırasını Belirle', s.turnChosen],
    ['Konumu Kaydet', s.savedFen !== null],
    ['Doğru Kare(leri) Seç', s.targets.length > 0],
    ['Sporcu Tıklama Sayısını Belirle', s.clickModeChosen],
    ['Zorluk Düzeyini Belirle', s.difficultyChosen],
    ['Yazı-Şekil-Renk Ekle', true],
  ];
  return withFinal(base.map(([l]) => l), base.map(([, d]) => d));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/move-piece-steps-paint.test.ts tests/place-pieces-steps-paint.test.ts tests/click-piece-steps.test.ts tests/question-steps.test.ts`
Expected: PASS (tüm testler)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin/movePieceSteps.ts apps/web/lib/admin/clickPieceSteps.ts apps/web/lib/admin/placePiecesSteps.ts apps/web/lib/admin/questionSteps.ts apps/web/tests/move-piece-steps-paint.test.ts apps/web/tests/place-pieces-steps-paint.test.ts apps/web/tests/click-piece-steps.test.ts apps/web/tests/question-steps.test.ts
git commit -m "feat: tüm soru tiplerine opsiyonel Yazı-Şekil-Renk Ekle adımı"
```

---

### Task 5: `ExerciseForm.tsx` — tahta-tipi sorularda çizim entegrasyonu

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx`
- Test: `apps/web/tests/exercise-form-paint.test.tsx` (yeni)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — çizim entegrasyonu (C grubu)', () => {
  it('click_square: konum kaydedilince "Yazı-Şekil-Renk Ekle" araç paneli görünür', async () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kareye tıkla' }));
    // Palet taşına tıkla, kareye koy, kaydet (BoardEditor tıkla-ekle deseni)
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    await waitFor(() => expect(screen.getByText('Yazı-Şekil-Renk Ekle (opsiyonel)')).toBeInTheDocument());
  });

  it('click_square: eklenen çizim öğesi submit\'te annotations alanında gönderilir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExerciseForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kareye tıkla' }));
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    await waitFor(() => screen.getByText('Yazı-Şekil-Renk Ekle (opsiyonel)'));

    fireEvent.click(screen.getByText('Daire'));
    fireEvent.pointerDown(screen.getByTestId('paint-board-box'), { clientX: 50, clientY: 50 });

    fireEvent.change(screen.getByPlaceholderText("Talimat (örn. Piyonu e4'e taşı)"), { target: { value: 'x' } });
    fireEvent.click(screen.getByText(/^e4$/));
    fireEvent.click(screen.getByText('Tek Kareye Tıklaması Yeterli'));
    fireEvent.click(screen.getByText('Kolay'));
    fireEvent.click(screen.getByText('Soruyu ekle'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.annotations).toHaveLength(1);
    expect(sent.annotations[0].kind).toBe('shape');
  });
});
```

Doğrulanan gerçek metinler: talimat placeholder'ı `ExerciseForm.tsx:367`'den, "Konumu Kaydet"/"Tek Kareye Tıklaması Yeterli" butonları `ExerciseForm.tsx:384/409`'dan alınmıştır.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/exercise-form-paint.test.tsx`
Expected: FAIL — "Yazı-Şekil-Renk Ekle (opsiyonel)" hiçbir yerde yok

- [ ] **Step 3: Write minimal implementation**

`ExerciseForm.tsx` başına import ekle:

```ts
import { PaintEditor } from './PaintEditor';
import { SavedPositionBoard } from './SavedPositionBoard';
import type { PaintItem } from '@/lib/chess/paintItems';
```

`BoardExercise` arayüzüne ekle:

```ts
  /** Tahtaya eklenen serbest yazı/şekil/renk öğeleri (C grubu, opsiyonel). */
  annotations?: PaintItem[];
```

Component state'ine ekle (diğer `useState`'lerin yanına):

```ts
const [annotations, setAnnotations] = useState<PaintItem[]>(initial?.annotations ?? []);
```

`ExerciseForm.tsx:404`'te click_square tipi için **zaten** kilitli konumu gösteren
bir `SavedPositionBoard` var (`{savedFen && <SavedPositionBoard fen={savedFen} marked={targets} />}`,
`SquarePicker`'ın yanında, satır 402-405 arası flex satırın içinde). Bu satırı
değiştir:

```tsx
{savedFen && (
  <PaintEditor items={annotations} onChange={setAnnotations}>
    <SavedPositionBoard fen={savedFen} marked={targets} />
  </PaintEditor>
)}
```

`move_piece`, `place_pieces`, `click_piece` tipleri kendi kilitli-konum
gösterimini SIRASIYLA `MovePieceFields.tsx`, `PlacePiecesFields.tsx` ve
`ExerciseForm.tsx` içinde (click_piece de click_square gibi doğrudan
`ExerciseForm.tsx`'te render ediliyor — satır 474 civarı) ayrı ayrı yapıyor.
Bu üç yer için: önce ilgili dosyada "kilitli/kaydedilmiş konum" gösteren
`SavedPositionBoard` (veya eşdeğeri salt-okunur tahta) render satırı bulunur,
aynı `{savedFen && (<PaintEditor>...</PaintEditor>)}` sarmalama deseni oraya
uygulanır. `MovePieceFields`/`PlacePiecesFields` bu değişiklik için yeni bir
prop çifti alır: `annotations: PaintItem[]` ve `onAnnotationsChange: (items: PaintItem[]) => void`
— `ExerciseForm.tsx`'teki `annotations`/`setAnnotations` state'i bu prop'larla
alt bileşenlere geçirilir.

`submit()` fonksiyonundaki `base` objesine ekle (mevcut `if (initial?.code) base.code = ...` satırının yanına):

```ts
if (annotations.length > 0) base.annotations = annotations;
```

Submit sonrası reset bloğuna ekle:

```ts
setAnnotations([]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/exercise-form-paint.test.tsx`
Expected: PASS (2 test) — test yazılırken gerçek buton/placeholder metinleri
`exercise-form-click-square-steps.test.tsx`'ten doğrulanıp gerekirse düzeltilir.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/ExerciseForm.tsx apps/web/tests/exercise-form-paint.test.tsx
git commit -m "feat: ExerciseForm'da tahta tiplerine çizim entegrasyonu"
```

---

### Task 6: `ChoiceExerciseFields.tsx` — Cümle Ekle/Görüntü Ekle'de çizim entegrasyonu

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Modify: `apps/web/components/admin/ExerciseForm.tsx` (`ChoiceDraft` arayüzü)
- Test: `apps/web/tests/choice-exercise-fields.test.tsx` (mevcut dosyaya eklenir)

- [ ] **Step 1: Write the failing test**

`choice-exercise-fields.test.tsx`'e ekle:

```tsx
it('sentence_question: tahta kurulunca çizim paneli görünür ve submit\'te annotations gider', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);

  fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Hangi kare?' } });
  fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
  fireEvent.click(document.querySelector('[data-square="e4"]')!);

  expect(screen.getByText('Yazı-Şekil-Renk Ekle (opsiyonel)')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Yıldız'));
  fireEvent.pointerDown(screen.getByTestId('paint-board-box'), { clientX: 40, clientY: 40 });

  const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
  fireEvent.change(optionInputs[0], { target: { value: 'A' } });
  fireEvent.change(optionInputs[1], { target: { value: 'B' } });
  fireEvent.click(screen.getByText('2 seçenek'));
  fireEvent.click(screen.getByText('Cümle'));
  fireEvent.click(screen.getByText('Kolay'));
  fireEvent.click(screen.getByText('Soruyu ekle'));

  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  const sent = onSubmit.mock.calls[0][0];
  expect(sent.annotations).toHaveLength(1);
  expect(sent.annotations[0].shape).toBe('star');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-exercise-fields.test.tsx`
Expected: FAIL — "Yazı-Şekil-Renk Ekle (opsiyonel)" ekranda yok

- [ ] **Step 3: Write minimal implementation**

`ExerciseForm.tsx`'teki `ChoiceDraft` arayüzüne ekle:

```ts
  annotations: PaintItem[];
```

`ChoiceExerciseFields.tsx` başına import ekle:

```ts
import { PaintEditor } from './PaintEditor';
import type { PaintItem } from '@/lib/chess/paintItems';
```

State ekle (`sentenceShowBoard` state'inin yanına):

```ts
const [annotations, setAnnotations] = useState<PaintItem[]>(draft?.annotations ?? initial?.annotations ?? []);
```

`onDraftChange` `useEffect`'ine `annotations` ekle (hem obje hem dependency array).

Sentence tahtasının (Task 9, A grubunda kurulan `BoardEditor` bloğu) hemen altına, tahta kurulmuşsa (`sentenceFen !== EMPTY_FEN`) çizim katmanını ekle:

```tsx
{sentenceFen !== EMPTY_FEN && (
  <PaintEditor items={annotations} onChange={setAnnotations}>
    <div style={{ width: 240 }}>{/* BoardEditor zaten üstte render ediliyor; PaintEditor onun ÜZERİNE değil, ALTINDA salt-okunur bir önizlemeye biner */}</div>
  </PaintEditor>
)}
```

Netleştirme: `PaintEditor`'ün `children`'ı GERÇEK etkileşimli `BoardEditor` değil, salt-okunur bir önizleme olmalı (yoksa çizim tıklamaları taş sürüklemeyle karışır). Bu yüzden yukarıdaki blok `SavedPositionBoard` kullanır:

```tsx
import { SavedPositionBoard } from './SavedPositionBoard';
...
{sentenceFen !== EMPTY_FEN && (
  <PaintEditor items={annotations} onChange={setAnnotations}>
    <SavedPositionBoard fen={sentenceFen} marked={[]} />
  </PaintEditor>
)}
```

Image_question tipi için de aynı deseni, mevcut boş-tahta (`MultiImagePlacer` içindeki `EmptyBoardGrid`) render bloğunun ALTINA ekle:

```tsx
<PaintEditor items={annotations} onChange={setAnnotations}>
  <div style={{ width: 240, aspectRatio: '1/1', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
</PaintEditor>
```

`submit()`'teki `base` objesine ekle:

```ts
if (annotations.length > 0) base.annotations = annotations;
```

Reset bloğuna `setAnnotations([]);` ekle.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/choice-exercise-fields.test.tsx`
Expected: PASS (tüm testler)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/ChoiceExerciseFields.tsx apps/web/components/admin/ExerciseForm.tsx apps/web/tests/choice-exercise-fields.test.tsx
git commit -m "feat: Cümle/Görüntü Ekle'de çizim entegrasyonu"
```

---

### Task 7: Sporcu tarafı — tahta tiplerinde çizim gösterimi

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx`
- Test: `apps/web/tests/board-exercise-paint.test.tsx` (yeni)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { ClickSquareEx } from '@/components/lesson-steps/BoardExercise';

const BASE: ClickSquareEx = {
  type: 'click_square', instruction: 'e4', fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1',
  target_squares: ['e4'],
};

describe('BoardExercise — çizim gösterimi (C grubu)', () => {
  it('annotations yoksa hiçbir çizim öğesi render edilmez (geriye dönük uyumluluk)', () => {
    const { container } = render(<BoardExercise exercise={BASE} onCorrect={() => {}} onWrong={() => {}} />);
    expect(container.querySelector('[data-testid^="paint-item-"]')).not.toBeInTheDocument();
  });

  it('annotations doluysa öğeler salt-okunur render edilir', () => {
    const ex: ClickSquareEx = {
      ...BASE,
      annotations: [{ id: 'a1', kind: 'text', x: 50, y: 50, rotation: 0, color: '#ef4444', text: 'Buraya bak', fontSize: 20 }],
    };
    const { getByTestId } = render(<BoardExercise exercise={ex} onCorrect={() => {}} onWrong={() => {}} />);
    expect(getByTestId('paint-item-a1').textContent).toBe('Buraya bak');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/board-exercise-paint.test.tsx`
Expected: FAIL — `ClickSquareEx`'te `annotations` yok (tip hatası), ikinci test öğeyi bulamaz

- [ ] **Step 3: Write minimal implementation**

`BoardExercise.tsx`'teki HER tahta-tipi arayüzüne (`ClickSquareEx`, `MovePieceEx`, `PlacePiecesEx`, `ClickPieceEx` — dördü de) aynı opsiyonel alanı ekle:

```ts
  /** Tahtaya eklenen serbest yazı/şekil/renk öğeleri (C grubu, opsiyonel). */
  annotations?: PaintItem[];
```

Dosya başına import ekle:

```ts
import { PaintItemView } from '@/components/PaintItemView';
import type { PaintItem } from '@/lib/chess/paintItems';
```

Tahtanın render edildiği ana `<div>` sarmalayıcısının (Chessboard'ı içeren, `position: relative` olan kapsayıcı) içine, mevcut kare-stili render'ının hemen ALTINA ekle:

```tsx
{isBoardExercise(exercise) && exercise.annotations?.map((item) => (
  <PaintItemView key={item.id} item={item} />
))}
```

(`onPointerDown` VERİLMEZ — salt-okunur, sporcu çizimi taşıyamaz/silemez.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/board-exercise-paint.test.tsx`
Expected: PASS (2 test)

- [ ] **Step 5: Regresyon kontrolü**

Run: `npx vitest run tests/board-exercise-click-square.test.tsx tests/board-exercise-multi-click.test.tsx tests/board-exercise-place-pieces.test.tsx`
Expected: hepsi hâlâ PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/tests/board-exercise-paint.test.tsx
git commit -m "feat: sporcu tarafında tahta tiplerinde çizim gösterimi"
```

---

### Task 8: Sporcu tarafı — Cümle/Görüntü Ekle'de çizim gösterimi

**Files:**
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx` (`SentenceQuestionEx`, `ImageQuestionEx`)
- Modify: `apps/web/components/lesson-steps/ChoiceQuestionVisual.tsx`
- Test: `apps/web/tests/choice-question-visual.test.tsx` (mevcut dosyaya eklenir)

- [ ] **Step 1: Write the failing test**

```tsx
it('sentence_question: annotations doluysa öğeler tahtayla birlikte render edilir', () => {
  const ex: SentenceQuestionEx = {
    type: 'sentence_question', instruction: 'x', answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1',
    annotations: [{ id: 'a1', kind: 'shape', shape: 'circle', x: 30, y: 30, w: 10, h: 10, rotation: 0, color: '#3b82f6' }],
  };
  const { getByTestId } = render(<ChoiceQuestionVisual exercise={ex} />);
  expect(getByTestId('paint-item-a1')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-question-visual.test.tsx`
Expected: FAIL — `SentenceQuestionEx`'te `annotations` yok (tip hatası)

- [ ] **Step 3: Write minimal implementation**

`BoardExercise.tsx`'teki `SentenceQuestionEx` ve `ImageQuestionEx` arayüzlerine ekle:

```ts
  /** Tahtaya eklenen serbest yazı/şekil/renk öğeleri (C grubu, opsiyonel). */
  annotations?: PaintItem[];
```

`ChoiceQuestionVisual.tsx` başına import ekle:

```ts
import { PaintItemView } from '@/components/PaintItemView';
```

`sentence-board` bloğunun (A grubunda kurulan) içine, `Chessboard`'ın altına ekle:

```tsx
{exercise.type === 'sentence_question' && exercise.fen && exercise.sentence_show_board !== false && (
  <div data-testid="sentence-board" className="rounded-xl p-2" style={{ backgroundColor: BOARD_CARD_BG, maxWidth: 240, margin: '0 auto', position: 'relative' }}>
    <div className="aspect-square" style={BOARD_STYLE}>
      <Chessboard options={{ ... }} />
      {exercise.annotations?.map((item) => <PaintItemView key={item.id} item={item} />)}
    </div>
  </div>
)}
```

Aynı deseni `image_question`'ın hem `hasLegacyPlacement` hem `hasMulti` bloklarındaki `EmptyBoardGrid`/düz-görünüm sarmalayıcılarının içine ekle (her ikisinde de en dışta bir `position: relative` kapsayıcı zaten var — `maxWidth: 340, margin: '0 auto'` olan `<div>`'ler; `PaintItemView` render'ları o `<div>`'in en sonuna eklenir).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/choice-question-visual.test.tsx`
Expected: PASS (tüm testler)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/lesson-steps/BoardExercise.tsx apps/web/components/lesson-steps/ChoiceQuestionVisual.tsx apps/web/tests/choice-question-visual.test.tsx
git commit -m "feat: sporcu tarafında Cümle/Görüntü Ekle'de çizim gösterimi"
```

---

### Task 9: Backend — `annotations` doğrulaması

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py`
- Test: `apps/api/tests/test_paint_annotations.py` (yeni)

- [ ] **Step 1: Write the failing test**

```python
import pytest
from fastapi import HTTPException

from chess_api.routers.admin import _validate_board_exercises

BASE_FEN = "8/8/8/8/4K3/8/8/R7 w - - 0 1"


def _click_square_ex(**over):
    ex = {
        "type": "click_square", "instruction": "e4'e tıkla", "fen": BASE_FEN,
        "target_squares": ["e4"],
    }
    ex.update(over)
    return ex


def _text_item(**over):
    item = {"id": "a1", "kind": "text", "x": 50, "y": 50, "rotation": 0, "color": "#ef4444", "text": "Not", "fontSize": 24}
    item.update(over)
    return item


def _shape_item(**over):
    item = {"id": "a2", "kind": "shape", "shape": "circle", "x": 30, "y": 30, "w": 15, "h": 15, "rotation": 0, "color": "#3b82f6"}
    item.update(over)
    return item


def test_gecerli_annotations_kabul_edilir():
    _validate_board_exercises([_click_square_ex(annotations=[_text_item(), _shape_item()])])


def test_annotations_olmadan_da_kabul_edilir():
    _validate_board_exercises([_click_square_ex()])


def test_gecersiz_renk_reddedilir():
    with pytest.raises(HTTPException) as e:
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(color="#123456")])])
    assert e.value.status_code == 400


def test_gecersiz_kind_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(kind="video")])])


def test_gecersiz_sekil_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_shape_item(shape="triangle")])])


def test_x_araligini_asan_deger_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(x=150)])])


def test_dondurme_araligini_asan_deger_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_shape_item(rotation=400)])])


def test_cok_uzun_yazi_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(text="a" * 201)])])


def test_gecersiz_punto_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_text_item(fontSize=5)])])


def test_gecersiz_genislik_reddedilir():
    with pytest.raises(HTTPException):
        _validate_board_exercises([_click_square_ex(annotations=[_shape_item(w=1)])])
```

- [ ] **Step 2: Run test to verify it fails**

Run (in `apps/api`): `python -m pytest tests/test_paint_annotations.py -v`
Expected: `test_gecerli_annotations_kabul_edilir` hariç hepsi FAIL (annotations hiç kontrol edilmiyor, hiçbir şey reddedilmiyor)

- [ ] **Step 3: Write minimal implementation**

`admin.py`'a (`_check_data_uri_size` fonksiyonunun altına) ekle:

```python
PAINT_COLORS = {
    "#000000", "#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#a855f7",
    "#f97316", "#14b8a6", "#92400e", "#eab308",
}
PAINT_SHAPES = {"circle", "square", "rectangle", "star", "arrow", "question"}


def _validate_annotations(items: object) -> None:
    """Tahtaya eklenen serbest yazı/şekil/renk öğelerini doğrular (C grubu).

    Öğe SAYISINDA sınır yok (kullanıcı onayı) — her öğenin kendi alanları
    mantıklı aralıkta mı bakılır, bozuk/aşırı büyük veri reddedilir.
    """
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="annotations bir liste olmalı")
    for idx, item in enumerate(items):
        label = f"{idx + 1}. çizim öğesi"
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"{label} nesne olmalı")
        if item.get("kind") not in ("text", "shape"):
            raise HTTPException(status_code=400, detail=f"{label} için geçersiz tür")
        if item.get("color") not in PAINT_COLORS:
            raise HTTPException(status_code=400, detail=f"{label} için geçersiz renk")
        x, y, rotation = item.get("x"), item.get("y"), item.get("rotation")
        for field_name, val, lo, hi in [("x", x, 0, 100), ("y", y, 0, 100), ("rotation", rotation, 0, 359)]:
            if not isinstance(val, (int, float)) or isinstance(val, bool) or val < lo or val > hi:
                raise HTTPException(status_code=400, detail=f"{label} için geçersiz {field_name}")
        if item["kind"] == "text":
            text = item.get("text")
            if not isinstance(text, str) or len(text) == 0 or len(text) > 200:
                raise HTTPException(status_code=400, detail=f"{label} için geçersiz yazı")
            font_size = item.get("fontSize")
            if not isinstance(font_size, (int, float)) or isinstance(font_size, bool) or font_size < 12 or font_size > 72:
                raise HTTPException(status_code=400, detail=f"{label} için geçersiz punto")
        else:
            if item.get("shape") not in PAINT_SHAPES:
                raise HTTPException(status_code=400, detail=f"{label} için geçersiz şekil")
            w, h = item.get("w"), item.get("h")
            for field_name, val in [("w", w), ("h", h)]:
                if not isinstance(val, (int, float)) or isinstance(val, bool) or val < 2 or val > 90:
                    raise HTTPException(status_code=400, detail=f"{label} için geçersiz {field_name}")
```

`_validate_board_exercises` fonksiyonunda, tip-özel doğrulamadan SONRA (fonksiyonun `for ex in exercises:` döngüsünün sonuna, mevcut tip-özel `if`/`elif` bloklarının hepsinden sonra) ekle:

```python
        if "annotations" in ex and ex["annotations"] is not None:
            _validate_annotations(ex["annotations"])
```

`_validate_choice_exercise` fonksiyonunun sonuna (mevcut `ci` doğrulamasından sonra) ekle:

```python
    if "annotations" in ex and ex["annotations"] is not None:
        _validate_annotations(ex["annotations"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_paint_annotations.py -v`
Expected: PASS (10 test)

- [ ] **Step 5: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_paint_annotations.py
git commit -m "feat(api): annotations doğrulaması"
```

---

### Task 10: Tam test kapısı + canlı doğrulama

**Files:** (yok — sadece doğrulama)

- [ ] **Step 1: Frontend tam gate**

Run (in `apps/web`):
```bash
npx tsc --noEmit && npx next lint && npx vitest run
```
Expected: tsc 0 hata, lint 0 hata, tüm testler PASS.

- [ ] **Step 2: Backend tam gate**

Run (in `apps/api`):
```bash
python -m pytest -q
```
Expected: tüm testler PASS.

- [ ] **Step 3: Canlı doğrulama (KURAL #6) — kullanıcıya sormadan ÖNCE bu adımı yapma**

Kullanıcıya "canlı doğrulayayım mı?" diye sor. Onay gelirse (A/B gruplarında
kullanılan mock-fetch + gerçek tarayıcı sürme yöntemi tekrarlanır):
- Bir "Kareye Tıkla" sorusunda konum kaydet, yazı ekle (rengini değiştir,
  punto ayarla), bir şekil ekle (döndür, boyutlandır), Ctrl+Z ile birini geri
  al, kaydet.
- Sporcu tarafında aynı soruyu aç, eklenen öğelerin aynı konum/renk/açıyla
  göründüğünü doğrula.
- Bir "Cümle Ekle" sorusunda da aynı akışı tekrarla.

- [ ] **Step 4: Commit (varsa küçük düzeltmeler)**

```bash
git add -A
git commit -m "test: C grubu tam test kapısı doğrulaması"
```

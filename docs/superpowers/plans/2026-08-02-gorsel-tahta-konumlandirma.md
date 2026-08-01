# Görsel Tahta Konumlandırma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panelde "Görüntü Ekle" (image_question) sorularında Zafer Hoca'nın
seçtiği görseli boş bir satranç tahtası üzerinde serbestçe sürükleyip
boyutlandırabilmesini ve gri tonlamasını (0-10) ayarlayabilmesini sağlamak;
sporcu ekranında bu konum/boyut/ton bilgisiyle (ve isteğe bağlı tahta arka
planıyla) render etmek.

**Architecture:** Pure-logic-first: konum/boyut/ton hesaplamaları
`lib/chess/imagePlacement.ts`'te React'tan bağımsız test edilir. Paylaşılan
`EmptyBoardGrid` bileşeni hem admin editörde (`ImagePlacer`) hem sporcu
ekranında (`ChoiceQuestionBody`) kullanılarak ikisinin BİREBİR aynı görünmesi
garanti edilir. Yeni 6 alan (`image_x/y/w/h/tone/show_board`) `BoardExercise`
tipine opsiyonel eklenir — eski sorularda bu alanlar yoktur, eski render
davranışı DEĞİŞMEZ (KURAL #3).

**Tech Stack:** Next.js 15 / React 19 / TypeScript, vitest + @testing-library/react
(apps/web); FastAPI + pytest (apps/api).

**Spec:** `docs/superpowers/specs/2026-08-02-gorsel-tahta-konumlandirma-design.md`

---

### Task 1: `lib/chess/imagePlacement.ts` — saf konum/boyut/ton mantığı

**Files:**
- Create: `apps/web/lib/chess/imagePlacement.ts`
- Test: `apps/web/tests/image-placement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PLACEMENT, clampPlacement, dragToPercent, resizeToPercent, toneToFilter,
} from '@/lib/chess/imagePlacement';

describe('imagePlacement', () => {
  it('DEFAULT_PLACEMENT ortalanmış, orta boy, ton 0', () => {
    expect(DEFAULT_PLACEMENT).toEqual({ x: 50, y: 50, w: 40, h: 40, tone: 0 });
  });

  it('clampPlacement değerleri sınırlar içine sıkıştırır', () => {
    expect(clampPlacement({ x: 150, y: -20, w: 2, h: 200, tone: 15 }))
      .toEqual({ x: 100, y: 0, w: 5, h: 90, tone: 10 });
  });

  it('clampPlacement eksik alanları varsayılanla doldurur', () => {
    expect(clampPlacement({})).toEqual(DEFAULT_PLACEMENT);
  });

  it('clampPlacement tone değerini tam sayıya yuvarlar', () => {
    expect(clampPlacement({ tone: 3.6 }).tone).toBe(4);
  });

  it('dragToPercent piksel deltasını tahta boyutuna göre yüzdeye çevirir', () => {
    const start = { x: 50, y: 50, w: 40, h: 40, tone: 0 };
    // 200x200'lük tahtada 20px sağa/aşağı sürükleme = %10
    const next = dragToPercent(start, 20, 20, 200, 200);
    expect(next.x).toBe(60);
    expect(next.y).toBe(60);
  });

  it('dragToPercent tahta kenarında clamp uygular', () => {
    const start = { x: 95, y: 5, w: 40, h: 40, tone: 0 };
    const next = dragToPercent(start, 100, -100, 200, 200);
    expect(next.x).toBe(100);
    expect(next.y).toBe(0);
  });

  it('dragToPercent tahta boyutu 0 ise değiştirmez', () => {
    const start = { x: 50, y: 50, w: 40, h: 40, tone: 0 };
    expect(dragToPercent(start, 20, 20, 0, 0)).toEqual(start);
  });

  it('resizeToPercent köşe deltasını genişlik/yükseklik yüzdesine ekler', () => {
    const start = { x: 50, y: 50, w: 40, h: 40, tone: 0 };
    const next = resizeToPercent(start, 20, 20, 200, 200);
    expect(next.w).toBe(60);
    expect(next.h).toBe(60);
  });

  it('resizeToPercent min/max sınırlarını uygular', () => {
    const start = { x: 50, y: 50, w: 40, h: 40, tone: 0 };
    const next = resizeToPercent(start, -1000, -1000, 200, 200);
    expect(next.w).toBe(5);
    expect(next.h).toBe(5);
  });

  it('toneToFilter 0 için none döner', () => {
    expect(toneToFilter(0)).toBe('none');
  });

  it('toneToFilter 10 için tam gri döner', () => {
    expect(toneToFilter(10)).toBe('grayscale(1)');
  });

  it('toneToFilter 5 için yarı gri döner', () => {
    expect(toneToFilter(5)).toBe('grayscale(0.5)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/image-placement.test.ts`
Expected: FAIL — `Cannot find module '@/lib/chess/imagePlacement'`

- [ ] **Step 3: Write the implementation**

```ts
/** Görselin tahta üzerindeki konumu/boyutu — hepsi tahta genişliği/yüksekliğinin
 *  YÜZDESİ (0-100). x,y = görselin MERKEZİ. w,h = görselin genişlik/yüksekliği. */
export interface ImagePlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0-10 tam sayı — gri tonlama yoğunluğu (0=orijinal, 10=tam gri). */
  tone: number;
}

export const DEFAULT_PLACEMENT: ImagePlacement = { x: 50, y: 50, w: 40, h: 40, tone: 0 };

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Eksik/aralık dışı alanları varsayılanla doldurup sınırlar içine sıkıştırır. */
export function clampPlacement(p: Partial<ImagePlacement>): ImagePlacement {
  return {
    x: clamp(p.x ?? DEFAULT_PLACEMENT.x, 0, 100),
    y: clamp(p.y ?? DEFAULT_PLACEMENT.y, 0, 100),
    w: clamp(p.w ?? DEFAULT_PLACEMENT.w, 5, 90),
    h: clamp(p.h ?? DEFAULT_PLACEMENT.h, 5, 90),
    tone: Math.round(clamp(p.tone ?? DEFAULT_PLACEMENT.tone, 0, 10)),
  };
}

/** Sürükleme: piksel deltasını tahtanın piksel boyutuna göre yüzdeye çevirip
 *  merkez konumuna ekler. Tahta boyutu bilinmiyorsa (0) değiştirmeden döner. */
export function dragToPercent(
  start: ImagePlacement, deltaPxX: number, deltaPxY: number, boardPxW: number, boardPxH: number,
): ImagePlacement {
  if (boardPxW <= 0 || boardPxH <= 0) return start;
  return clampPlacement({
    ...start,
    x: start.x + (deltaPxX / boardPxW) * 100,
    y: start.y + (deltaPxY / boardPxH) * 100,
  });
}

/** Boyutlandırma: tutamaç köşede durur (merkez + yarı boyut). Tutamacı deltaPx
 *  kadar sürüklemek köşeyi o kadar kaydırır, yani YARI genişlik deltaPx kadar
 *  değişir — TAM genişlik bu yüzden 2×deltaPx kadar değişir (merkez sabit kalıp
 *  görsel her iki yöne birden büyür/küçülür). */
export function resizeToPercent(
  start: ImagePlacement, deltaPxX: number, deltaPxY: number, boardPxW: number, boardPxH: number,
): ImagePlacement {
  if (boardPxW <= 0 || boardPxH <= 0) return start;
  return clampPlacement({
    ...start,
    w: start.w + (deltaPxX / boardPxW) * 100 * 2,
    h: start.h + (deltaPxY / boardPxH) * 100 * 2,
  });
}

/** 0-10 tonu CSS grayscale filtresine çevirir. 0 = filtre yok (performans). */
export function toneToFilter(tone: number): string {
  const clamped = Math.round(clamp(tone, 0, 10));
  return clamped === 0 ? 'none' : `grayscale(${clamped / 10})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/image-placement.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/chess/imagePlacement.ts tests/image-placement.test.ts
git commit -m "feat(admin): görsel konum/boyut/ton için saf mantık (imagePlacement.ts)"
```

---

### Task 2: `components/chess/EmptyBoardGrid.tsx` — paylaşılan boş tahta

**Files:**
- Create: `apps/web/components/chess/EmptyBoardGrid.tsx`
- Test: `apps/web/tests/empty-board-grid.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';

describe('EmptyBoardGrid', () => {
  it('64 kare render eder', () => {
    const { container } = render(<EmptyBoardGrid />);
    const grid = container.querySelector('[data-testid="empty-board-grid"] > div');
    expect(grid?.children.length).toBe(64);
  });

  it('children prop ile üzerine katman eklenebilir', () => {
    const { getByText } = render(
      <EmptyBoardGrid><span>üst katman</span></EmptyBoardGrid>,
    );
    expect(getByText('üst katman')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/empty-board-grid.test.tsx`
Expected: FAIL — `Cannot find module '@/components/chess/EmptyBoardGrid'`

- [ ] **Step 3: Write the implementation**

```tsx
'use client';
import type { ReactNode } from 'react';
import { useSettings } from '@/lib/settings/settings-context';
import { getBoardColors } from '@/lib/chess/boardSkin';

interface Props {
  children?: ReactNode;
}

/**
 * 8×8 dama deseni — sade görsel referans (taş yok, chess.js yok — YAGNI).
 * ImagePlacer (admin editörü) ve ChoiceQuestionBody (sporcu ekranı) BU AYNI
 * bileşeni paylaşır; böylece Hoca'nın editörde gördüğü konum, sporcunun
 * gördüğüyle birebir eşleşir — iki ayrı çizim birbirinden kayarsa
 * konumlandırma anlamsızlaşır.
 */
export function EmptyBoardGrid({ children }: Props) {
  const { settings } = useSettings();
  const colors = getBoardColors(settings.board);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '1 / 1' }}
      data-testid="empty-board-grid">
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
        {Array.from({ length: 64 }, (_, i) => {
          const row = Math.floor(i / 8);
          const col = i % 8;
          const light = (row + col) % 2 === 0;
          return <div key={i} style={{ backgroundColor: light ? colors.light : colors.dark }} />;
        })}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/empty-board-grid.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add components/chess/EmptyBoardGrid.tsx tests/empty-board-grid.test.tsx
git commit -m "feat: EmptyBoardGrid — admin/sporcu ortak boş tahta bileşeni"
```

---

### Task 3: `components/admin/ImagePlacer.tsx` — sürükle/boyutlandır/ton editörü

**Files:**
- Create: `apps/web/components/admin/ImagePlacer.tsx`
- Test: `apps/web/tests/image-placer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImagePlacer } from '@/components/admin/ImagePlacer';
import { DEFAULT_PLACEMENT } from '@/lib/chess/imagePlacement';

describe('ImagePlacer', () => {
  it('görseli varsayılan konum/boyut/ton ile render eder', () => {
    render(<ImagePlacer uri="data:image/png;base64,AAA" placement={DEFAULT_PLACEMENT} onChange={vi.fn()} />);
    const img = screen.getByAltText('Konumlandırılan görsel') as HTMLImageElement;
    expect(img.style.left).toBe('50%');
    expect(img.style.top).toBe('50%');
    expect(img.style.width).toBe('40%');
    expect(img.style.height).toBe('40%');
    expect(img.style.filter).toBe('none');
  });

  it('ton kaydırıcısı değişince onChange doğru ton ile çağrılır', () => {
    const onChange = vi.fn();
    render(<ImagePlacer uri="x" placement={DEFAULT_PLACEMENT} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Görsel ton ayarı'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_PLACEMENT, tone: 7 });
  });

  it('görseli sürüklemek onChange ile yeni x/y tetikler', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ImagePlacer uri="x" placement={DEFAULT_PLACEMENT} onChange={onChange} />,
    );
    const boardWrap = container.querySelector('[data-drag-root]') as HTMLElement;
    boardWrap.getBoundingClientRect = () => ({
      width: 200, height: 200, left: 0, top: 0, right: 200, bottom: 200, x: 0, y: 0, toJSON() {},
    });
    const img = screen.getByAltText('Konumlandırılan görsel');
    fireEvent.pointerDown(img, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(boardWrap, { clientX: 120, clientY: 100 });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ x: 60, y: 50 }));
  });

  it('boyutlandırma tutamacını sürüklemek onChange ile yeni w/h tetikler', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ImagePlacer uri="x" placement={DEFAULT_PLACEMENT} onChange={onChange} />,
    );
    const boardWrap = container.querySelector('[data-drag-root]') as HTMLElement;
    boardWrap.getBoundingClientRect = () => ({
      width: 200, height: 200, left: 0, top: 0, right: 200, bottom: 200, x: 0, y: 0, toJSON() {},
    });
    const handle = screen.getByLabelText('Boyutlandır');
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(boardWrap, { clientX: 120, clientY: 100 });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ w: 60 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/image-placer.test.tsx`
Expected: FAIL — `Cannot find module '@/components/admin/ImagePlacer'`

- [ ] **Step 3: Write the implementation**

```tsx
'use client';
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';
import {
  type ImagePlacement, clampPlacement, dragToPercent, resizeToPercent, toneToFilter,
} from '@/lib/chess/imagePlacement';

interface Props {
  uri: string;
  placement: ImagePlacement;
  onChange: (p: ImagePlacement) => void;
}

type DragMode = 'move' | 'resize' | null;

/** Zafer Hoca'nın görseli boş tahta üzerinde serbestçe sürükleyip
 *  boyutlandırdığı ve ton ayarladığı editör. Tahta HER ZAMAN görünür
 *  (yerleştirme referansı olmadan sürükleme anlamsız olur) — sporcuya
 *  tahtanın gösterilip gösterilmeyeceği ayrı bir anahtardır (ChoiceExerciseFields). */
export function ImagePlacer({ uri, placement, onChange }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; placement: ImagePlacement } | null>(null);
  const [mode, setMode] = useState<DragMode>(null);

  function startDrag(e: ReactPointerEvent, m: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    dragStart.current = { x: e.clientX, y: e.clientY, placement };
    setMode(m);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!mode || !dragStart.current || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;
    const next = mode === 'move'
      ? dragToPercent(dragStart.current.placement, deltaX, deltaY, rect.width, rect.height)
      : resizeToPercent(dragStart.current.placement, deltaX, deltaY, rect.width, rect.height);
    onChange(next);
  }

  function endDrag() {
    setMode(null);
    dragStart.current = null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs n-muted">
        Görseli <b>sürükle</b>, köşesindeki mavi tutamaçtan <b>boyutlandır</b>
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
          <img
            src={uri}
            alt="Konumlandırılan görsel"
            draggable={false}
            onPointerDown={(e) => startDrag(e, 'move')}
            className="absolute cursor-move select-none"
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              width: `${placement.w}%`,
              height: `${placement.h}%`,
              transform: 'translate(-50%, -50%)',
              filter: toneToFilter(placement.tone),
              objectFit: 'contain',
            }}
          />
          <div
            role="button"
            aria-label="Boyutlandır"
            onPointerDown={(e) => startDrag(e, 'resize')}
            className="absolute cursor-nwse-resize"
            style={{
              left: `${placement.x + placement.w / 2}%`,
              top: `${placement.y + placement.h / 2}%`,
              width: 16,
              height: 16,
              transform: 'translate(-50%, -50%)',
              background: '#22d3ee',
              borderRadius: 4,
              border: '2px solid white',
            }}
          />
        </EmptyBoardGrid>
      </div>
      <div className="flex items-center gap-2" style={{ maxWidth: 320 }}>
        <span className="text-xs n-muted">Ton</span>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={placement.tone}
          aria-label="Görsel ton ayarı"
          onChange={(e) => onChange(clampPlacement({ ...placement, tone: Number(e.target.value) }))}
          className="flex-1"
        />
        <span className="text-xs n-muted w-6 text-right">{placement.tone}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/image-placer.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/admin/ImagePlacer.tsx tests/image-placer.test.tsx
git commit -m "feat(admin): ImagePlacer — görsel sürükle/boyutlandır/ton editörü"
```

---

### Task 4: `BoardExercise` tipine ve backend'e yeni opsiyonel alanlar

**Files:**
- Modify: `apps/web/components/admin/ExerciseForm.tsx:16-38`
- Modify: `apps/web/components/lesson-steps/BoardExercise.tsx:84-96` (`ImageQuestionEx`)
- Modify: `apps/api/chess_api/routers/admin.py:548-580` (`_validate_choice_exercise`)
- Test: `apps/api/tests/test_board_exercises.py`

- [ ] **Step 1: Write the failing backend test**

Append to `apps/api/tests/test_board_exercises.py`:

```python
@pytest.mark.asyncio
async def test_image_question_accepts_placement_fields(client, db):
    les = await _lesson(db, order=90)
    tok = await _teacher_token(client, email="placement1@t.com")
    small_img = "data:image/png;base64," + "A" * 100
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "Fili şu kareye sür",
         "prompt_image": small_img, "answer_kind": "sentence",
         "options": ["a", "b"], "correct_index": 0,
         "image_x": 60, "image_y": 40, "image_w": 30, "image_h": 30,
         "image_tone": 5, "image_show_board": True},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_image_question_placement_fields_optional(client, db):
    """Eski sorular gibi hiç placement alanı göndermeden de kabul edilmeli (KURAL #3)."""
    les = await _lesson(db, order=91)
    tok = await _teacher_token(client, email="placement2@t.com")
    small_img = "data:image/png;base64," + "A" * 100
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "Soru", "prompt_image": small_img,
         "answer_kind": "sentence", "options": ["a", "b"], "correct_index": 0},
    ])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_image_question_rejects_out_of_range_placement(client, db):
    les = await _lesson(db, order=92)
    tok = await _teacher_token(client, email="placement3@t.com")
    small_img = "data:image/png;base64," + "A" * 100
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "Soru", "prompt_image": small_img,
         "answer_kind": "sentence", "options": ["a", "b"], "correct_index": 0,
         "image_x": 150},
    ])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_image_question_rejects_non_bool_show_board(client, db):
    les = await _lesson(db, order=93)
    tok = await _teacher_token(client, email="placement4@t.com")
    small_img = "data:image/png;base64," + "A" * 100
    r = await _post_step(client, tok, les.id, [
        {"type": "image_question", "instruction": "Soru", "prompt_image": small_img,
         "answer_kind": "sentence", "options": ["a", "b"], "correct_index": 0,
         "image_show_board": "yes"},
    ])
    assert r.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_board_exercises.py -k placement -v` (from `apps/api`)
Expected: `test_image_question_rejects_out_of_range_placement` and
`test_image_question_rejects_non_bool_show_board` FAIL (status 201 döner, henüz kontrol yok);
diğer ikisi zaten geçer (alanlar şu an sessizce yok sayılıyor).

- [ ] **Step 3: Write the backend implementation**

In `apps/api/chess_api/routers/admin.py`, replace the `image_question` branch of
`_validate_choice_exercise` (currently lines 553-557):

```python
    if ex_type == "image_question":
        img = ex.get("prompt_image")
        if not img:
            raise HTTPException(status_code=400, detail="Görsel soru için görsel gerekli")
        _check_data_uri_size(img, "Soru görseli")
        _validate_image_placement(ex)
    else:  # sentence_question
```

Add a new function directly above `_validate_choice_exercise`:

```python
def _validate_image_placement(ex: dict) -> None:
    """image_x/y/w/h/tone/show_board hepsi OPSİYONEL — verilmişse aralık kontrolü.
    Eski sorularda bu alanlar hiç yok; o durumda hiçbir kontrol tetiklenmez (KURAL #3)."""
    ranges = (("image_x", 0, 100), ("image_y", 0, 100),
              ("image_w", 5, 90), ("image_h", 5, 90), ("image_tone", 0, 10))
    for field, lo, hi in ranges:
        if field in ex and ex[field] is not None:
            val = ex[field]
            if not isinstance(val, (int, float)) or isinstance(val, bool) or val < lo or val > hi:
                raise HTTPException(status_code=400, detail=f"{field} {lo}-{hi} arasında olmalı")
    if "image_show_board" in ex and ex["image_show_board"] is not None:
        if not isinstance(ex["image_show_board"], bool):
            raise HTTPException(status_code=400, detail="image_show_board doğru/yanlış olmalı")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_board_exercises.py -v` (from `apps/api`)
Expected: PASS — tüm testler (eskiler + 4 yeni) geçer.

- [ ] **Step 5: Add the frontend type fields**

In `apps/web/components/admin/ExerciseForm.tsx`, extend the `BoardExercise`
interface (currently ends at line 38 with `moves?: string[];`):

```ts
  /** Sadece move_piece için — SAN hamle dizisi (Konumu Kaydet sonrası kaydedilir). */
  moves?: string[];
  /** Sadece image_question için — görselin tahta üzerindeki konumu/boyutu/tonu
   *  (yüzde 0-100, tone 0-10). Yoksa eski düz görünüm kullanılır (KURAL #3). */
  image_x?: number;
  image_y?: number;
  image_w?: number;
  image_h?: number;
  image_tone?: number;
  /** Sporcu ekranında boş tahta arka planı gösterilsin mi (varsayılan true). */
  image_show_board?: boolean;
```

In `apps/web/components/lesson-steps/BoardExercise.tsx`, extend `ImageQuestionEx`
(currently lines 84-96):

```ts
export interface ImageQuestionEx {
  type: 'image_question';
  /** İsteğe bağlı alt başlık/açıklama — '' olabilir. */
  instruction: string;
  prompt_image: string;
  answer_kind: 'sentence' | 'image';
  options: string[];
  correct_index: number;
  success_msg?: string;
  fail_msg?: string;
  code?: string;
  difficulty?: number;
  image_x?: number;
  image_y?: number;
  image_w?: number;
  image_h?: number;
  image_tone?: number;
  image_show_board?: boolean;
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit` (from `apps/web`)
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
cd apps/api && git add chess_api/routers/admin.py tests/test_board_exercises.py
git commit -m "feat(api): image_question için opsiyonel konum/boyut/ton alanları + doğrulama"
cd ../web && git add components/admin/ExerciseForm.tsx components/lesson-steps/BoardExercise.tsx
git commit -m "feat: BoardExercise/ImageQuestionEx tiplerine konum/boyut/ton alanları"
```

---

### Task 5: `ChoiceExerciseFields.tsx` entegrasyonu — ImagePlacer + Talimat + tahta anahtarı

**Files:**
- Modify: `apps/web/components/admin/ChoiceExerciseFields.tsx`
- Test: `apps/web/tests/choice-exercise-image-placement.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

function fillMinimum() {
  fireEvent.change(screen.getByPlaceholderText('Talimat'), { target: { value: 'Tahtaya bak' } });
  fireEvent.click(screen.getByText('2 seçenek'));
  fireEvent.click(screen.getByText('Cümle'));
  const inputs = screen.getAllByPlaceholderText(/\. şık/);
  fireEvent.change(inputs[0], { target: { value: 'A' } });
  fireEvent.change(inputs[1], { target: { value: 'B' } });
  fireEvent.click(screen.getByText('Kolay'));
}

describe('ChoiceExerciseFields — görsel konumlandırma (image_question)', () => {
  it('görsel seçilmeden ImagePlacer görünmez', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.queryByAltText('Konumlandırılan görsel')).not.toBeInTheDocument();
  });

  it('görsel seçilince altında ImagePlacer otomatik belirir', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} initial={{
      type: 'image_question', instruction: 'x', prompt_image: 'data:image/png;base64,AAA',
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    expect(await screen.findByAltText('Konumlandırılan görsel')).toBeInTheDocument();
  });

  it('"Açıklama" etiketi yerine zorunlu "Talimat" placeholder\'ı kullanılır', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText('Talimat')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Açıklama (opsiyonel)')).not.toBeInTheDocument();
  });

  it('Talimat boşken kaydet butonu kilitli kalır', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} initial={{
      type: 'image_question', instruction: '', prompt_image: 'data:image/png;base64,AAA',
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    expect(screen.getByText('Soruyu kaydet')).toBeDisabled();
  });

  it('kaydet çağrısı image_x/y/w/h/tone/show_board alanlarını gönderir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="image_question" onSubmit={onSubmit} initial={{
      type: 'image_question', instruction: 'Talimat metni', prompt_image: 'data:image/png;base64,AAA',
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.image_x).toBe(50);
    expect(sent.image_y).toBe(50);
    expect(sent.image_w).toBe(40);
    expect(sent.image_h).toBe(40);
    expect(sent.image_tone).toBe(0);
    expect(sent.image_show_board).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-exercise-image-placement.test.tsx`
Expected: FAIL — `Talimat` placeholder bulunamaz (hâlâ "Açıklama (opsiyonel)"),
`ImagePlacer` hiç render edilmiyor.

- [ ] **Step 3: Write the implementation**

In `apps/web/components/admin/ChoiceExerciseFields.tsx`:

Add imports (after existing imports, currently ending at line 9):

```ts
import { ImagePlacer } from './ImagePlacer';
import { type ImagePlacement, DEFAULT_PLACEMENT, clampPlacement } from '@/lib/chess/imagePlacement';
```

Extend `ChoiceDraft` (currently lines 14-27) with two new fields:

```ts
export interface ChoiceDraft {
  instruction: string;
  promptImage: string;
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
  imagePlacement: ImagePlacement;
  imageShowBoard: boolean;
}
```

After the `promptImage` state (currently line 42), add:

```ts
  const [placement, setPlacement] = useState<ImagePlacement>(
    draft?.imagePlacement ?? clampPlacement({
      x: initial?.image_x, y: initial?.image_y, w: initial?.image_w,
      h: initial?.image_h, tone: initial?.image_tone,
    }),
  );
  const [showBoard, setShowBoard] = useState(
    draft?.imageShowBoard ?? initial?.image_show_board ?? true,
  );
```

In the `useEffect` that writes the draft (currently lines 83-92), add the two
new fields to both the object and the dependency array:

```ts
  useEffect(() => {
    onDraftChange?.({
      instruction, promptImage, optionCount, answerKind,
      options, correctIndex, successMsg, failMsg, difficulty,
      optionCountChosen, answerKindChosen, difficultyChosen,
      imagePlacement: placement, imageShowBoard: showBoard,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruction, promptImage, optionCount, answerKind, options,
      correctIndex, successMsg, failMsg, difficulty,
      optionCountChosen, answerKindChosen, difficultyChosen,
      placement, showBoard]);
```

In `validate()` (currently lines 140-149), add an `image_question` branch
right after the existing `sentence_question` check:

```ts
  function validate(): string | null {
    if (kind === 'sentence_question' && !instruction.trim()) return 'Soru metni gerekli';
    if (kind === 'image_question' && !promptImage) return 'Soru görseli gerekli';
    if (kind === 'image_question' && !instruction.trim()) return 'Talimat gerekli';
    if (answerKind === 'sentence') {
```

In `submit()` (currently lines 151-179), add the placement fields to `base`
right after the existing `if (kind === 'image_question') base.prompt_image = promptImage;`:

```ts
    if (kind === 'image_question') {
      base.prompt_image = promptImage;
      base.image_x = placement.x;
      base.image_y = placement.y;
      base.image_w = placement.w;
      base.image_h = placement.h;
      base.image_tone = placement.tone;
      base.image_show_board = showBoard;
    }
```

Also in `submit()`'s reset block for new-question mode (currently
`if (!editing) { setInstruction(''); ... }`), add placement reset:

```ts
      if (!editing) {
        setInstruction(''); setPromptImage(''); setOptionCount(2); setAnswerKind('sentence');
        setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg(''); setDifficulty(1);
        setOptionCountChosen(false); setAnswerKindChosen(false); setDifficultyChosen(false);
        setPlacement(DEFAULT_PLACEMENT); setShowBoard(true);
      }
```

In the JSX, replace the `image_question` branch's instruction input (currently
lines 251-252, `placeholder="Açıklama (opsiyonel)"`) — and insert `ImagePlacer`
+ the show-board toggle right after the existing "Havuza da eklensin mi?" block
(currently ending at line 250), before that renamed input:

```tsx
          {promptImage && (
            <div className="space-y-2">
              <ImagePlacer uri={promptImage} placement={placement} onChange={setPlacement} />
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
```

(This replaces the old `placeholder="Açıklama (opsiyonel)"` input at the end
of the `image_question` JSX block — same `instruction` state, new label/copy.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/choice-exercise-image-placement.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full existing ChoiceExerciseFields test suite for regressions**

Run: `npx vitest run tests/choice-exercise-paste-image.test.tsx tests/choice-exercise-image-delete.test.tsx tests/exercise-form-family.test.tsx`
Expected: PASS — no regressions from the label/state changes.

- [ ] **Step 6: Commit**

```bash
git add components/admin/ChoiceExerciseFields.tsx tests/choice-exercise-image-placement.test.tsx
git commit -m "feat(admin): ChoiceExerciseFields — ImagePlacer entegrasyonu + zorunlu Talimat"
```

---

### Task 6: `ChoiceQuestionBody.tsx` — sporcu ekranında konumlandırılmış render

**Files:**
- Modify: `apps/web/components/lesson-steps/ChoiceQuestionBody.tsx`
- Test: `apps/web/tests/choice-question-body-image-placement.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoiceQuestionBody } from '@/components/lesson-steps/ChoiceQuestionBody';
import type { ImageQuestionEx } from '@/components/lesson-steps/BoardExercise';

const BASE: ImageQuestionEx = {
  type: 'image_question',
  instruction: 'Bak',
  prompt_image: 'data:image/png;base64,AAA',
  answer_kind: 'sentence',
  options: ['a', 'b'],
  correct_index: 0,
};

describe('ChoiceQuestionBody — görsel konumlandırma (madde: admin görsel editörü)', () => {
  it('yerleşim alanı YOK ise eski düz görünüm korunur (regresyon)', () => {
    const { container } = render(
      <ChoiceQuestionBody exercise={BASE} disabled={false} onAnswer={vi.fn()} />,
    );
    expect(screen.queryByTestId('empty-board-grid')).not.toBeInTheDocument();
    const img = screen.getByAltText('Soru görseli') as HTMLImageElement;
    expect(img.style.position).not.toBe('absolute');
  });

  it('image_show_board true ise tahta arka planıyla konumlandırılmış render eder', () => {
    render(<ChoiceQuestionBody exercise={{
      ...BASE, image_x: 60, image_y: 40, image_w: 30, image_h: 30,
      image_tone: 5, image_show_board: true,
    }} disabled={false} onAnswer={vi.fn()} />);
    expect(screen.getByTestId('empty-board-grid')).toBeInTheDocument();
    const img = screen.getByAltText('Soru görseli') as HTMLImageElement;
    expect(img.style.left).toBe('60%');
    expect(img.style.top).toBe('40%');
    expect(img.style.filter).toBe('grayscale(0.5)');
  });

  it('image_show_board false ise tahta arka planı OLMADAN konumlandırılmış render eder', () => {
    render(<ChoiceQuestionBody exercise={{
      ...BASE, image_x: 60, image_y: 40, image_w: 30, image_h: 30,
      image_tone: 0, image_show_board: false,
    }} disabled={false} onAnswer={vi.fn()} />);
    expect(screen.queryByTestId('empty-board-grid')).not.toBeInTheDocument();
    const img = screen.getByAltText('Soru görseli') as HTMLImageElement;
    expect(img.style.left).toBe('60%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/choice-question-body-image-placement.test.tsx`
Expected: FAIL — konumlandırılmış render hiç yok, her koşulda eski düz `<img>` render ediliyor.

- [ ] **Step 3: Write the implementation**

Replace the `image_question` block in `apps/web/components/lesson-steps/ChoiceQuestionBody.tsx`
(currently lines 17-22):

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

  const hasPlacement = exercise.type === 'image_question' && exercise.image_x !== undefined;

  return (
    <>
      {exercise.type === 'image_question' && !hasPlacement && (
        <div className="rounded-xl overflow-hidden" style={{ maxWidth: 340, margin: '0 auto' }}>
          <img src={exercise.prompt_image} alt="Soru görseli"
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
        </div>
      )}

      {exercise.type === 'image_question' && hasPlacement && (
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

Run: `npx vitest run tests/choice-question-body-image-placement.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/lesson-steps/ChoiceQuestionBody.tsx tests/choice-question-body-image-placement.test.tsx
git commit -m "feat: ChoiceQuestionBody — sporcu ekranında konumlandırılmış görsel render"
```

---

### Task 7: Tam test kapısı

**Files:** yok (yalnızca doğrulama)

- [ ] **Step 1: apps/web tam kapı**

Run (from `apps/web`):
```bash
npx tsc --noEmit
npx next lint
npx vitest run
```
Expected: tsc 0 hata; lint sadece mevcut pre-existing uyarılar (yeni hata yok);
vitest tüm dosyalar dahil (mevcut 669 + bu işte eklenen ~26 yeni test) PASS.

- [ ] **Step 2: apps/api tam kapı**

Run (from `apps/api`):
```bash
python -m pytest -q
```
Expected: tüm testler PASS (mevcut + 4 yeni placement testi).

- [ ] **Step 3: Build**

Run (from `apps/web`):
```bash
npm run build
```
Expected: başarılı, hata yok.

- [ ] **Step 4: Regresyon kontrolü — eski image_question soruları**

`tests/choice-question-body-image-placement.test.tsx`'teki ilk test
(`yerleşim alanı YOK ise eski düz görünüm korunur`) zaten bunu doğruluyor;
ek olarak mevcut `tests/board-exercise-*.test.tsx` dosyalarının hepsinin
hâlâ PASS olduğunu (Task 7 Step 1'deki tam `vitest run` çıktısında) teyit et.

---

### Task 8: Canlı doğrulama (KURAL #6)

**Files:** yok

- [ ] **Step 1: Dev sunucularını başlat**

`apps/api`: `uvicorn chess_api.main:app --reload` (veya proje betiği)
`apps/web`: `npm run dev`

- [ ] **Step 2: Admin panelde gerçek bir soru oluştur**

Tarayıcı araçlarıyla (Browser pane): `/admin/content` → bir derse gir →
"Yeni Soru Ekle" → "Görüntü ekle" → bir görsel yükle (dosyadan/havuzdan) →
ImagePlacer'ın otomatik belirdiğini doğrula → görseli sürükleyip farklı bir
konuma taşı → köşe tutamacından boyutlandır → ton kaydırıcısını orta bir
değere getir → "Talimat" kutusunu doldur → "Sporcu tahtayı da görsün"
anahtarını açık bırak → kaydet.

- [ ] **Step 3: Sporcu tarafında doğrula**

O dersi sporcu hesabıyla (veya ilgili pratik/ders akışıyla) aç, sorunun
görselinin admin'de bırakılan konum/boyut/tonda ve tahta arka planıyla
göründüğünü ekran görüntüsüyle doğrula.

- [ ] **Step 4: Regresyon — eski bir soruyu kontrol et**

Bu özellik eklenmeden önce oluşturulmuş (yerleşim alanı olmayan) bir
`image_question` sorusunu sporcu tarafında aç, görselin eskisi gibi düz/
ortalanmış göründüğünü (tahta arka planı OLMADAN) doğrula.

- [ ] **Step 5: Kullanıcıya rapor**

Ne test edildi, ne gözlemlendi (ekran görüntüleriyle), hangi adımlar
otomatik testlerle (Task 1-6) hangi adımlar canlı tarayıcıyla doğrulandı —
açıkça ayırarak raporla (KURAL #1).

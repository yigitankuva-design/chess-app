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

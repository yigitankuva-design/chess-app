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

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface BoardArrow { from: string; to: string; color: string }

/** Kare renklendirmesiyle AYNI palet — sağ tık aynı anlamı taşısın. */
const ARROW_COLORS = {
  green: 'rgba(34, 197, 94, 0.85)',
  red: 'rgba(239, 68, 68, 0.85)',
  blue: 'rgba(59, 130, 246, 0.85)',
  yellow: 'rgba(234, 179, 8, 0.9)',
} as const;

function colorFor(e: { ctrlKey: boolean; altKey: boolean }): string {
  if (e.ctrlKey && e.altKey) return ARROW_COLORS.yellow;
  if (e.ctrlKey) return ARROW_COLORS.red;
  if (e.altKey) return ARROW_COLORS.blue;
  return ARROW_COLORS.green;
}

function squareAt(target: EventTarget | null): string | null {
  const el = target as HTMLElement | null;
  return el?.closest?.('[data-square]')?.getAttribute('data-square') ?? null;
}

/**
 * Sağ tuşla SÜRÜKLEYEREK ok çizme. Aynı ok tekrar çizilirse silinir.
 * resetKey değişince (yeni konum/yeni soru) tüm oklar temizlenir.
 *
 * Kütüphanenin kendi okları KAPALI olmalı (allowDrawingArrows: false);
 * yoksa At hamlesi yine "L" çizilir (madde 7).
 */
export function useBoardArrows(resetKey: unknown) {
  const [arrows, setArrows] = useState<BoardArrow[]>([]);
  const fromRef = useRef<string | null>(null);
  /** Ok çizildiyse aynı sağ tık kare boyamasını TETİKLEMESİN. */
  const drewRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setArrows([]); }, [resetKey]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 2) return;
    fromRef.current = squareAt(e.target);
    drewRef.current = false;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 2) return;
    const from = fromRef.current;
    const to = squareAt(e.target);
    fromRef.current = null;
    if (!from || !to || from === to) return;   // ayni kare => renklendirme isi
    drewRef.current = true;
    const color = colorFor(e);
    setArrows((prev) => {
      const same = prev.findIndex((a) => a.from === from && a.to === to);
      if (same >= 0) {
        const next = [...prev];
        // Ayni ok ayni renkteyse sil, farkli renkteyse rengini degistir.
        if (next[same].color === color) next.splice(same, 1);
        else next[same] = { from, to, color };
        return next;
      }
      return [...prev, { from, to, color }];
    });
  }, []);

  /** Kare boyama geri çağrısını sarar: ok çizildiyse boyama yapılmaz. */
  const guardSquarePaint = useCallback(
    (paint: (args: { square: string }) => void) => (args: { square: string }) => {
      if (drewRef.current) { drewRef.current = false; return; }
      paint(args);
    },
    [],
  );

  const clearArrows = useCallback(() => setArrows([]), []);

  return { arrows, onPointerDown, onPointerUp, guardSquarePaint, clearArrows };
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export type AnnotationColor = 'green' | 'red' | 'blue' | 'yellow';

const COLORS: Record<AnnotationColor, string> = {
  green: 'rgba(74, 222, 128, 0.55)',
  red: 'rgba(248, 113, 113, 0.55)',
  blue: 'rgba(96, 165, 250, 0.55)',
  yellow: 'rgba(250, 204, 21, 0.55)',
};

function colorForModifiers(ctrl: boolean, alt: boolean): AnnotationColor {
  if (ctrl && alt) return 'yellow';
  if (ctrl) return 'red';
  if (alt) return 'blue';
  return 'green';
}

/**
 * Sağ-tık ile kare renklendirme — Zafer Hoca ve sporcunun tahtada hesap
 * yaparken odaklanmak için kullandığı TAMAMEN GEÇİCİ bir görsel araç.
 * Hiçbir yere kaydedilmez, hiçbir soru verisini etkilemez.
 *
 * Sade sağ-tık: yeşil · Ctrl+sağ-tık: kırmızı · Alt+sağ-tık: mavi ·
 * Ctrl+Alt+sağ-tık: sarı. Aynı kareye aynı renkle tekrar tıklamak temizler.
 *
 * resetKey değiştiğinde (örn. FEN değişince/yeni soru açılınca) tüm
 * işaretler otomatik temizlenir — eski işaretler yeni bağlamı yanıltmasın.
 */
export function useSquareAnnotations(resetKey: unknown): {
  squareStyles: Record<string, CSSProperties>;
  onSquareRightClick: (args: { square: string }) => void;
} {
  const [marks, setMarks] = useState<Record<string, AnnotationColor>>({});
  const ctrlDown = useRef(false);
  const altDown = useRef(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Control') ctrlDown.current = true;
      if (e.key === 'Alt') altDown.current = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Control') ctrlDown.current = false;
      if (e.key === 'Alt') altDown.current = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMarks({}); }, [resetKey]);

  const onSquareRightClick = useCallback(({ square }: { square: string }) => {
    const color = colorForModifiers(ctrlDown.current, altDown.current);
    setMarks((prev) => {
      if (prev[square] === color) {
        const next = { ...prev };
        delete next[square];
        return next;
      }
      return { ...prev, [square]: color };
    });
  }, []);

  const squareStyles: Record<string, CSSProperties> = {};
  for (const [sq, color] of Object.entries(marks)) {
    squareStyles[sq] = { backgroundColor: COLORS[color] };
  }

  return { squareStyles, onSquareRightClick };
}

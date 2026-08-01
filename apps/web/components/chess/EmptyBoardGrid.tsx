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

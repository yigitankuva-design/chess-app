'use client';
import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import type { CSSProperties } from 'react';
import { BOARD_CARD_BG, BOARD_STYLE, getBoardColors, getPieceSet } from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { ringStyle, RING_GREEN } from '@/lib/chess/squareMarker';

interface Props {
  /** "Konumu Kaydet" ile kilitlenen konum. */
  fen: string;
  /** Seçili cevap kareleri — halka ile işaretlenir. */
  marked: string[];
}

/**
 * Cevap kurulurken kaydedilmiş konumu gösteren SALT-OKUNUR tahta.
 *
 * Tıklanabilir DEĞİL: kare seçimi soldaki kare listesinden yapılır. İki ayrı
 * tıklama yolu olsaydı hangi tıklamanın ne yaptığı belirsizleşirdi.
 */
export function SavedPositionBoard({ fen, marked }: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  const squareStyles: Record<string, CSSProperties> = {};
  marked.forEach((sq) => { squareStyles[sq] = ringStyle(RING_GREEN); });

  return (
    <div
      data-testid="saved-position-board"
      className="rounded-xl p-2 flex-shrink-0"
      style={{ backgroundColor: BOARD_CARD_BG, width: 240 }}
    >
      <div className="aspect-square" style={BOARD_STYLE}>
        <Chessboard
          options={{
            position: fen,
            allowDragging: false,
            pieces: pieceSet,
            lightSquareStyle: { backgroundColor: boardColors.light },
            darkSquareStyle: { backgroundColor: boardColors.dark },
            showNotation: false,
            squareStyles,
          }}
        />
      </div>
      <p className="text-xs n-muted text-center mt-1">Kaydedilen konum</p>
    </div>
  );
}

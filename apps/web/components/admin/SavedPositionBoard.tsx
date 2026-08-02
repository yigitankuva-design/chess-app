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
  /**
   * Verilirse tahta TIKLANABİLİR olur ve tıklanan karenin adı bildirilir.
   * Verilmezse tahta salt-okunur kalır (B grubundaki kullanım böyle).
   */
  onSquareClick?: (square: string) => void;
}

/**
 * Cevap kurulurken kaydedilmiş konumu gösteren tahta.
 *
 * VARSAYILAN salt-okunurdur — "Kareye Tıkla" adımında yanında bir kare listesi
 * var ve seçim oradan yapılır; tahta da tıklanabilir olsaydı hangi tıklamanın ne
 * yaptığı belirsizleşirdi.
 *
 * `onSquareClick` verilirse tıklanabilir olur — "Taşa Tıkla" tipinde cevap
 * doğrudan tahtadan (taşa tıklayarak) seçilir, ayrı bir liste yoktur.
 */
export function SavedPositionBoard({ fen, marked, onSquareClick }: Props) {
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
            onSquareClick: onSquareClick
              ? ({ square }: { square: string }) => onSquareClick(square)
              : undefined,
          }}
        />
      </div>
      <p className="text-xs n-muted text-center mt-1">Kaydedilen konum</p>
    </div>
  );
}

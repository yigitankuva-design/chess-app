'use client';
import { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';

interface ChessBoardProps {
  fen: string;
  interactive?: boolean;
  highlightSquares?: Square[];
  onSquareClick?: (square: Square) => void;
  onPieceDrop?: (from: Square, to: Square) => boolean;
  boardOrientation?: 'white' | 'black';
}

export function ChessBoard({
  fen,
  interactive = false,
  highlightSquares = [],
  onSquareClick,
  onPieceDrop,
  boardOrientation = 'white',
}: ChessBoardProps) {
  const [clickedSquare, setClickedSquare] = useState<Square | null>(null);

  const customSquareStyles: Record<string, React.CSSProperties> = {};
  highlightSquares.forEach((sq) => {
    customSquareStyles[sq] = { backgroundColor: 'rgba(255, 217, 102, 0.5)' };
  });
  if (clickedSquare) {
    customSquareStyles[clickedSquare] = {
      ...customSquareStyles[clickedSquare],
      backgroundColor: 'rgba(72, 187, 120, 0.4)',
    };
  }

  return (
    <div className="aspect-square w-full max-w-[600px] mx-auto">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: boardOrientation,
          allowDragging: interactive,
          onPieceDrop: onPieceDrop
            ? ({ sourceSquare, targetSquare }) =>
                onPieceDrop(sourceSquare as Square, targetSquare as Square)
            : undefined,
          onSquareClick: ({ square }) => {
            setClickedSquare(square as Square);
            onSquareClick?.(square as Square);
          },
          squareStyles: customSquareStyles,
        }}
      />
    </div>
  );
}

'use client';
import { useState, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import { useChessTheme } from '@/lib/chess-theme-context';
import { buildSquareStyles } from '@/lib/chess-themes';
import type { CSSProperties } from 'react';

interface ChessBoardProps {
  fen: string;
  interactive?: boolean;
  highlightSquares?: Square[];
  onSquareClick?: (square: Square) => void;
  onPieceDrop?: (from: Square, to: Square) => boolean;
  boardOrientation?: 'white' | 'black';
  lastMove?: { from: Square; to: Square } | null;
  inCheck?: boolean;
}

export function ChessBoard({
  fen,
  interactive = false,
  highlightSquares = [],
  onSquareClick,
  onPieceDrop,
  boardOrientation = 'white',
  lastMove = null,
  inCheck = false,
}: ChessBoardProps) {
  const [clickedSquare, setClickedSquare] = useState<Square | null>(null);
  const { theme, themeId } = useChessTheme();
  const [shaking, setShaking] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const prevFen = useRef(fen);

  // Detect capture (piece count change) for arcade flash
  useEffect(() => {
    if (themeId === 'arcade' && fen !== prevFen.current) {
      const countPieces = (f: string) =>
        f.split('').filter((c) => /[prnbqkPRNBQK]/.test(c)).length;
      if (countPieces(fen) < countPieces(prevFen.current)) {
        setCaptureFlash(true);
        setTimeout(() => setCaptureFlash(false), 350);
      }
    }
    prevFen.current = fen;
  }, [fen, themeId]);

  // Screen shake on check
  useEffect(() => {
    if (inCheck && (themeId === 'arcade' || themeId === 'hologram')) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  }, [inCheck, themeId]);

  // Build per-square style overrides
  const overrides: Record<string, CSSProperties> = {};

  highlightSquares.forEach((sq) => {
    overrides[sq] = { backgroundColor: theme.highlightColor };
  });

  if (clickedSquare) {
    overrides[clickedSquare] = {
      ...overrides[clickedSquare],
      backgroundColor: theme.selectedColor,
    };
  }

  if (lastMove) {
    [lastMove.from, lastMove.to].forEach((sq) => {
      overrides[sq] = {
        ...overrides[sq],
        backgroundColor: theme.lastMoveColor,
      };
    });
  }

  const squareStyles = buildSquareStyles(theme, overrides);

  const wrapperClasses = [
    'aspect-square w-full max-w-[600px] mx-auto relative',
    themeId === 'hologram' ? 'hologram-board' : '',
    themeId === 'arcade' ? 'arcade-board' : '',
    shaking ? 'board-shake' : '',
    captureFlash ? 'capture-flash' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperStyle: CSSProperties = {};
  if (theme.boardShadow) {
    wrapperStyle.boxShadow = theme.boardShadow;
    wrapperStyle.borderRadius = '4px';
  }

  return (
    <div className={wrapperClasses} style={wrapperStyle}>
      {/* Hologram scan-line overlay */}
      {themeId === 'hologram' && (
        <div className="hologram-scanlines pointer-events-none" aria-hidden="true" />
      )}
      {/* Hologram corner decorations */}
      {themeId === 'hologram' && (
        <>
          <div className="hologram-corner hologram-corner-tl" />
          <div className="hologram-corner hologram-corner-tr" />
          <div className="hologram-corner hologram-corner-bl" />
          <div className="hologram-corner hologram-corner-br" />
        </>
      )}
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
          squareStyles,
        }}
      />
    </div>
  );
}

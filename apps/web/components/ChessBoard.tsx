'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
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
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const { theme } = useChessTheme();
  const scrollRef = useRef(0);

  // Clear selection when FEN changes (after a move)
  useEffect(() => {
    setSelectedSquare(null);
    setValidMoves([]);
  }, [fen]);

  // Save scroll position before any board interaction, restore after render
  const saveScroll = useCallback(() => {
    scrollRef.current = window.scrollY;
  }, []);

  const restoreScroll = useCallback(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollRef.current, behavior: 'instant' as ScrollBehavior });
    });
  }, []);

  function getValidDestinations(square: Square, chessFen: string): Square[] {
    try {
      const chess = new Chess(chessFen);
      return chess
        .moves({ square, verbose: true })
        .map((m) => m.to as Square);
    } catch {
      return [];
    }
  }

  function getPieceColor(square: Square, chessFen: string): 'w' | 'b' | null {
    try {
      const chess = new Chess(chessFen);
      const piece = chess.get(square);
      return piece ? piece.color : null;
    } catch {
      return null;
    }
  }

  function getTurnColor(chessFen: string): 'w' | 'b' {
    try {
      const chess = new Chess(chessFen);
      return chess.turn();
    } catch {
      return 'w';
    }
  }

  function handleSquareClick(square: Square) {
    if (!interactive) return;
    saveScroll();

    const turn = getTurnColor(fen);

    // If a piece is already selected and this square is a valid move → execute move
    if (selectedSquare && validMoves.includes(square)) {
      const success = onPieceDrop?.(selectedSquare, square) ?? false;
      setSelectedSquare(null);
      setValidMoves([]);
      if (!success) {
        restoreScroll();
      }
      return;
    }

    // Click on a piece of current turn color → select it
    const pieceColor = getPieceColor(square, fen);
    if (pieceColor === turn) {
      setSelectedSquare(square);
      setValidMoves(getValidDestinations(square, fen));
      restoreScroll();
      return;
    }

    // Anything else → deselect
    setSelectedSquare(null);
    setValidMoves([]);
    onSquareClick?.(square);
    restoreScroll();
  }

  // Build per-square style overrides
  const overrides: Record<string, CSSProperties> = {};

  highlightSquares.forEach((sq) => {
    overrides[sq] = { backgroundColor: theme.highlightColor };
  });

  if (selectedSquare) {
    overrides[selectedSquare] = {
      ...overrides[selectedSquare],
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

  // Valid-move dot overlays — added as background gradients on top of square color
  validMoves.forEach((sq) => {
    const hasPiece = getPieceColor(sq, fen) !== null;
    const base = overrides[sq]?.backgroundColor as string | undefined;
    overrides[sq] = {
      ...overrides[sq],
      background: hasPiece
        // Capture ring
        ? `radial-gradient(circle, transparent 58%, rgba(0,0,0,0.2) 59%, rgba(0,0,0,0.2) 68%, transparent 69%) ${base ?? 'unset'}`
        // Empty dot
        : `radial-gradient(circle, rgba(0,0,0,0.22) 28%, transparent 29%)`,
      cursor: 'pointer',
    };
  });

  const squareStyles = buildSquareStyles(theme, overrides);

  return (
    <div
      className="aspect-square w-full max-w-[600px] mx-auto relative"
      style={{ touchAction: 'none', boxShadow: theme.boardShadow, borderRadius: theme.boardShadow ? '4px' : undefined }}
      onPointerDown={saveScroll}
    >
      <Chessboard
        options={{
          position: fen,
          boardOrientation,
          allowDragging: interactive,
          onPieceDrop: onPieceDrop
            ? ({ sourceSquare, targetSquare }) => {
                saveScroll();
                const result = onPieceDrop(sourceSquare as Square, targetSquare as Square);
                restoreScroll();
                return result;
              }
            : undefined,
          onSquareClick: ({ square }) => {
            handleSquareClick(square as Square);
          },
          squareStyles,
        }}
      />
    </div>
  );
}

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { useChessTheme } from '@/lib/chess-theme-context';
import { buildSquareStyles } from '@/lib/chess-themes';
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useSquareAnnotations } from '@/lib/chess/useSquareAnnotations';
import { useBoardArrows } from '@/lib/chess/useBoardArrows';
import { arrowLine } from '@/lib/chess/arrowGeometry';

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
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);
  const scrollRef = useRef(0);
  const scrollLockRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { squareStyles: annotationStyles, onSquareRightClick } = useSquareAnnotations(fen);
  // Madde 7: oklar kendimiz ciziyoruz — kutuphane At hamlesini "L" cizer.
  const { arrows, onPointerDown, onPointerUp, guardSquarePaint } = useBoardArrows(fen);

  // Clear selection when FEN changes (after a move)
  useEffect(() => {
    setSelectedSquare(null);
    setValidMoves([]);
  }, [fen]);

  // Lock the scroll position for `ms` ms — any scroll event during that window is cancelled
  const lockScroll = useCallback((ms = 300) => {
    const y = window.scrollY;
    scrollRef.current = y;
    if (scrollLockRef.current) clearTimeout(scrollLockRef.current);
    const handler = () => { window.scrollTo(0, y); };
    window.addEventListener('scroll', handler, { passive: true });
    scrollLockRef.current = setTimeout(() => {
      window.removeEventListener('scroll', handler);
    }, ms);
  }, []);

  const saveScroll = useCallback(() => {
    scrollRef.current = window.scrollY;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const restoreScroll = useCallback(() => {
    window.scrollTo(0, scrollRef.current);
  }, []);

  // ŞAHSIZ POZİSYON DESTEĞİ: Zafer Hoca'nın öğretim pozisyonları kasten şahsızdır
  // (boş tahta + tek piyon). skipValidation olmadan chess.js "Invalid FEN: missing
  // white king" fırlatır, catch bloğu boş liste döndürür ve tıkla-oynat SESSİZCE
  // çalışmaz (ölçüldü: onPieceDrop 0 kez çağrılıyordu). skipValidation yalnızca FEN
  // doğrulamasını atlar — geçerli pozisyonlarda davranış birebir aynı kalır.
  function getValidDestinations(square: Square, chessFen: string): Square[] {
    try {
      const chess = new Chess(chessFen, { skipValidation: true });
      return chess
        .moves({ square, verbose: true })
        .map((m) => m.to as Square);
    } catch {
      return [];
    }
  }

  function getPieceColor(square: Square, chessFen: string): 'w' | 'b' | null {
    try {
      const chess = new Chess(chessFen, { skipValidation: true });
      const piece = chess.get(square);
      return piece ? piece.color : null;
    } catch {
      return null;
    }
  }

  function getTurnColor(chessFen: string): 'w' | 'b' {
    try {
      const chess = new Chess(chessFen, { skipValidation: true });
      return chess.turn();
    } catch {
      return 'w';
    }
  }

  function handleSquareClick(square: Square) {
    if (!interactive) return;
    lockScroll();

    const turn = getTurnColor(fen);

    // If a piece is already selected and this square is a valid move → execute move
    if (selectedSquare && validMoves.includes(square)) {
      onPieceDrop?.(selectedSquare, square);
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    // Click on a piece of current turn color → select it
    const pieceColor = getPieceColor(square, fen);
    if (pieceColor === turn) {
      setSelectedSquare(square);
      setValidMoves(getValidDestinations(square, fen));
      return;
    }

    // Anything else → deselect
    setSelectedSquare(null);
    setValidMoves([]);
    onSquareClick?.(square);
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

  const squareStyles: Record<string, CSSProperties> = {
    ...buildSquareStyles(theme, overrides, { light: boardColors.light, dark: boardColors.dark }),
  };
  for (const [sq, style] of Object.entries(annotationStyles)) {
    squareStyles[sq] = { ...squareStyles[sq], ...style };
  }

  const { ranks, files } = coordLabels(boardOrientation);
  const coordFontSize = 'clamp(11px, 3.2vw, 15px)';
  const coordLabelWidth = 'clamp(16px, 4.5vw, 22px)';

  return (
    <div
      className="w-full max-w-[600px] mx-auto p-3 rounded-2xl"
      style={{ backgroundColor: BOARD_CARD_BG }}
    >
      <div className="flex">
        <div
          className="grid shrink-0"
          style={{ gridTemplateRows: 'repeat(8, 1fr)', width: coordLabelWidth }}
        >
          {ranks.map((r) => (
            <span
              key={r}
              className="flex items-center justify-center font-semibold select-none"
              style={{ fontSize: coordFontSize, color: BOARD_LABEL_COLOR }}
            >
              {r}
            </span>
          ))}
        </div>

        <div
          className="aspect-square flex-1 relative"
          style={{ touchAction: 'none', ...BOARD_STYLE }}
          onPointerDown={(e) => { lockScroll(400); onPointerDown(e); }}
          onPointerUp={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Chessboard
            options={{
              position: fen,
              boardOrientation,
              allowDragging: interactive,
                  onPieceDrop: onPieceDrop
                ? ({ sourceSquare, targetSquare }) => {
                    lockScroll(400);
                    return onPieceDrop(sourceSquare as Square, targetSquare as Square);
                  }
                : undefined,
              onSquareClick: ({ square }) => {
                handleSquareClick(square as Square);
              },
              onSquareRightClick: guardSquarePaint(onSquareRightClick),
              // Kutuphanenin oklari KAPALI: At hamlesini L cizdigi icin
              // (madde 7) ok cizimini kendi katmanimiz yapar.
              allowDrawingArrows: false,
              squareStyles,
              pieces: pieceSet,
              lightSquareStyle: { backgroundColor: boardColors.light },
              darkSquareStyle: { backgroundColor: boardColors.dark },
              showNotation: false,
            }}
          />

          {/* Ok katmani: taslarin USTUNDE ama tiklamayi ENGELLEMEZ. */}
          {arrows.length > 0 && (
            <svg
              aria-hidden="true"
              viewBox="0 0 8 8"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: 'none' }}
            >
              <defs>
                {arrows.map((a, i) => (
                  <marker key={i} id={`bsa-ok-${i}`} markerWidth="3.2" markerHeight="3.2"
                    refX="2.2" refY="1.6" orient="auto">
                    <path d="M0,0 L3.2,1.6 L0,3.2 z" fill={a.color} />
                  </marker>
                ))}
              </defs>
              {arrows.map((a, i) => {
                const l = arrowLine(a.from, a.to, boardOrientation);
                if (!l) return null;
                return (
                  <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke={a.color} strokeWidth={0.16} strokeLinecap="round"
                    markerEnd={`url(#bsa-ok-${i})`} />
                );
              })}
            </svg>
          )}
        </div>
      </div>

      <div className="flex" style={{ paddingLeft: coordLabelWidth }}>
        {files.map((f) => (
          <span
            key={f}
            className="flex-1 text-center font-semibold select-none"
            style={{ fontSize: coordFontSize, color: BOARD_LABEL_COLOR }}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

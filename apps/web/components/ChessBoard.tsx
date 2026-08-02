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
  /** Verilirse tahta üzerindeki fare tekerleği hamle geçmişinde adım atar
   *  (madde 1). +1 ileri, -1 geri. Verilmezse tekerlek ENGELLENMEZ —
   *  sayfa kaydırma davranışı aynen korunur. */
  onWheelStep?: (delta: 1 | -1) => void;
  /** Sıra rakipteyken (interactive=false) sporcunun ÖN-HAMLE seçmesine izin
   *  verir (madde 5). Hamle OYNANMAZ — yalnız seçim bildirilir. */
  onPremove?: (from: Square, to: Square) => void;
  /** Ön-hamle verebilecek tarafın rengi. Yalnız bu renkteki taşlar seçilir. */
  premoveColor?: 'w' | 'b';
  /** Seçilmiş ön-hamle — iki karesi işaretlenir. */
  premoveSquares?: { from: Square; to: Square } | null;
  /** Sporcu geçmiş bir hamleye bakıyor (salt-okunur). Bu haldeyken tahtaya
   *  dokunmak taş oynatmaz — TEK DOKUNUŞLA canlıya döndürür (madde 1 kilit
   *  tuzağı düzeltmesi). Yanlışlıkla tekerlek çevirince taşlar donuk kalmasın. */
  historyView?: boolean;
  /** Geçmiş görünümündeyken tahtaya dokununca çağrılır (canlıya dön). */
  onLeaveHistory?: () => void;
}

export function ChessBoard({
  fen,
  interactive = false,
  highlightSquares = [],
  onSquareClick,
  onPieceDrop,
  boardOrientation = 'white',
  lastMove = null,
  onWheelStep,
  onPremove,
  premoveColor,
  premoveSquares = null,
  historyView = false,
  onLeaveHistory,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const { theme } = useChessTheme();
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);
  const scrollRef = useRef(0);
  const scrollLockRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardBoxRef = useRef<HTMLDivElement>(null);
  const { squareStyles: annotationStyles, onSquareRightClick, clearAnnotations } = useSquareAnnotations(fen);
  // Madde 7: oklar kendimiz ciziyoruz — kutuphane At hamlesini "L" cizer.
  const { arrows, onPointerDown, onPointerUp, guardSquarePaint, clearArrows } = useBoardArrows(fen);

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
    /* Sporcu tekerlegi cevirir VEYA parmagiyla kaydirmaya baslarsa kaydirmak
       ISTIYOR demektir — kilit ANINDA kalkar (madde 11/3). 'wheel' fare icin,
       'touchmove' telefon/tablet icin: touch-action:pan-y tahtada dikey
       kaydirmaya izin veriyor ama bu kilit oluşan 'scroll' olayini geri
       ALIYORDU — telefonda tahtaya dokunan sporcu 300-400ms boyunca sayfayi
       kaydiramiyordu. Ikisi de eklenmezse sadece fare duzelirdi. */
    const release = () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchmove', release);
      if (scrollLockRef.current) clearTimeout(scrollLockRef.current);
    };
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchmove', release, { passive: true });
    scrollLockRef.current = setTimeout(release, ms);
  }, []);

  // Tekerlek dinleyicisi YALNIZCA tahta kutusuna baglanir ve
  // { passive: false } ile eklenir — React'in onWheel'i preventDefault
  // garantisi vermiyor. Sayfa govdesindeki kaydirma ve lockScroll'un
  // wheel'de serbest birakma mantigi DEGISMEZ (regresyon riski).
  useEffect(() => {
    const el = boardBoxRef.current;
    if (!el || !onWheelStep) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      onWheelStep(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [onWheelStep]);

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
    // Madde 1: herhangi bir kareye tiklaninca renkli oklar/kareler kalkar.
    // interactive=false olsa bile (salt-okunur tahtalarda) calisir; kutuphane
    // bu geri cagriyi HER durumda tetikler.
    clearAnnotations();
    clearArrows();
    // GEÇMİŞ TUZAĞI: sporcu eski hamleye bakarken tahtaya dokununca taşlar
    // donuk kalmasın — tek dokunuş canlıya döndürür (ön-hamleden ÖNCE gelir).
    if (historyView) {
      onLeaveHistory?.();
      return;
    }
    // ÖN-HAMLE: sıra rakipteyken sporcu hamlesini önceden seçebilir (madde 5).
    // Hamle OYNANMAZ; yalnız seçim yukarı bildirilir.
    if (!interactive) {
      if (!onPremove || !premoveColor) return;
      if (selectedSquare) {
        // Ikinci tik: hedef kare. Kendi tasina tekrar tiklarsa secim degisir.
        if (getPieceColor(square, fen) === premoveColor) {
          setSelectedSquare(square);
          return;
        }
        onPremove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }
      // Ilk tik: yalnizca KENDI tasi secilebilir.
      if (getPieceColor(square, fen) === premoveColor) setSelectedSquare(square);
      return;
    }
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

  // Ön-hamle kareleri belirgin turuncuyla işaretlenir (madde 5).
  if (premoveSquares) {
    [premoveSquares.from, premoveSquares.to].forEach((sq) => {
      overrides[sq] = {
        ...overrides[sq],
        backgroundColor: 'rgba(255, 170, 0, 0.55)',
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
          ref={boardBoxRef}
          data-bsa-board=""
          className="aspect-square flex-1 relative"
          /* Madde 11: 'none' dokunmatikte sayfa kaydirmayi TAMAMEN engelliyordu.
             'pan-y' ile parmakla yukari-asagi kaydirma calisir; tasi tiklayarak
             oynatma ve yatay surukleme bozulmaz. */
          style={{ touchAction: 'pan-y', ...BOARD_STYLE }}
          onPointerDown={(e) => { lockScroll(400); onPointerDown(e); }}
          onPointerUp={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Chessboard
            options={{
              position: fen,
              boardOrientation,
              allowDragging: interactive || !!onPremove,
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                lockScroll(400);
                // Geçmişe bakarken taş sürüklenirse hamle YAPILMAZ; canlıya döner.
                if (historyView) {
                  onLeaveHistory?.();
                  return false;
                }
                // Sıra rakipteyse gerçek hamle YAPILMAZ; seçim ön-hamle
                // olarak alınır ve taş yerine geri döner (false).
                if (!interactive) {
                  if (onPremove && premoveColor
                      && getPieceColor(sourceSquare as Square, fen) === premoveColor) {
                    onPremove(sourceSquare as Square, targetSquare as Square);
                  }
                  return false;
                }
                return onPieceDrop
                  ? onPieceDrop(sourceSquare as Square, targetSquare as Square)
                  : false;
              },
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

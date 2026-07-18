'use client';
import type { CSSProperties } from 'react';

/**
 * "tahta.jpeg" referansına göre sistem genelinde tek tip tahta görünümü:
 * açık lavanta/beyaz kareler + düz siluet taşlar + tahtanın dışında rakam/harf.
 * ChessBoard.tsx (kullanıcı: oyun/bulmaca/dersler) ve BoardEditor.tsx (admin
 * soru ekleme) burayı paylaşır — biri değişince hepsi güncellenir.
 */

export const BOARD_LIGHT_SQUARE = '#eef0fb';
export const BOARD_DARK_SQUARE = '#c3c6ee';
export const BOARD_CARD_BG = '#ffffff';
export const BOARD_LABEL_COLOR = '#6b7280';

export const LIGHT_SQUARE_STYLE: CSSProperties = { backgroundColor: BOARD_LIGHT_SQUARE };
export const DARK_SQUARE_STYLE: CSSProperties = { backgroundColor: BOARD_DARK_SQUARE };
export const BOARD_STYLE: CSSProperties = { borderRadius: '10px', overflow: 'hidden' };

type PieceCode = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

function paint(isWhite: boolean) {
  return {
    fill: isWhite ? '#ffffff' : '#1a1a1a',
    stroke: '#1a1a1a',
    strokeWidth: isWhite ? 1.6 : 1,
  };
}

function Base({ isWhite, wide = false }: { isWhite: boolean; wide?: boolean }) {
  const p = paint(isWhite);
  return wide
    ? <rect x="7" y="33" width="31" height="4" rx="1.5" {...p} />
    : <rect x="12" y="33" width="21" height="4" rx="1.5" {...p} />;
}

function Pawn({ isWhite }: { isWhite: boolean }) {
  const p = paint(isWhite);
  return (
    <>
      <circle cx="22.5" cy="13" r="6" {...p} />
      <path d="M16.5 19 Q22.5 16.5 28.5 19 L31 33 L14 33 Z" {...p} />
      <Base isWhite={isWhite} />
    </>
  );
}

function Knight({ isWhite }: { isWhite: boolean }) {
  const p = paint(isWhite);
  return (
    <>
      <path
        d="M9 33 L9 29 C9 25 11 22 14 20 C12 18 11 15 13 13
           C14 11.5 16.5 11.5 17.5 13 C18.5 11 21 9.5 24 9.5
           C29 9.5 33 12.5 34.5 17 C35.5 20 34.5 23 32 24
           C30.5 24.7 29 24.5 28 23.5 L28.5 20.5
           C28.5 19 27 18 25.5 18 C24 18 22.7 19 22 20.5
           L19.5 26.5 C19 28.5 19 31 20 33 Z"
        {...p}
      />
      <circle cx="15.2" cy="16.3" r="0.9" fill={isWhite ? '#1a1a1a' : '#ffffff'} stroke="none" />
      <Base isWhite={isWhite} />
    </>
  );
}

function Bishop({ isWhite }: { isWhite: boolean }) {
  const p = paint(isWhite);
  const slit = isWhite ? '#1a1a1a' : '#ffffff';
  return (
    <>
      <circle cx="22.5" cy="7" r="2.1" {...p} />
      <path
        d="M14.5 33 C13.5 26 16.5 20.5 20.5 17.5 C17.5 15.5 17.5 12 19.5 10
           C21 8.5 24 8.5 25.5 10 C27.5 12 27.5 15.5 24.5 17.5
           C28.5 20.5 31.5 26 30.5 33 Z"
        {...p}
      />
      <line x1="18.8" y1="16.5" x2="24" y2="11" stroke={slit} strokeWidth="1.3" strokeLinecap="round" />
      <Base isWhite={isWhite} />
    </>
  );
}

function Queen({ isWhite }: { isWhite: boolean }) {
  const p = paint(isWhite);
  return (
    <>
      {[13, 18, 22.5, 27, 32].map((cx, i) => (
        <circle key={cx} cx={cx} cy={i === 2 ? 7.5 : 9.5} r="2" {...p} />
      ))}
      <path
        d="M12.5 33 C11.5 25 14.5 19.5 18.5 16.5 C15.5 15 15.5 12 22.5 12
           C29.5 12 29.5 15 26.5 16.5 C30.5 19.5 33.5 25 32.5 33 Z"
        {...p}
      />
      <Base isWhite={isWhite} wide />
    </>
  );
}

function King({ isWhite }: { isWhite: boolean }) {
  const p = paint(isWhite);
  return (
    <>
      <rect x="21.3" y="2" width="2.4" height="7" {...p} />
      <rect x="18.5" y="4.2" width="8" height="2.4" {...p} />
      <rect x="16" y="9.5" width="13" height="3.2" rx="1" {...p} />
      <path
        d="M13.5 33 C12.5 25 15.5 19.5 19.5 16.5 C16.5 15 16.5 13 22.5 13
           C28.5 13 28.5 15 25.5 16.5 C29.5 19.5 32.5 25 31.5 33 Z"
        {...p}
      />
      <Base isWhite={isWhite} wide />
    </>
  );
}

function Rook({ isWhite }: { isWhite: boolean }) {
  const p = paint(isWhite);
  return (
    <>
      <path d="M8 15 L8 8 L14 8 L14 11 L20.5 11 L20.5 8 L24.5 8 L24.5 11 L31 11 L31 8 L37 8 L37 15 Z" {...p} />
      <rect x="9" y="14.5" width="27" height="3" {...p} />
      <path d="M12 17.5 L33 17.5 L31 33 L14 33 Z" {...p} />
      <Base isWhite={isWhite} wide />
    </>
  );
}

const SHAPES: Record<'P' | 'N' | 'B' | 'R' | 'Q' | 'K', (props: { isWhite: boolean }) => React.JSX.Element> = {
  P: Pawn, N: Knight, B: Bishop, R: Rook, Q: Queen, K: King,
};

function makePieceIcon(code: PieceCode) {
  const isWhite = code === code.toUpperCase();
  const Shape = SHAPES[code.toUpperCase() as keyof typeof SHAPES];
  function PieceIcon(props?: { svgStyle?: CSSProperties }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
        <Shape isWhite={isWhite} />
      </svg>
    );
  }
  PieceIcon.displayName = `ChessPieceIcon_${code}`;
  return PieceIcon;
}

export const CHESS_PIECE_SET = {
  wP: makePieceIcon('P'), wN: makePieceIcon('N'), wB: makePieceIcon('B'),
  wR: makePieceIcon('R'), wQ: makePieceIcon('Q'), wK: makePieceIcon('K'),
  bP: makePieceIcon('p'), bN: makePieceIcon('n'), bB: makePieceIcon('b'),
  bR: makePieceIcon('r'), bQ: makePieceIcon('q'), bK: makePieceIcon('k'),
};

export function coordLabels(orientation: 'white' | 'black') {
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white'
    ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
  return { ranks, files };
}

// --- Ayara göre override (Faz 3-4) -----------------------------------------
// settings.board.lightSquare/darkSquare varsa onu kullan; yoksa varsayılan.
export function getBoardColors(board?: { lightSquare?: string; darkSquare?: string }) {
  return {
    light: board?.lightSquare || BOARD_LIGHT_SQUARE,
    dark: board?.darkSquare || BOARD_DARK_SQUARE,
  };
}

export const PIECE_KEYS = [
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP',
] as const;

/** Özel taş görseli (data-URI) varsa <img> ile, yoksa gömülü SVG ile taş seti döner. */
export function getPieceSet(pieces?: Record<string, string>): typeof CHESS_PIECE_SET {
  if (!pieces || Object.keys(pieces).length === 0) return CHESS_PIECE_SET;
  const set = { ...CHESS_PIECE_SET } as Record<string, (props?: { svgStyle?: CSSProperties }) => React.JSX.Element>;
  for (const k of PIECE_KEYS) {
    const uri = pieces[k];
    if (uri) {
      const CustomPiece = (props?: { svgStyle?: CSSProperties }) => (
        <img src={uri} alt={k} draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', ...props?.svgStyle }} />
      );
      CustomPiece.displayName = `CustomPiece_${k}`;
      set[k] = CustomPiece;
    }
  }
  return set as typeof CHESS_PIECE_SET;
}

'use client';
import type { CSSProperties } from 'react';
import { defaultPieces } from 'react-chessboard';

/**
 * Sistem genelinde tek tip tahta görünümü:
 * açık lavanta/beyaz kareler + tahtanın dışında rakam/harf + klasik taşlar.
 * Taşlar "tahtacan.jpeg" referansıyla birebir aynı olsun diye react-chessboard'un
 * kendi klasik (Cburnett) taş seti (defaultPieces) kullanılır — el çizimi taklit değil.
 * ChessBoard.tsx (kullanıcı) ve BoardEditor.tsx (admin soru ekleme) burayı paylaşır.
 */

export const BOARD_LIGHT_SQUARE = '#eef0fb';
export const BOARD_DARK_SQUARE = '#c3c6ee';
export const BOARD_CARD_BG = '#ffffff';
export const BOARD_LABEL_COLOR = '#6b7280';

export const LIGHT_SQUARE_STYLE: CSSProperties = { backgroundColor: BOARD_LIGHT_SQUARE };
export const DARK_SQUARE_STYLE: CSSProperties = { backgroundColor: BOARD_DARK_SQUARE };
export const BOARD_STYLE: CSSProperties = { borderRadius: '10px', overflow: 'hidden' };

// Klasik standart satranç taşları (Wikipedia/Cburnett stili) — görseldekiyle birebir.
export const CHESS_PIECE_SET = defaultPieces;

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

/** Özel taş görseli (data-URI) varsa <img> ile, yoksa klasik taş seti ile döner. */
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

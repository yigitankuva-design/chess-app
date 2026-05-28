import { Chess, Square } from 'chess.js';

export type ChessSquare = Square;

export function isValidMove(fen: string, from: ChessSquare, to: ChessSquare): boolean {
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from, to, promotion: 'q' });
    return move !== null;
  } catch {
    return false;
  }
}

export function getLegalSquares(fen: string, from: ChessSquare): ChessSquare[] {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ square: from, verbose: true });
    return moves.map((m) => m.to as ChessSquare);
  } catch {
    return [];
  }
}

export function makeMove(fen: string, from: ChessSquare, to: ChessSquare): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from, to, promotion: 'q' });
    return move ? chess.fen() : null;
  } catch {
    return null;
  }
}

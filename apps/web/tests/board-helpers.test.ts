import { describe, it, expect } from 'vitest';
import { isValidMove, getLegalSquares, makeMove } from '@/lib/chess/board-helpers';

const INITIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('board-helpers', () => {
  it('isValidMove accepts e2-e4', () => {
    expect(isValidMove(INITIAL, 'e2', 'e4')).toBe(true);
  });

  it('isValidMove rejects e2-e5', () => {
    expect(isValidMove(INITIAL, 'e2', 'e5')).toBe(false);
  });

  it('getLegalSquares for knight b1 returns a3 and c3', () => {
    const squares = getLegalSquares(INITIAL, 'b1');
    expect(squares).toContain('a3');
    expect(squares).toContain('c3');
  });

  it('makeMove returns new FEN after e2-e4', () => {
    const fen = makeMove(INITIAL, 'e2', 'e4');
    expect(fen).not.toBeNull();
    expect(fen).toContain(' b ');  // black to move now
  });
});

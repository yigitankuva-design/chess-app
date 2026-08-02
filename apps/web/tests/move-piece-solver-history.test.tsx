import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    async bestMove() { return 'e7e5'; }
    destroy() {}
  },
}));

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, interactive, onWheelStep }: {
    fen: string; interactive?: boolean; onWheelStep?: (d: 1 | -1) => void;
  }) => (
    <div
      data-testid="board"
      data-fen={fen}
      data-interactive={String(!!interactive)}
      data-has-wheel={String(!!onWheelStep)}
    />
  ),
}));

import { MovePieceSolver } from '@/components/lesson-steps/MovePieceSolver';

const EXERCISE = {
  type: 'move_piece' as const,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e4', 'e5'],
  instruction: 'e4 oyna',
};

describe('MovePieceSolver — geçmiş gezinme bağlı (madde 1)', () => {
  it('tahtaya tekerlek gezinmesi bağlanmıştır', () => {
    render(
      <MovePieceSolver
        exercise={EXERCISE}
        disabled={false}
        onSolved={vi.fn()}
        onWrong={vi.fn()}
      />,
    );
    expect(screen.getByTestId('board').getAttribute('data-has-wheel')).toBe('true');
  });

  it('hamle oynanmadan önce canlı konumdadır ve tahta etkileşimlidir', () => {
    render(
      <MovePieceSolver
        exercise={EXERCISE}
        disabled={false}
        onSolved={vi.fn()}
        onWrong={vi.fn()}
      />,
    );
    expect(screen.getByTestId('board').getAttribute('data-interactive')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Canlıya dön' })).toBeNull();
  });
});

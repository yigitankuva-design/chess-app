import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChessBoard } from '@/components/ChessBoard';

describe('ChessBoard', () => {
  it('renders with initial position', () => {
    const { container } = render(
      <ChessBoard fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders empty board with custom FEN', () => {
    const { container } = render(<ChessBoard fen="8/8/8/8/8/8/8/8 w - - 0 1" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

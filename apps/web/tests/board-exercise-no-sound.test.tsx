import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

vi.mock('@/lib/sounds/pieceSounds', () => ({ playPieceSound: vi.fn() }));
import { playPieceSound } from '@/lib/sounds/pieceSounds';

const clickSq: BoardExerciseConfig = {
  type: 'click_square', instruction: 'x',
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', target_squares: ['e4'],
};
const movePiece: BoardExerciseConfig = {
  type: 'move_piece', instruction: 'x',
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', piece_square: 'e2', target_squares: ['e4'],
};

describe('BoardExercise — pratikte ses YOK (madde 3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('click_square doğru cevapta ses çalınmaz', () => {
    const { container } = render(<BoardExercise exercises={[clickSq]} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(playPieceSound).not.toHaveBeenCalled();
  });

  it('move_piece taş seçiminde ve doğru hamlede ses çalınmaz', () => {
    const { container } = render(<BoardExercise exercises={[movePiece]} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e2"]')!); // taş seç
    fireEvent.click(container.querySelector('[data-square="e4"]')!); // doğru hedef
    expect(playPieceSound).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BoardExercise, isBoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const ex: BoardExerciseConfig = {
  type: 'place_pieces',
  instruction: 'Eksik taşı yerleştir',
  fen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
  pieces: [{ piece: 'Q', square: 'h5' }],
  code: '011',
};

function renderEx() {
  return render(<BoardExercise exercises={[ex]} done={false} onCorrect={vi.fn()} />);
}

describe('BoardExercise — place_pieces', () => {
  it('tahta tipi sayılır', () => {
    expect(isBoardExercise(ex)).toBe(true);
  });

  it('dairesel taş kartı board alanında, talimat content alanında', () => {
    const { container } = renderEx();
    const board = container.querySelector('.pg-board');
    const content = container.querySelector('.pg-content');
    expect(board?.querySelector('[aria-label="Beyaz Vezir"]')).toBeInTheDocument();
    expect(content?.textContent).toContain('Eksik taşı yerleştir');
  });

  it('KOD yazısı gösterilir', () => {
    const { container } = renderEx();
    expect(container.querySelector('.pg-code')?.textContent).toContain('011');
  });
});

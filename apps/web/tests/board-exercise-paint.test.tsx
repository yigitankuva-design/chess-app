import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

describe('BoardExercise — çizim öğeleri sporcuya gösterilir (C grubu)', () => {
  it('click_square: annotations tahtanın üzerinde render edilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'click_square', instruction: 'e4 karesine tıkla',
        fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', target_squares: ['e4'],
        annotations: [
          { id: 'p1', kind: 'text', x: 50, y: 50, rotation: 0, color: '#ef4444', text: 'Buraya!', fontSize: 24 },
        ],
      },
    ];
    const { getByTestId } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    expect(getByTestId('paint-item-p1').textContent).toBe('Buraya!');
  });

  it('place_pieces: annotations tahtanın üzerinde render edilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'place_pieces', instruction: 'Veziri koy',
        fen: '7k/8/8/8/8/8/8/K7 w - - 0 1', pieces: [{ piece: 'Q', square: 'h5' }],
        annotations: [
          { id: 'p2', kind: 'shape', shape: 'star', x: 40, y: 40, w: 15, h: 15, rotation: 0, color: '#eab308' },
        ],
      },
    ];
    const { getByTestId } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    expect(getByTestId('paint-item-p2')).toBeInTheDocument();
  });
});

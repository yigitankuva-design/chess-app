import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const ex: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'Şaha tıkla',
  fen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  target_squares: ['e4'],
};

describe('BoardExercise — quitSlot', () => {
  it('quitSlot verilmezse hiçbir çıkış düğmesi görünmez', () => {
    render(<BoardExercise exercises={[ex]} done={false} onCorrect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Bırak/ })).not.toBeInTheDocument();
  });

  it('quitSlot verilirse içerik alanında görünür', () => {
    const { container } = render(
      <BoardExercise
        exercises={[ex]} done={false} onCorrect={vi.fn()}
        quitSlot={<button type="button">Süresiz Pratik Yapmayı Bırak</button>}
      />,
    );
    const content = container.querySelector('.pg-content');
    expect(content?.textContent).toContain('Süresiz Pratik Yapmayı Bırak');
  });

  it('çoktan seçmeli soruda da görünür', () => {
    const choiceEx: BoardExerciseConfig = {
      type: 'sentence_question', instruction: 'Atın hareketi?',
      answer_kind: 'sentence', options: ['L şeklinde', 'Düz'], correct_index: 0,
    };
    const { container } = render(
      <BoardExercise
        exercises={[choiceEx]} done={false} onCorrect={vi.fn()}
        quitSlot={<button type="button">Testi Bırak</button>}
      />,
    );
    expect(container.querySelector('.pg-content')?.textContent).toContain('Testi Bırak');
  });
});

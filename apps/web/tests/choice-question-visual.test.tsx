import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChoiceQuestionVisual } from '@/components/lesson-steps/ChoiceQuestionVisual';
import type { SentenceQuestionEx } from '@/components/lesson-steps/BoardExercise';

const BASE: SentenceQuestionEx = {
  type: 'sentence_question', instruction: 'Hangi kare?', answer_kind: 'sentence',
  options: ['a', 'b'], correct_index: 0,
};

describe('ChoiceQuestionVisual — sentence_question tahtası (A grubu madde 5)', () => {
  it('fen yoksa hiçbir şey render etmez (mevcut davranış korunur)', () => {
    const { container } = render(<ChoiceQuestionVisual exercise={BASE} />);
    expect(container.querySelector('[data-testid="sentence-board"]')).not.toBeInTheDocument();
  });

  it('fen var ve sentence_show_board false DEĞİLSE tahta gösterilir', () => {
    const ex: SentenceQuestionEx = { ...BASE, fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1' };
    const { container } = render(<ChoiceQuestionVisual exercise={ex} />);
    expect(container.querySelector('[data-testid="sentence-board"]')).toBeInTheDocument();
  });

  it('sentence_show_board false ise fen dolu olsa da tahta gösterilmez', () => {
    const ex: SentenceQuestionEx = {
      ...BASE, fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1', sentence_show_board: false,
    };
    const { container } = render(<ChoiceQuestionVisual exercise={ex} />);
    expect(container.querySelector('[data-testid="sentence-board"]')).not.toBeInTheDocument();
  });
});

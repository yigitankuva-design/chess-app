import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChoiceQuestionVisual } from '@/components/lesson-steps/ChoiceQuestionVisual';
import type { SentenceQuestionEx, ImageQuestionEx } from '@/components/lesson-steps/BoardExercise';

describe('ChoiceQuestionVisual — çizim öğeleri sporcuya gösterilir (C grubu)', () => {
  it('sentence_question: annotations tahtanın üzerinde render edilir', () => {
    const ex: SentenceQuestionEx = {
      type: 'sentence_question', instruction: 'Hangi kare?', answer_kind: 'sentence',
      options: ['a', 'b'], correct_index: 0, fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1',
      annotations: [{ id: 'p1', kind: 'text', x: 50, y: 50, rotation: 0, color: '#000000', text: 'Bak', fontSize: 20 }],
    };
    const { getByTestId } = render(<ChoiceQuestionVisual exercise={ex} />);
    expect(getByTestId('paint-item-p1').textContent).toBe('Bak');
  });

  it('image_question: annotations görselin üzerinde render edilir', () => {
    const ex: ImageQuestionEx = {
      type: 'image_question', instruction: 'x', answer_kind: 'sentence',
      options: ['a', 'b'], correct_index: 0, prompt_image: 'data:image/png;base64,x',
      annotations: [{ id: 'p2', kind: 'shape', shape: 'circle', x: 30, y: 30, w: 10, h: 10, rotation: 0, color: '#3b82f6' }],
    };
    const { getByTestId } = render(<ChoiceQuestionVisual exercise={ex} />);
    expect(getByTestId('paint-item-p2')).toBeInTheDocument();
  });
});

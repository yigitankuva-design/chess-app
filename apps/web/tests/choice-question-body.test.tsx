import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChoiceQuestionBody } from '@/components/lesson-steps/ChoiceQuestionBody';
import type { ChoiceTypeConfig } from '@/components/lesson-steps/BoardExercise';

const sentenceEx: ChoiceTypeConfig = {
  type: 'sentence_question',
  instruction: 'Atın hareketi nasıldır?',
  answer_kind: 'sentence',
  options: ['L şeklinde', 'Düz çizgide'],
  correct_index: 0,
};

const imageEx: ChoiceTypeConfig = {
  type: 'image_question',
  instruction: '',
  prompt_image: 'data:image/jpeg;base64,AAA',
  answer_kind: 'sentence',
  options: ['A', 'B', 'C'],
  correct_index: 2,
};

describe('ChoiceQuestionBody', () => {
  it('sentence_question için soru metnini ve tüm seçenekleri gösterir', () => {
    render(<ChoiceQuestionBody exercise={sentenceEx} disabled={false} onAnswer={() => {}} />);
    expect(screen.getByText('Atın hareketi nasıldır?')).toBeInTheDocument();
    expect(screen.getByText('L şeklinde')).toBeInTheDocument();
    expect(screen.getByText('Düz çizgide')).toBeInTheDocument();
  });

  it('image_question için görseli gösterir, boş instruction kartı göstermez', () => {
    render(<ChoiceQuestionBody exercise={imageEx} disabled={false} onAnswer={() => {}} />);
    expect(screen.getByAltText('Soru görseli')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('bir seçeneğe tıklanınca doğru indeksle onAnswer çağrılır', () => {
    const onAnswer = vi.fn();
    render(<ChoiceQuestionBody exercise={sentenceEx} disabled={false} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('Düz çizgide'));
    expect(onAnswer).toHaveBeenCalledWith(1);
  });

  it('disabled iken tıklama onAnswer çağırmaz', () => {
    const onAnswer = vi.fn();
    render(<ChoiceQuestionBody exercise={sentenceEx} disabled onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText('L şeklinde'));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

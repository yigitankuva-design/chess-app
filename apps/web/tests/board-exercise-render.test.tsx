import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

describe('BoardExercise — tip dallanması', () => {
  it('click_square için tahtanın 64 karesini render eder (REGRESYON)', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'Bir kareye tıkla', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={() => {}} />);
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.getByText('Bir kareye tıkla')).toBeInTheDocument();
  });

  it('sentence_question için HİÇ tahta karesi render ETMEZ, seçenekleri gösterir', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'sentence_question', instruction: 'Atın hareketi?', answer_kind: 'sentence',
        options: ['L şeklinde', 'Düz'], correct_index: 0 },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={() => {}} />);
    expect(container.querySelectorAll('[data-square]')).toHaveLength(0);
    expect(screen.getByText('Atın hareketi?')).toBeInTheDocument();
    expect(screen.getByText('L şeklinde')).toBeInTheDocument();
    expect(screen.getByText('Düz')).toBeInTheDocument();
  });

  it('image_question için görseli gösterir, tahta karesi render ETMEZ', () => {
    const exercises: BoardExerciseConfig[] = [
      { type: 'image_question', instruction: '', prompt_image: 'data:image/jpeg;base64,AAA',
        answer_kind: 'sentence', options: ['A', 'B'], correct_index: 1 },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={() => {}} />);
    expect(container.querySelectorAll('[data-square]')).toHaveLength(0);
    expect(screen.getByAltText('Soru görseli')).toBeInTheDocument();
  });

  it('sentence_question doğru cevaba tıklayınca onCorrect çağrılır', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'sentence_question', instruction: 'Atın hareketi?', answer_kind: 'sentence',
        options: ['L şeklinde', 'Düz'], correct_index: 0 },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(screen.getByText('L şeklinde'));
    expect(onCorrect).toHaveBeenCalled();
  });

  it('sentence_question yanlış cevaba tıklayınca onCorrect çağrılMAZ', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'sentence_question', instruction: 'Atın hareketi?', answer_kind: 'sentence',
        options: ['L şeklinde', 'Düz'], correct_index: 0 },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(screen.getByText('Düz'));
    expect(onCorrect).not.toHaveBeenCalled();
  });
});

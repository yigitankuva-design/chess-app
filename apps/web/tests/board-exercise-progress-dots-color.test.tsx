import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const UC_SORU: BoardExerciseConfig[] = [
  { type: 'sentence_question', prompt: 'S1', options: ['Doğru', 'Yanlış'], correct_index: 0, fail_msg: 'x' },
  { type: 'sentence_question', prompt: 'S2', options: ['Doğru', 'Yanlış'], correct_index: 0, fail_msg: 'x' },
  { type: 'sentence_question', prompt: 'S3', options: ['Doğru', 'Yanlış'], correct_index: 0, fail_msg: 'x' },
] as unknown as BoardExerciseConfig[];

function dot(i: number) {
  return screen.getByTestId(`progress-dot-${i}`);
}

describe('BoardExercise — ilerleme noktaları doğru/yanlış renklenir', () => {
  it('doğru cevaplanan soru yeşil kalır', () => {
    render(<BoardExercise exercises={UC_SORU} done={false} onCorrect={vi.fn()} noRetry />);
    fireEvent.click(screen.getByText('Doğru')); // S1 doğru
    expect(dot(0).style.backgroundColor).toBe('#16a34a');
  });

  it('yanlış cevaplanıp kilitlenen soru kırmızı olur ve sonraki soruya geçince de kırmızı kalır', () => {
    render(<BoardExercise exercises={UC_SORU} done={false} onCorrect={vi.fn()} noRetry />);
    fireEvent.click(screen.getByText('Yanlış')); // S1 yanlış, kilitlenir
    expect(dot(0).style.backgroundColor).toBe('#dc2626');
    fireEvent.click(screen.getByText(/Sonraki Soruya Geç/));
    expect(dot(0).style.backgroundColor).toBe('#dc2626');
  });

  it('karışık sonuçlar: doğru yeşil, yanlış kırmızı, aynı anda doğru gösterilir', () => {
    render(<BoardExercise exercises={UC_SORU} done={false} onCorrect={vi.fn()} noRetry />);
    fireEvent.click(screen.getByText('Doğru')); // S1 doğru
    fireEvent.click(screen.getByText(/Sonraki Soruya Geç/));
    fireEvent.click(screen.getByText('Yanlış')); // S2 yanlış
    expect(dot(0).style.backgroundColor).toBe('#16a34a');
    expect(dot(1).style.backgroundColor).toBe('#dc2626');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

describe('BoardExercise — P3 öncesi taban çizgisi (regresyon güvenlik ağı)', () => {
  it('move_piece: yanlış hamleden hemen sonra (fail penceresi içinde) tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'move_piece', instruction: "Piyonu e4'e taşı",
        fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', piece_square: 'e2', target_squares: ['e4'],
      },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(container.querySelector('[data-square="e2"]')!);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış hedef
    expect(screen.getByText(/Yanlış kare/)).toBeInTheDocument();
    // Fail penceresi (1.8sn) DOLMADAN tekrar dene — taşı yeniden seçip doğru kareye taşıyabilmeli
    fireEvent.click(container.querySelector('[data-square="e2"]')!);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(container.textContent).toMatch(/Aferin/);
  });

  it('identify_piece: yanlış şıktan sonra tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'identify_piece', instruction: 'Bu taş ne?',
        fen: '8/8/8/8/4n3/8/8/8 b - - 0 1', highlight_square: 'e4',
        options: ['Piyon', 'At'], correct_index: 1,
      },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(screen.getByText('Piyon')); // yanlış
    expect(screen.getByText(/Yanlış/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('At')); // tekrar dene, doğru
    expect(screen.getByText(/Aferin/)).toBeInTheDocument();
  });

  it('sentence_question: yanlış cevaptan sonra tekrar denenebilir', () => {
    const exercises: BoardExerciseConfig[] = [
      {
        type: 'sentence_question', instruction: 'Atın hareketi?',
        answer_kind: 'sentence', options: ['L şeklinde', 'Düz'], correct_index: 0,
      },
    ];
    render(<BoardExercise exercises={exercises} done={false} onCorrect={vi.fn()} />);
    fireEvent.click(screen.getByText('Düz')); // yanlış
    fireEvent.click(screen.getByText('L şeklinde')); // tekrar dene, doğru
    expect(screen.getByText(/Aferin/)).toBeInTheDocument();
  });

  it('click_square: 3 sorunun TÜMÜ doğru cevaplanınca onCorrect tam bir kez çağrılır', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q3', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});

describe('BoardExercise — succeed() bitiş tespiti currentIdx tabanlı (Task 2)', () => {
  it('3 sorunun tümü DOĞRU cevaplanırsa onCorrect hâlâ tam bir kez çağrılır (refactor no-op doğrulaması)', () => {
    const onCorrect = vi.fn();
    const exercises: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'q1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
      { type: 'click_square', instruction: 'q2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['a1'] },
    ];
    const { container } = render(<BoardExercise exercises={exercises} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(screen.getByText('Sonraki Soru →'));
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});

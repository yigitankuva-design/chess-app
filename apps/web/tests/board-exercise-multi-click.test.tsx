import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

/** all modu: sporcu TÜM doğru karelere tıklamalı; 1 yanlış = yanlış (madde 2). */
const ALL_MODE: BoardExerciseConfig[] = [
  {
    type: 'click_square', instruction: 'Tüm merkez karelere tıkla',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4', 'e5'], click_mode: 'all',
  },
];

describe('BoardExercise — all modu çoklu-kare (madde 2)', () => {
  it('tek doğru kare henüz başarı DEĞİL, ikisi tamamlanınca onCorrect', () => {
    const onCorrect = vi.fn();
    const { container } = render(<BoardExercise exercises={ALL_MODE} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(onCorrect).not.toHaveBeenCalled();  // henüz e5 tıklanmadı
    fireEvent.click(container.querySelector('[data-square="e5"]')!);
    expect(onCorrect).toHaveBeenCalledTimes(1); // tüm kareler + tek soru bitti
  });

  it('bir yanlış kare tıklanınca soru yanlış (terminal ekran, onCorrect yok)', () => {
    const onCorrect = vi.fn();
    const { container } = render(<BoardExercise exercises={ALL_MODE} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="a1"]')!); // yanlış
    expect(onCorrect).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/cevapland/i);
  });

  it("REGRESYON: click_mode yoksa 'any' — ilk doğru tık soruyu bitirir", () => {
    const onCorrect = vi.fn();
    const anyMode: BoardExerciseConfig[] = [
      { type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4', 'e5'] },
    ];
    const { container } = render(<BoardExercise exercises={anyMode} done={false} onCorrect={onCorrect} />);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});

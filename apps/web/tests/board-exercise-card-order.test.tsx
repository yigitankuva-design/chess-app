import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const two: BoardExerciseConfig[] = [
  { type: 'click_square', instruction: 'S1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
  { type: 'click_square', instruction: 'S2', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'] },
];

describe('BoardExercise — kart sırası: geribildirim solda, sonraki soru sağda (madde 5)', () => {
  it('DOM sırası: geribildirim kartı ÖNCE, "Sonraki Soruya Geç" SONRA gelir', () => {
    const { container } = render(
      <BoardExercise exercises={two} done={false} onCorrect={vi.fn()} />,
    );
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    // DİKKAT: '.closest("div")' burada YANLIŞ olurdu — buton bir <button>,
    // "div" DEĞİL; closest('div') butonu atlayıp GRID'in kendisini bulur,
    // sonra .parentElement grid'in ÜSTÜNE çıkardı (yanlış eleman). Grid'i
    // doğrudan class seçiciyle buluyoruz.
    const grid = screen.getByText('Sonraki Soruya Geç').closest('.grid')!;
    const children = Array.from(grid.children);
    const feedbackIdx = children.findIndex((c) => c.textContent?.includes('✓'));
    const nextIdx = children.findIndex((c) => c.textContent?.includes('Sonraki Soruya Geç'));
    expect(feedbackIdx).toBeLessThan(nextIdx);
  });
});

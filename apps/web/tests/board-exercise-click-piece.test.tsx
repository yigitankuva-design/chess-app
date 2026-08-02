import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise, isBoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

/** e4 beyaz şah, a1 beyaz kale; kalan kareler BOŞ. */
const ex: BoardExerciseConfig = {
  type: 'click_piece',
  instruction: 'Beyaz taşlara tıkla',
  fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1',
  piece_squares: ['e4', 'a1'],
  code: '031',
};

const ikinci: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'İkinci soru',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  target_squares: ['d4'],
};

function renderEx() {
  return render(<BoardExercise exercises={[ex, ikinci]} done={false} onCorrect={vi.fn()} />);
}

describe('BoardExercise — click_piece', () => {
  it('tahta tipi sayılır', () => {
    expect(isBoardExercise(ex)).toBe(true);
  });

  it('BOŞ kareye tıklamak hiçbir şey yapmaz', () => {
    const { container } = renderEx();
    fireEvent.click(container.querySelector('[data-square="h8"]')!);
    expect(screen.queryByLabelText('Doğru')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Yanlış')).not.toBeInTheDocument();
  });

  it('ilk doğru taşta soru BİTMEZ (hepsine tıklanmalı)', () => {
    const { container } = renderEx();
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(screen.queryByLabelText('Doğru')).not.toBeInTheDocument();
  });

  it('tüm cevap taşlarına tıklanınca soru DOĞRU biter', () => {
    const { container } = renderEx();
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('sıra serbesttir — a1 önce tıklansa da olur', () => {
    const { container } = renderEx();
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });

  it('cevap DIŞINDAKİ bir taşa tıklanınca soru YANLIŞ biter (tek hak)', () => {
    // d5'te siyah at var ama cevap değil.
    const yanlisEx: BoardExerciseConfig = {
      type: 'click_piece',
      instruction: 'Beyaz taşlara tıkla',
      fen: '8/8/8/3n4/4K3/8/8/R7 w - - 0 1',
      piece_squares: ['e4', 'a1'],
    };
    const { container } = render(
      <BoardExercise exercises={[yanlisEx, ikinci]} done={false} onCorrect={vi.fn()} />,
    );
    fireEvent.click(container.querySelector('[data-square="d5"]')!);
    expect(screen.getByLabelText('Yanlış')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const newFormat: BoardExerciseConfig = {
  type: 'move_piece',
  instruction: 'Taktik çizgiyi oyna',
  fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
  moves: ['Rh4', 'Kf8'],
};

const oldFormat: BoardExerciseConfig = {
  type: 'move_piece',
  instruction: "Piyonu e4'e taşı",
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  piece_square: 'e2',
  target_squares: ['e4'],
};

describe('BoardExercise — yeni format move_piece gerçek çözücüyle render edilir', () => {
  it('yeni format (moves alanlı) soru için çözüm tahtası render edilir', () => {
    const { container } = render(
      <BoardExercise exercises={[newFormat]} done={false} onCorrect={vi.fn()} />,
    );
    // Artık placeholder değil, gerçek tahta çiziliyor (P5)
    expect(screen.queryByText(/yakında aktif olacak/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('yeni format soruda talimat metni gösterilir', () => {
    render(<BoardExercise exercises={[newFormat]} done={false} onCorrect={vi.fn()} />);
    expect(screen.getByText('Taktik çizgiyi oyna')).toBeInTheDocument();
  });

  it('yeni format soru render edilirken çökmez (styles guard)', () => {
    // styles hesaplama bloğu JSX'ten bağımsız, her render'da çalışır —
    // target_squares olmayan bir move_piece'te patlamamalı.
    expect(() =>
      render(<BoardExercise exercises={[newFormat]} done={false} onCorrect={vi.fn()} />),
    ).not.toThrow();
  });

  it('REGRESYON: eski format move_piece hâlâ tahtayı render eder', () => {
    const { container } = render(
      <BoardExercise exercises={[oldFormat]} done={false} onCorrect={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.queryByText(/yakında aktif olacak/i)).not.toBeInTheDocument();
    expect(screen.getByText("Piyonu e4'e taşı")).toBeInTheDocument();
  });

  it('REGRESYON: eski format move_piece hamlesi hâlâ çalışır', () => {
    const onCorrect = vi.fn();
    const { container } = render(
      <BoardExercise exercises={[oldFormat]} done={false} onCorrect={onCorrect} />,
    );
    fireEvent.click(container.querySelector('[data-square="e2"]')!); // taşı seç
    fireEvent.click(container.querySelector('[data-square="e4"]')!); // hedefe taşı
    expect(screen.getByLabelText('Doğru')).toBeInTheDocument();
  });
});

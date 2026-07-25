import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

// Yeni format (P4) — MovePieceEx tipi henüz `moves` tanımlamıyor (P5'te güncellenecek),
// bu yüzden test verisi kasten cast ediliyor. Çalışma zamanında backend böyle veri döndürebilir.
const newFormat = {
  type: 'move_piece',
  instruction: 'Taktik çizgiyi oyna',
  fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
  moves: ['Rh4', 'Kf8'],
} as unknown as BoardExerciseConfig;

const oldFormat: BoardExerciseConfig = {
  type: 'move_piece',
  instruction: "Piyonu e4'e taşı",
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  piece_square: 'e2',
  target_squares: ['e4'],
};

describe('BoardExercise — yeni format move_piece güvenlik placeholder', () => {
  it('yeni format (moves alanlı) soru placeholder gösterir, tahta render ETMEZ', () => {
    const { container } = render(
      <BoardExercise exercises={[newFormat]} done={false} onCorrect={vi.fn()} />,
    );
    expect(screen.getByText(/yakında aktif olacak/i)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-square]')).toHaveLength(0);
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
    expect(container.textContent).toMatch(/Aferin/);
  });
});

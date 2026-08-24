import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AltKonuWalkthrough } from '@/components/custom/AltKonuWalkthrough';
import type { BoardExercise } from '@/components/admin/ExerciseForm';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('AltKonuWalkthrough — madde 2026-08-25', () => {
  it('havuz tamamen boşken bilgi mesajı gösterir', () => {
    render(<AltKonuWalkthrough positions={[]} exercises={[]} />);
    expect(screen.getByText(/Henüz soru eklenmedi/)).toBeInTheDocument();
  });

  it('ilk soru (Konum Havuzu 001) ile açılır, sayaç doğru gösterilir', () => {
    render(<AltKonuWalkthrough
      positions={[{ id: 'p1', fen: FEN }, { id: 'p2', fen: FEN }]}
      exercises={[]}
    />);
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();
    expect(screen.getByText('← Geri')).toBeDisabled();
    expect(screen.getByText('İleri →')).toBeEnabled();
  });

  it('İleri/Geri ile sırayla ilerler ve geri döner', () => {
    render(<AltKonuWalkthrough
      positions={[{ id: 'p1', fen: FEN }, { id: 'p2', fen: FEN }]}
      exercises={[]}
    />);
    fireEvent.click(screen.getByText('İleri →'));
    expect(screen.getByText('2 / 2 — Konum Havuzu 002')).toBeInTheDocument();
    expect(screen.getByText('İleri →')).toBeDisabled();

    fireEvent.click(screen.getByText('← Geri'));
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();
  });

  it('Konum Havuzu ve Kareye Tıkla/Taşa Tıkla/Taşı Oynat TEK sırada birleşir (önce havuz, sonra sorular)', () => {
    const exercises: BoardExercise[] = [
      { type: 'click_square', instruction: 'e4 karesine tıkla', fen: FEN, target_squares: ['e4'] },
      { type: 'move_piece', instruction: 'e4 oyna', fen: FEN, moves: ['e4'] },
    ];
    render(<AltKonuWalkthrough positions={[{ id: 'p1', fen: FEN }]} exercises={exercises} />);
    expect(screen.getByText('1 / 3 — Konum Havuzu 001')).toBeInTheDocument();

    fireEvent.click(screen.getByText('İleri →'));
    expect(screen.getByText('2 / 3 — Kareye Tıkla 001')).toBeInTheDocument();
    expect(screen.getByText('e4 karesine tıkla')).toBeInTheDocument();

    fireEvent.click(screen.getByText('İleri →'));
    expect(screen.getByText('3 / 3 — Taşı Oynat 002')).toBeInTheDocument();
    expect(screen.getByText('e4 oyna')).toBeInTheDocument();
    expect(screen.getByText('Hamleler: e4')).toBeInTheDocument();
    expect(screen.getByText('İleri →')).toBeDisabled();
  });
});

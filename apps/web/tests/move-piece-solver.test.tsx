import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MovePieceSolver } from '@/components/lesson-steps/MovePieceSolver';
import type { MovePieceSequenceEx } from '@/components/lesson-steps/BoardExercise';

const TWO_SIDED: MovePieceSequenceEx = {
  type: 'move_piece',
  instruction: 'Taktigi oyna',
  fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
  moves: ['Rh4', 'Kf8'],
};

const KINGLESS: MovePieceSequenceEx = {
  type: 'move_piece',
  instruction: 'Piyonu ilerlet',
  fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  moves: ['e4'],
};

function clickSquare(container: HTMLElement, square: string) {
  fireEvent.click(container.querySelector(`[data-square="${square}"]`)!);
}

describe('MovePieceSolver', () => {
  it('tahtayı 64 kareyle render eder', () => {
    const { container } = render(
      <MovePieceSolver exercise={TWO_SIDED} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('ŞAHSIZ öğretim pozisyonunda çökmeden render eder', () => {
    const { container } = render(
      <MovePieceSolver exercise={KINGLESS} disabled={false} onSolved={vi.fn()} onWrong={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('YANLIŞ hamlede onWrong çağrılır, onSolved çağrılmaz', () => {
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <MovePieceSolver exercise={TWO_SIDED} disabled={false} onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'f4'); // kaleyi seç
    clickSquare(container, 'f5'); // legal ama anahtarda yok
    expect(onWrong).toHaveBeenCalledTimes(1);
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('KURAL DIŞI hamlede ne onWrong ne onSolved çağrılır (ceza yok)', () => {
    // NOT: Bu senaryoda ChessBoard zaten e5'i geçerli hedef saymadığı için
    // onPieceDrop hiç çağrılmaz. tryStudentMove'un 'illegal' dalı ayrıca
    // move-player.test.ts içinde doğrudan test ediliyor.
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <MovePieceSolver exercise={TWO_SIDED} disabled={false} onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'f4'); // kaleyi seç
    clickSquare(container, 'e5'); // kale çapraz gidemez
    expect(onWrong).not.toHaveBeenCalled();
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('disabled iken tıklama hiçbir callback tetiklemez', () => {
    const onWrong = vi.fn();
    const onSolved = vi.fn();
    const { container } = render(
      <MovePieceSolver exercise={TWO_SIDED} disabled onSolved={onSolved} onWrong={onWrong} />,
    );
    clickSquare(container, 'f4');
    clickSquare(container, 'h4');
    expect(onWrong).not.toHaveBeenCalled();
    expect(onSolved).not.toHaveBeenCalled();
  });
});

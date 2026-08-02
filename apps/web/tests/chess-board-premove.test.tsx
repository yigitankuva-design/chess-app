import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

function square(container: HTMLElement, name: string): HTMLElement {
  return container.querySelector(`[data-square="${name}"]`) as HTMLElement;
}

describe('ChessBoard — ön-hamle seçimi (madde 5)', () => {
  it('sıra rakipteyken KENDİ taşına tıklayıp hedefe tıklayınca ön-hamle bildirilir', () => {
    const onPremove = vi.fn();
    const { container } = render(
      <ChessBoard fen={START} interactive={false} onPremove={onPremove} premoveColor="w" />,
    );
    fireEvent.click(square(container, 'e2'));
    fireEvent.click(square(container, 'e4'));
    expect(onPremove).toHaveBeenCalledWith('e2', 'e4');
  });

  it('RAKİBİN taşıyla ön-hamle verilemez', () => {
    const onPremove = vi.fn();
    const { container } = render(
      <ChessBoard fen={START} interactive={false} onPremove={onPremove} premoveColor="w" />,
    );
    fireEvent.click(square(container, 'e7'));
    fireEvent.click(square(container, 'e5'));
    expect(onPremove).not.toHaveBeenCalled();
  });

  it('onPremove verilmezse sıra rakipteyken hiçbir şey olmaz (eski davranış)', () => {
    const onSquareClick = vi.fn();
    const { container } = render(
      <ChessBoard fen={START} interactive={false} onSquareClick={onSquareClick} />,
    );
    fireEvent.click(square(container, 'e2'));
    fireEvent.click(square(container, 'e4'));
    expect(onSquareClick).not.toHaveBeenCalled();
  });

  it('seçilmiş ön-hamlenin iki karesi işaretlenir', () => {
    const { container } = render(
      <ChessBoard
        fen={START}
        interactive={false}
        onPremove={vi.fn()}
        premoveColor="w"
        premoveSquares={{ from: 'e2', to: 'e4' }}
      />,
    );
    const from = square(container, 'e2').querySelector('div');
    const to = square(container, 'e4').querySelector('div');
    expect(from?.style.backgroundColor).toBe('rgba(255, 170, 0, 0.55)');
    expect(to?.style.backgroundColor).toBe('rgba(255, 170, 0, 0.55)');
  });
});

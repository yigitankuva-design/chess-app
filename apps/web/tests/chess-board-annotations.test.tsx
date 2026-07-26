import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

describe('ChessBoard — sağ-tık renklendirme', () => {
  it('bir kareye Ctrl+sağ-tık o kareyi kırmızı boyar', () => {
    const { container } = render(
      <ChessBoard fen="8/8/8/8/8/8/8/8 w - - 0 1" />,
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    const square = container.querySelector('[data-square="d5"]') as HTMLElement;
    fireEvent.contextMenu(square);
    const overlay = square.querySelector('div');
    expect(overlay?.style.backgroundColor).toBe('rgba(248, 113, 113, 0.55)');
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
  });

  it('fen değişince işaretler temizlenir', () => {
    const { container, rerender } = render(
      <ChessBoard fen="8/8/8/8/8/8/8/8 w - - 0 1" />,
    );
    const square = container.querySelector('[data-square="d5"]') as HTMLElement;
    fireEvent.contextMenu(square);
    rerender(<ChessBoard fen="8/8/8/8/8/8/8/8 b - - 0 1" />);
    const squareAfter = container.querySelector('[data-square="d5"]') as HTMLElement;
    const overlay = squareAfter.querySelector('div');
    expect(overlay?.style.backgroundColor).not.toBe('rgba(74, 222, 128, 0.55)');
  });
});

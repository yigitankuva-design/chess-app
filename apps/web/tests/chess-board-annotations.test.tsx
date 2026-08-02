import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

describe('ChessBoard — sağ-tık işaretleme (madde 2: çember)', () => {
  it('bir kareye Ctrl+sağ-tık o kareye KIRMIZI ÇEMBER çizer, kareyi doldurmaz', () => {
    const { container } = render(
      <ChessBoard fen="8/8/8/8/8/8/8/8 w - - 0 1" />,
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    const square = container.querySelector('[data-square="d5"]') as HTMLElement;
    fireEvent.contextMenu(square);
    const overlay = square.querySelector('div');
    expect(overlay?.style.boxShadow).toContain('inset');
    expect(overlay?.style.boxShadow).toContain('rgb(220, 38, 38)');
    expect(overlay?.style.borderRadius).toBe('50%');
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
    expect(overlay?.style.boxShadow).not.toContain('inset');
  });
});

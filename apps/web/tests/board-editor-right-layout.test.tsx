import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardEditor } from '@/components/BoardEditor';

function setup(turn: 'w' | 'b' = 'w') {
  return render(
    <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn={turn} onChange={vi.fn()} onTurnChange={vi.fn()}
      paletteLayout="right" />,
  );
}

describe('BoardEditor — madde 2026-09-18 (madde 2/3): "right" taş paleti düzeni', () => {
  it('taş paleti tahtadan SONRA (sağında) render edilir', () => {
    const { container } = setup();
    const wrapper = container.querySelector('.flex.items-start.gap-2.w-full') as HTMLElement;
    expect(wrapper).toBeTruthy();
    const board = wrapper.querySelector('[data-square]')!;
    const palette = screen.getByLabelText('Taş paleti');
    expect(board.compareDocumentPosition(palette) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sürükle/tıkla ipucu satırı görünmez', () => {
    setup();
    expect(screen.queryByText(/tahtaya/)).not.toBeInTheDocument();
  });

  it('turn="w" iken "Beyaz" düğmesinde mavi/cyan vurgu YOK', () => {
    setup('w');
    expect(screen.getByText('Beyaz').className).not.toMatch(/cyan/);
  });

  it('turn="b" iken "Siyah" düğmesinde de mavi/cyan vurgu YOK', () => {
    setup('b');
    expect(screen.getByText('Siyah').className).not.toMatch(/cyan/);
  });

  it('"Beyaz" ve "Siyah" düğmeleri AYNI class\'a sahiptir (görsel fark yok)', () => {
    setup('w');
    expect(screen.getByText('Beyaz').className).toBe(screen.getByText('Siyah').className);
  });
});

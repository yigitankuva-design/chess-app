import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SavedPositionBoard } from '@/components/admin/SavedPositionBoard';

const FEN = '8/8/8/8/4K3/8/8/R7 w - - 0 1';

describe('SavedPositionBoard — tıklanabilir mod', () => {
  it('onSquareClick verilirse tıklanan kare bildirilir', () => {
    const onSquareClick = vi.fn();
    const { container } = render(
      <SavedPositionBoard fen={FEN} marked={[]} onSquareClick={onSquareClick} />,
    );
    fireEvent.click(container.querySelector('[data-square="e4"]')!);
    expect(onSquareClick).toHaveBeenCalledWith('e4');
  });

  it('onSquareClick VERİLMEZSE eski salt-okunur davranış sürer (B grubu bozulmaz)', () => {
    const { container } = render(<SavedPositionBoard fen={FEN} marked={['e4']} />);
    // Tıklama bir hata fırlatmamalı ve işaret değişmemeli.
    fireEvent.click(container.querySelector('[data-square="a1"]')!);
    const e4 = container.querySelector('[data-square="e4"] > div') as HTMLElement;
    expect(e4.style.borderRadius).toBe('50%');
  });
});

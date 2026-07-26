import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { BoardEditor } from '@/components/BoardEditor';

describe('BoardEditor — sağ-tık renklendirme', () => {
  it('bir kareye sağ tıklamak o kareyi yeşil boyar', () => {
    const { container } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()} />,
    );
    const square = container.querySelector('[data-square="e4"]') as HTMLElement;
    fireEvent.contextMenu(square);
    // squareStyles inner overlay div'e uygulanıyor (ölçülmüş react-chessboard davranışı)
    const overlay = square.querySelector('div');
    expect(overlay?.style.backgroundColor).toBe('rgba(74, 222, 128, 0.55)');
  });
});

describe('BoardEditor — buton ortalama', () => {
  it('Başlangıç konumu/Tahtayı temizle satırı justify-center içerir', () => {
    const { container } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()} />,
    );
    const row = [...container.querySelectorAll('div')].find(
      (d) => d.textContent === 'Başlangıç konumuTahtayı temizle',
    );
    expect(row?.className).toMatch(/justify-center/);
  });
});

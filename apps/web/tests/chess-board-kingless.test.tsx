import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

const KINGLESS = '8/8/8/8/8/8/4P3/8 w - - 0 1';    // Zafer'in öğretim pozisyonu
const WITH_KINGS = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1'; // gerçek prod pozisyonu

function clickSquare(container: HTMLElement, square: string) {
  fireEvent.click(container.querySelector(`[data-square="${square}"]`)!);
}

describe('ChessBoard — şahsız pozisyonlarda tıkla-oynat', () => {
  it('ŞAHSIZ pozisyonda tıkla-oynat onPieceDrop çağırır (düzeltmenin kanıtı)', () => {
    const onPieceDrop = vi.fn(() => true);
    const { container } = render(
      <ChessBoard fen={KINGLESS} interactive onPieceDrop={onPieceDrop} />,
    );
    clickSquare(container, 'e2'); // taşı seç
    clickSquare(container, 'e4'); // hedefe tıkla
    expect(onPieceDrop).toHaveBeenCalledWith('e2', 'e4');
  });

  it('REGRESYON: şahlı pozisyonda tıkla-oynat eskisi gibi çalışır', () => {
    const onPieceDrop = vi.fn(() => true);
    const { container } = render(
      <ChessBoard fen={WITH_KINGS} interactive onPieceDrop={onPieceDrop} />,
    );
    clickSquare(container, 'f4'); // kaleyi seç
    clickSquare(container, 'h4'); // hedefe tıkla
    expect(onPieceDrop).toHaveBeenCalledWith('f4', 'h4');
  });

  it('REGRESYON: interactive=false iken tıklama hamle üretmez', () => {
    const onPieceDrop = vi.fn(() => true);
    const { container } = render(
      <ChessBoard fen={WITH_KINGS} onPieceDrop={onPieceDrop} />,
    );
    clickSquare(container, 'f4');
    clickSquare(container, 'h4');
    expect(onPieceDrop).not.toHaveBeenCalled();
  });

  it('REGRESYON: karşı tarafın taşına tıklamak onu seçmez', () => {
    const onPieceDrop = vi.fn(() => true);
    const { container } = render(
      <ChessBoard fen={WITH_KINGS} interactive onPieceDrop={onPieceDrop} />,
    );
    clickSquare(container, 'g8'); // siyah şah — sıra beyazda
    clickSquare(container, 'f8');
    expect(onPieceDrop).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function square(container: HTMLElement, name: string): HTMLElement {
  return container.querySelector(`[data-square="${name}"]`) as HTMLElement;
}

describe('ChessBoard — geçmiş görünümünden tek dokunuşla çıkış (kilit tuzağı düzeltmesi)', () => {
  it('geçmişe bakarken tahtaya tıklamak CANLIYA DÖN çağrısı yapar', () => {
    const onLeaveHistory = vi.fn();
    const { container } = render(
      <ChessBoard fen={START} interactive={false} historyView onLeaveHistory={onLeaveHistory} />,
    );
    fireEvent.click(square(container, 'e2'));
    expect(onLeaveHistory).toHaveBeenCalledTimes(1);
  });

  it('geçmiş görünümündeyken tıklama ÖN-HAMLE tetiklemez (önce oyuna döner)', () => {
    const onLeaveHistory = vi.fn();
    const onPremove = vi.fn();
    const { container } = render(
      <ChessBoard
        fen={START}
        interactive={false}
        historyView
        onLeaveHistory={onLeaveHistory}
        onPremove={onPremove}
        premoveColor="w"
      />,
    );
    fireEvent.click(square(container, 'e2'));
    fireEvent.click(square(container, 'e4'));
    expect(onLeaveHistory).toHaveBeenCalled();
    expect(onPremove).not.toHaveBeenCalled();
  });

  it('historyView kapalıyken eski davranış korunur (ön-hamle çalışır)', () => {
    const onPremove = vi.fn();
    const blackToMove = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';
    const { container } = render(
      <ChessBoard fen={blackToMove} interactive={false} onPremove={onPremove} premoveColor="w" />,
    );
    fireEvent.click(square(container, 'e2'));
    fireEvent.click(square(container, 'e4'));
    expect(onPremove).toHaveBeenCalledWith('e2', 'e4');
  });
});

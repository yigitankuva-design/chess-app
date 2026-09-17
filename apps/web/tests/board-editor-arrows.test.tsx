import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BoardEditor } from '@/components/BoardEditor';

/** Madde 2026-09-17 (9 maddelik düzenleme turu, madde 5): Konum Tahtası'nda
 *  (BoardEditor) ok çizimi daha önce hiç yoktu — ChessBoard.tsx'teki AYNI
 *  useBoardArrows deseni buraya taşındı. Sağ-tık SÜRÜKLEYEREK ok çizilir
 *  (board-editor-annotations.test.tsx'teki sağ-TIK'la işaretlemeden FARKLI
 *  bir jest — o tek karede contextMenu, bu ise iki kare arası pointerdown/up). */

describe('BoardEditor — ok çizimi (madde 2026-09-17, madde 5)', () => {
  it('sağ tıkla bir kareden diğerine sürüklemek onArrowsChange\'i ok listesiyle çağırır', () => {
    const onArrowsChange = vi.fn();
    const { container } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()}
        onArrowsChange={onArrowsChange} />,
    );
    const from = container.querySelector('[data-square="e2"]') as HTMLElement;
    const to = container.querySelector('[data-square="e4"]') as HTMLElement;

    fireEvent.pointerDown(from, { button: 2 });
    fireEvent.pointerUp(to, { button: 2 });

    expect(onArrowsChange).toHaveBeenCalledWith([
      { from: 'e2', to: 'e4', color: 'rgba(34, 197, 94, 0.85)' },
    ]);
  });

  it('FEN değişince (yeni pozisyon) oklar otomatik temizlenir', () => {
    const onArrowsChange = vi.fn();
    const { container, rerender } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()}
        onArrowsChange={onArrowsChange} />,
    );
    const from = container.querySelector('[data-square="e2"]') as HTMLElement;
    const to = container.querySelector('[data-square="e4"]') as HTMLElement;
    fireEvent.pointerDown(from, { button: 2 });
    fireEvent.pointerUp(to, { button: 2 });
    expect(onArrowsChange).toHaveBeenLastCalledWith([{ from: 'e2', to: 'e4', color: 'rgba(34, 197, 94, 0.85)' }]);

    rerender(
      <BoardEditor fen="8/8/8/8/8/8/8/P7 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()}
        onArrowsChange={onArrowsChange} />,
    );
    expect(onArrowsChange).toHaveBeenLastCalledWith([]);
  });

  it('tek kareye sağ tıklamak (sürüklemeden) hâlâ kare işaretler — onMarksChange tetiklenir', () => {
    const onMarksChange = vi.fn();
    const { container } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()}
        onMarksChange={onMarksChange} />,
    );
    const square = container.querySelector('[data-square="e4"]') as HTMLElement;
    fireEvent.contextMenu(square);
    expect(onMarksChange).toHaveBeenCalledWith({ e4: 'green' });
  });

  it('onArrowsChange/onMarksChange verilmezse davranış etkilenmez (opsiyonel prop)', () => {
    const { container } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={vi.fn()} onTurnChange={vi.fn()} />,
    );
    const from = container.querySelector('[data-square="e2"]') as HTMLElement;
    const to = container.querySelector('[data-square="e4"]') as HTMLElement;
    expect(() => {
      fireEvent.pointerDown(from, { button: 2 });
      fireEvent.pointerUp(to, { button: 2 });
    }).not.toThrow();
  });
});

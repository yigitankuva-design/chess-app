import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ChessBoard } from '@/components/ChessBoard';

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';

/** Tahtanin kendi kapsayicisi — tekerlek dinleyicisi buraya baglanir. */
function boardBox(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-bsa-board]') as HTMLElement;
}

describe('ChessBoard — tekerlekle hamle gezinme (madde 1)', () => {
  it('tekerlek AŞAĞI çevrilince ileri adım bildirilir', () => {
    const onWheelStep = vi.fn();
    const { container } = render(<ChessBoard fen={EMPTY} onWheelStep={onWheelStep} />);
    fireEvent.wheel(boardBox(container), { deltaY: 120 });
    expect(onWheelStep).toHaveBeenCalledWith(1);
  });

  it('tekerlek YUKARI çevrilince geri adım bildirilir', () => {
    const onWheelStep = vi.fn();
    const { container } = render(<ChessBoard fen={EMPTY} onWheelStep={onWheelStep} />);
    fireEvent.wheel(boardBox(container), { deltaY: -120 });
    expect(onWheelStep).toHaveBeenCalledWith(-1);
  });

  it('tahtadaki tekerlek olayı sayfayı KAYDIRMAZ (preventDefault)', () => {
    const { container } = render(<ChessBoard fen={EMPTY} onWheelStep={vi.fn()} />);
    const evt = new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true });
    boardBox(container).dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('REGRESYON: onWheelStep verilmezse tekerlek engellenmez (sayfa kaydırılabilir)', () => {
    // ChessBoard.tsx'te tekerlek, kaydirma kilidini BILEREK serbest birakiyor
    // (telefonda/farede "sayfa kaydirilamiyor" sikayeti bu sekilde
    // duzeltilmisti). Gezinme kapaliyken o davranis AYNEN kalmali.
    const { container } = render(<ChessBoard fen={EMPTY} />);
    const evt = new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true });
    boardBox(container).dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(false);
  });
});

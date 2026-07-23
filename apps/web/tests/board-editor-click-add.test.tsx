import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardEditor, fenToMap } from '@/components/BoardEditor';

function setup(fen = '8/8/8/8/8/8/8/8 w - - 0 1') {
  const onChange = vi.fn();
  const utils = render(
    <BoardEditor fen={fen} turn="w" onChange={onChange} onTurnChange={vi.fn()} />,
  );
  return { ...utils, onChange };
}

describe('BoardEditor — palet seçimi', () => {
  it('bir palet taşına tıklamak onu vurgular (ring class)', () => {
    setup();
    const queen = screen.getByLabelText('Beyaz Vezir');
    expect(queen.className).not.toMatch(/ring-cyan-400/);
    fireEvent.click(queen);
    expect(queen.className).toMatch(/ring-cyan-400/);
  });

  it('aynı palet taşına tekrar tıklamak vurguyu kaldırır (seçim iptal)', () => {
    setup();
    const queen = screen.getByLabelText('Beyaz Vezir');
    fireEvent.click(queen);
    fireEvent.click(queen);
    expect(queen.className).not.toMatch(/ring-cyan-400/);
  });

  it('farklı bir palet taşına tıklamak önceki seçimin vurgusunu kaldırır', () => {
    setup();
    const queen = screen.getByLabelText('Beyaz Vezir');
    const king = screen.getByLabelText('Beyaz Şah');
    fireEvent.click(queen);
    fireEvent.click(king);
    expect(queen.className).not.toMatch(/ring-cyan-400/);
    expect(king.className).toMatch(/ring-cyan-400/);
  });
});

describe('BoardEditor — tıkla-ekle', () => {
  it('seçiliyken boş bir kareye tıklamak taşı oraya yerleştirir', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    const square = document.querySelector('[data-square="e4"]');
    expect(square).toBeTruthy();
    fireEvent.click(square!);
    expect(onChange).toHaveBeenCalled();
    const newFen = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(fenToMap(newFen)['e4']).toBe('Q');
  });

  it('seçiliyken art arda iki farklı kareye tıklamak seçim kalkmadan ikisini de yerleştirir', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BoardEditor fen="8/8/8/8/8/8/8/8 w - - 0 1" turn="w" onChange={onChange} onTurnChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    const fenAfterFirst = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // Gerçek kullanımda parent burada state'ini günceller ve BoardEditor'ı yeni fen ile
    // yeniden render eder — testte bunu manuel simüle ediyoruz.
    rerender(
      <BoardEditor fen={fenAfterFirst} turn="w" onChange={onChange} onTurnChange={vi.fn()} />,
    );
    fireEvent.click(document.querySelector('[data-square="a1"]')!);
    const lastFen = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const map = fenToMap(lastFen);
    expect(map['e4']).toBe('Q');
    expect(map['a1']).toBe('Q');
  });

  it('seçim yokken boş bir kareye tıklamak hiçbir şey yapmaz', () => {
    const { onChange } = setup();
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('seçiliyken dolu bir kareye tıklamak eski taşın yerine geçer (üst üste binmez)', () => {
    const { onChange } = setup('8/8/8/8/4P3/8/8/8 w - - 0 1'); // e4'te beyaz piyon
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    const newFen = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const map = fenToMap(newFen);
    expect(map['e4']).toBe('Q');
    expect(Object.keys(map)).toHaveLength(1); // sadece bir taş, ikisi üst üste değil
  });
});

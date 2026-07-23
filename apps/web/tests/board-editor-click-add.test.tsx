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

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PlacePiecesSolver } from '@/components/lesson-steps/PlacePiecesSolver';
import type { PlacePiecesEx } from '@/components/lesson-steps/BoardExercise';

const ex: PlacePiecesEx = {
  type: 'place_pieces',
  instruction: 'Eksik taşları yerleştir',
  fen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
  pieces: [
    { piece: 'Q', square: 'h5' },
    { piece: 'N', square: 'c6' },
  ],
};

function setup() {
  const onSolved = vi.fn();
  const onWrong = vi.fn();
  const r = render(<PlacePiecesSolver exercise={ex} disabled={false} onSolved={onSolved} onWrong={onWrong} />);
  return { ...r, onSolved, onWrong };
}

function ringOf(container: HTMLElement, square: string) {
  const sq = container.querySelector(`[data-square="${square}"]`) as HTMLElement;
  return sq.querySelector('div') as HTMLElement;
}

describe('PlacePiecesSolver — yerleştirme çemberleri', () => {
  it('doğru konan taşın karesi kalıcı yeşil çember alır', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz At' }));
    fireEvent.click(container.querySelector('[data-square="c6"]')!);
    const ring = ringOf(container, 'c6');
    expect(ring.style.borderRadius).toBe('50%');
    expect(ring.style.borderColor).toContain('22, 163, 74');
  });

  it('yanlış kareye denenince o kare kırmızı çember alır', () => {
    const { container, onWrong } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    fireEvent.click(container.querySelector('[data-square="a5"]')!);
    expect(onWrong).toHaveBeenCalledOnce();
    const ring = ringOf(container, 'a5');
    expect(ring.style.borderRadius).toBe('50%');
    expect(ring.style.borderColor).toContain('220, 38, 38');
  });

  it('yanlış çember bir süre sonra kaybolur', () => {
    vi.useFakeTimers();
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    fireEvent.click(container.querySelector('[data-square="a5"]')!);
    expect(ringOf(container, 'a5').style.borderRadius).toBe('50%');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(ringOf(container, 'a5').style.borderRadius).toBe('');
    vi.useRealTimers();
  });

  it('yanlış denemede taş tahtaya işlenmez, palette geri döner', () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    fireEvent.click(container.querySelector('[data-square="a5"]')!);
    expect(screen.getByRole('button', { name: 'Beyaz Vezir' })).toBeInTheDocument();
  });
});

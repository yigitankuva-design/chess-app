import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

function setup(over: Partial<Parameters<typeof PlacePiecesSolver>[0]> = {}) {
  const onSolved = vi.fn();
  const onWrong = vi.fn();
  const r = render(
    <PlacePiecesSolver exercise={ex} disabled={false} onSolved={onSolved} onWrong={onWrong} {...over} />,
  );
  return { ...r, onSolved, onWrong };
}

describe('PlacePiecesSolver', () => {
  it('eksik taşlar dairesel kartlarda gösterilir', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Beyaz Vezir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beyaz At' })).toBeInTheDocument();
  });

  it('tıkla-tıkla ile doğru yerleştirme kartı listeden düşürür', () => {
    const { container, onWrong } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz At' }));
    fireEvent.click(container.querySelector('[data-square="c6"]')!);
    expect(screen.queryByRole('button', { name: 'Beyaz At' })).not.toBeInTheDocument();
    expect(onWrong).not.toHaveBeenCalled();
  });

  it('tüm taşlar doğru konunca onSolved çağrılır', () => {
    const { container, onSolved } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz At' }));
    fireEvent.click(container.querySelector('[data-square="c6"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    fireEvent.click(container.querySelector('[data-square="h5"]')!);
    expect(onSolved).toHaveBeenCalledOnce();
  });

  it('yanlış kareye konursa TEK HAK — onWrong çağrılır', () => {
    const { container, onWrong, onSolved } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    fireEvent.click(container.querySelector('[data-square="a5"]')!);
    expect(onWrong).toHaveBeenCalledOnce();
    expect(onSolved).not.toHaveBeenCalled();
  });

  it('taş seçilmeden kareye tıklamak bir şey yapmaz', () => {
    const { container, onWrong } = setup();
    fireEvent.click(container.querySelector('[data-square="h5"]')!);
    expect(onWrong).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Beyaz Vezir' })).toBeInTheDocument();
  });

  it('sıra serbesttir — vezir önce konsa da olur', () => {
    const { container, onSolved } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    fireEvent.click(container.querySelector('[data-square="h5"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz At' }));
    fireEvent.click(container.querySelector('[data-square="c6"]')!);
    expect(onSolved).toHaveBeenCalledOnce();
  });
});

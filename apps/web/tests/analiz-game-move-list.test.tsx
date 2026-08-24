import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameMoveList } from '@/components/analiz/GameMoveList';

const MOVES = [
  { ply: 1, san: 'e4', fen_after: 'f1' },
  { ply: 2, san: 'e5', fen_after: 'f2' },
  { ply: 3, san: 'Nf3', fen_after: 'f3' },
];

describe('GameMoveList', () => {
  it('hamleleri numaralı çiftler halinde gösterir', () => {
    render(<GameMoveList moves={MOVES} currentPly={0} onSelectPly={vi.fn()} />);
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('Nf3')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });

  it('başta "Başa git"/"Geri" pasif, "İleri"/"Sona git" aktiftir', () => {
    render(<GameMoveList moves={MOVES} currentPly={0} onSelectPly={vi.fn()} />);
    expect(screen.getByLabelText('Başa git')).toBeDisabled();
    expect(screen.getByLabelText('Geri')).toBeDisabled();
    expect(screen.getByLabelText('İleri')).not.toBeDisabled();
    expect(screen.getByLabelText('Sona git')).not.toBeDisabled();
  });

  it('sonda "İleri"/"Sona git" pasiftir', () => {
    render(<GameMoveList moves={MOVES} currentPly={3} onSelectPly={vi.fn()} />);
    expect(screen.getByLabelText('İleri')).toBeDisabled();
    expect(screen.getByLabelText('Sona git')).toBeDisabled();
  });

  it('"İleri" tıklanınca bir sonraki ply ile çağrılır', () => {
    const onSelectPly = vi.fn();
    render(<GameMoveList moves={MOVES} currentPly={1} onSelectPly={onSelectPly} />);
    fireEvent.click(screen.getByLabelText('İleri'));
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('bir hamleye tıklayınca o ply ile çağrılır', () => {
    const onSelectPly = vi.fn();
    render(<GameMoveList moves={MOVES} currentPly={0} onSelectPly={onSelectPly} />);
    fireEvent.click(screen.getByText('Nf3'));
    expect(onSelectPly).toHaveBeenCalledWith(3);
  });

  it('hamle yokken bilgi mesajı gösterir', () => {
    render(<GameMoveList moves={[]} currentPly={0} onSelectPly={vi.fn()} />);
    expect(screen.getByText('Hamle yok.')).toBeInTheDocument();
  });
});

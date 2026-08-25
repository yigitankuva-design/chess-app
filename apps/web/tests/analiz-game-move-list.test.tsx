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
    render(<GameMoveList moves={MOVES} currentPly={0} onSelectPly={vi.fn()} onFlipBoard={vi.fn()} />);
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('Af3')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });

  it('başta "Başa git"/"Geri" pasif, "İleri"/"Sona git" aktiftir', () => {
    render(<GameMoveList moves={MOVES} currentPly={0} onSelectPly={vi.fn()} onFlipBoard={vi.fn()} />);
    expect(screen.getByLabelText('Başa git')).toBeDisabled();
    expect(screen.getByLabelText('Geri')).toBeDisabled();
    expect(screen.getByLabelText('İleri')).not.toBeDisabled();
    expect(screen.getByLabelText('Sona git')).not.toBeDisabled();
  });

  it('sonda "İleri"/"Sona git" pasiftir', () => {
    render(<GameMoveList moves={MOVES} currentPly={3} onSelectPly={vi.fn()} onFlipBoard={vi.fn()} />);
    expect(screen.getByLabelText('İleri')).toBeDisabled();
    expect(screen.getByLabelText('Sona git')).toBeDisabled();
  });

  it('"İleri" tıklanınca bir sonraki ply ile çağrılır', () => {
    const onSelectPly = vi.fn();
    render(<GameMoveList moves={MOVES} currentPly={1} onSelectPly={onSelectPly} onFlipBoard={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('İleri'));
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('bir hamleye tıklayınca o ply ile çağrılır', () => {
    const onSelectPly = vi.fn();
    render(<GameMoveList moves={MOVES} currentPly={0} onSelectPly={onSelectPly} onFlipBoard={vi.fn()} />);
    fireEvent.click(screen.getByText('Af3'));
    expect(onSelectPly).toHaveBeenCalledWith(3);
  });

  it('hamle yokken bilgi mesajı gösterir', () => {
    render(<GameMoveList moves={[]} currentPly={0} onSelectPly={vi.fn()} onFlipBoard={vi.fn()} />);
    expect(screen.getByText('Hamle yok.')).toBeInTheDocument();
  });
});

describe('GameMoveList — Tahtayı çevir (madde 2026-08-30/3)', () => {
  it('"Tahtayı çevir" butonu 5 kontrolün İLKİ olarak görünür ve her zaman aktiftir', () => {
    render(<GameMoveList moves={[]} currentPly={0} onSelectPly={vi.fn()} onFlipBoard={vi.fn()} />);
    const flipBtn = screen.getByLabelText('Tahtayı çevir');
    expect(flipBtn).not.toBeDisabled();
    const buttons = screen.getAllByRole('button').filter((b) =>
      ['Tahtayı çevir', 'Başa git', 'Geri', 'İleri', 'Sona git'].includes(b.getAttribute('aria-label') ?? ''));
    expect(buttons[0]).toBe(flipBtn);
  });

  it('tıklanınca onFlipBoard çağrılır', () => {
    const onFlipBoard = vi.fn();
    render(<GameMoveList moves={[]} currentPly={0} onSelectPly={vi.fn()} onFlipBoard={onFlipBoard} />);
    fireEvent.click(screen.getByLabelText('Tahtayı çevir'));
    expect(onFlipBoard).toHaveBeenCalledTimes(1);
  });
});

describe('GameMoveList — kart boyutu ve ikon büyüklüğü (madde 2026-08-31/3)', () => {
  const LABELS = ['Tahtayı çevir', 'Başa git', 'Geri', 'İleri', 'Sona git'];

  it('5 buton da AYNI (küçültülmüş) boyutta ve dikdörtgen kart şeklindedir', () => {
    render(<GameMoveList moves={[]} currentPly={0} onSelectPly={vi.fn()} onFlipBoard={vi.fn()} />);
    LABELS.forEach((label) => {
      expect(screen.getByLabelText(label)).toHaveStyle({ width: '58px', height: '43px' });
    });
  });

  it('5 butonun sarmalayıcısı sarmalamaz (flex-wrap YOK) — tek satırda kalır', () => {
    render(<GameMoveList moves={[]} currentPly={0} onSelectPly={vi.fn()} onFlipBoard={vi.fn()} />);
    const row = screen.getByLabelText('Tahtayı çevir').parentElement;
    expect(row?.className).not.toContain('flex-wrap');
  });

  it('5 butonun içindeki simgeler AYNI boyuttadır (20x20 SVG)', () => {
    render(<GameMoveList moves={[]} currentPly={0} onSelectPly={vi.fn()} onFlipBoard={vi.fn()} />);
    LABELS.forEach((label) => {
      const svg = screen.getByLabelText(label).querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });
  });
});

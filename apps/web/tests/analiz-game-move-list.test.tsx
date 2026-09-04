import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameMoveList } from '@/components/analiz/GameMoveList';

const MOVES = [
  { ply: 1, san: 'e4', fenAfter: 'f1' },
  { ply: 2, san: 'e5', fenAfter: 'f2' },
  { ply: 3, san: 'Nf3', fenAfter: 'f3' },
];

function setup(over: Partial<React.ComponentProps<typeof GameMoveList>> = {}) {
  const props: React.ComponentProps<typeof GameMoveList> = {
    moves: MOVES, currentPly: 0, onSelectPly: vi.fn(), onFlipBoard: vi.fn(),
    hideNotation: false, onToggleHideNotation: vi.fn(), onDeleteAfter: vi.fn(),
    ...over,
  };
  render(<GameMoveList {...props} />);
  return props;
}

describe('GameMoveList', () => {
  it('hamleleri "Hamleler" kartında numaralı tam-hamle çiftleri halinde gösterir', () => {
    setup();
    expect(screen.getByText('Hamleler')).toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('Af3')).toBeInTheDocument();
  });

  it('başta "Başa git"/"Geri" pasif, "İleri"/"Sona git" aktiftir', () => {
    setup();
    expect(screen.getByLabelText('Başa git')).toBeDisabled();
    expect(screen.getByLabelText('Geri')).toBeDisabled();
    expect(screen.getByLabelText('İleri')).not.toBeDisabled();
    expect(screen.getByLabelText('Sona git')).not.toBeDisabled();
  });

  it('sonda "İleri"/"Sona git" pasiftir', () => {
    setup({ currentPly: 3 });
    expect(screen.getByLabelText('İleri')).toBeDisabled();
    expect(screen.getByLabelText('Sona git')).toBeDisabled();
  });

  it('"İleri" tıklanınca bir sonraki ply ile çağrılır', () => {
    const onSelectPly = vi.fn();
    setup({ currentPly: 1, onSelectPly });
    fireEvent.click(screen.getByLabelText('İleri'));
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('bir hamleye tıklayınca o ply ile çağrılır', () => {
    const onSelectPly = vi.fn();
    setup({ onSelectPly });
    fireEvent.click(screen.getByText('Af3'));
    expect(onSelectPly).toHaveBeenCalledWith(3);
  });

  it('hamle yokken bilgi mesajı gösterir', () => {
    setup({ moves: [] });
    expect(screen.getByText('Henüz hamle yok.')).toBeInTheDocument();
  });

  it('madde 2026-09-04 (1c/3c/4c): bir hamlenin beyaz+siyah kısmı satır sınırında BÖLÜNMEZ', () => {
    const moves = [
      { ply: 1, san: 'e4', fenAfter: 'f1' },
      { ply: 2, san: 'e5', fenAfter: 'f2' },
      { ply: 3, san: 'Nf3', fenAfter: 'f3' },
      { ply: 4, san: 'Nc6', fenAfter: 'f4' },
    ];
    setup({ moves });
    expect(screen.queryAllByText('2.')).toHaveLength(1);
    expect(screen.queryByText(/2\.\.\./)).not.toBeInTheDocument();
    expect(screen.getByText('Ac6')).toBeInTheDocument();
  });
});

describe('GameMoveList — Tahtayı çevir (madde 2026-08-30/3)', () => {
  it('"Tahtayı çevir" butonu 5 kontrolün İLKİ olarak görünür ve her zaman aktiftir', () => {
    setup({ moves: [] });
    const flipBtn = screen.getByLabelText('Tahtayı çevir');
    expect(flipBtn).not.toBeDisabled();
    const buttons = screen.getAllByRole('button').filter((b) =>
      ['Tahtayı çevir', 'Başa git', 'Geri', 'İleri', 'Sona git'].includes(b.getAttribute('aria-label') ?? ''));
    expect(buttons[0]).toBe(flipBtn);
  });

  it('tıklanınca onFlipBoard çağrılır', () => {
    const onFlipBoard = vi.fn();
    setup({ moves: [], onFlipBoard });
    fireEvent.click(screen.getByLabelText('Tahtayı çevir'));
    expect(onFlipBoard).toHaveBeenCalledTimes(1);
  });
});

describe('GameMoveList — kart boyutu ve ikon büyüklüğü (madde 2026-08-31/3)', () => {
  const LABELS = ['Tahtayı çevir', 'Başa git', 'Geri', 'İleri', 'Sona git'];

  it('5 buton da AYNI (küçültülmüş) boyutta ve dikdörtgen kart şeklindedir', () => {
    setup({ moves: [] });
    LABELS.forEach((label) => {
      expect(screen.getByLabelText(label)).toHaveStyle({ width: '58px', height: '43px' });
    });
  });

  it('5 butonun sarmalayıcısı sarmalamaz (flex-wrap YOK) — tek satırda kalır', () => {
    setup({ moves: [] });
    const row = screen.getByLabelText('Tahtayı çevir').parentElement;
    expect(row?.className).not.toContain('flex-wrap');
  });

  it('5 butonun içindeki simgeler AYNI boyuttadır (20x20 SVG)', () => {
    setup({ moves: [] });
    LABELS.forEach((label) => {
      const svg = screen.getByLabelText(label).querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });
  });
});

describe('GameMoveList — Notasyon Verilerini Gizle (madde 2026-09-05 (4))', () => {
  it('onToggleHideNotation checkbox\'a tıklanınca çağrılır', () => {
    const onToggleHideNotation = vi.fn();
    setup({ onToggleHideNotation });
    fireEvent.click(screen.getByLabelText('Notasyon Verilerini Gizle'));
    expect(onToggleHideNotation).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategorizedPositionPool } from '@/components/admin/CategorizedPositionPool';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function setup(over: Partial<React.ComponentProps<typeof CategorizedPositionPool>> = {}) {
  const props = {
    fen: FEN, turn: 'w' as const,
    onFenChange: vi.fn(), onTurnChange: vi.fn(),
    onSavePosition: vi.fn(),
    pool: [] as { id: string; fen: string; category?: string | null }[],
    onDeletePosition: vi.fn(),
    onUpdatePosition: vi.fn(),
    ...over,
  };
  render(<CategorizedPositionPool {...props} />);
  return props;
}

describe('CategorizedPositionPool', () => {
  it('beş kategori kartı görünür', () => {
    setup();
    for (const ad of [
      'Piyon Finalleri', 'Kale Finalleri', 'Hafif Taşlar Arası Mücadele',
      'Ağır Taşlar Arası Mücadele', 'Ağır Taşlar ile Hafif Taşlar Arası Mücadele',
    ]) {
      expect(screen.getByText(ad)).toBeInTheDocument();
    }
  });

  it('başlangıçta hiçbir kategori açık değildir', () => {
    setup();
    expect(screen.queryByText('Konum Dizerek Ekle')).not.toBeInTheDocument();
  });

  it('bir karta tıklayınca konum ekleme alanı açılır', () => {
    setup();
    fireEvent.click(screen.getByText('Piyon Finalleri'));
    expect(screen.getByText('Konum Dizerek Ekle')).toBeInTheDocument();
    expect(screen.getByText('FEN Ekle')).toBeInTheDocument();
  });

  it('aynı anda tek kategori açık kalır', () => {
    setup();
    fireEvent.click(screen.getByText('Piyon Finalleri'));
    fireEvent.click(screen.getByText('Kale Finalleri'));
    // Tek bir ekleme alanı olmalı — iki kategori aynı anda açılmaz.
    expect(screen.getAllByText('Konum Dizerek Ekle')).toHaveLength(1);
  });

  it('kart başlığında o kategorideki konum sayısı görünür', () => {
    setup({
      pool: [
        { id: 'a', fen: FEN, category: 'Kale Finalleri' },
        { id: 'b', fen: FEN, category: 'Kale Finalleri' },
        { id: 'c', fen: FEN, category: 'Piyon Finalleri' },
      ],
    });
    expect(screen.getByText('Kale Finalleri').closest('button')).toHaveTextContent('2');
    expect(screen.getByText('Piyon Finalleri').closest('button')).toHaveTextContent('1');
  });

  it('kaydedilen konum açık kategoriyle birlikte bildirilir', () => {
    const p = setup();
    fireEvent.click(screen.getByText('Kale Finalleri'));
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(p.onSavePosition).toHaveBeenCalledWith(undefined, 'Kale Finalleri');
  });

  it('açık kategoride sadece o kategorinin konumları listelenir', () => {
    setup({
      pool: [
        { id: 'a', fen: FEN, category: 'Kale Finalleri' },
        { id: 'b', fen: FEN, category: 'Piyon Finalleri' },
      ],
    });
    fireEvent.click(screen.getByText('Kale Finalleri'));
    expect(screen.getByText(/Konum Havuzu/).closest('button')).toHaveTextContent('1');
  });

  it('kategorisiz eski konumlar varsa ayrı bir grupta gösterilir', () => {
    setup({ pool: [{ id: 'a', fen: FEN }] });
    expect(screen.getByText('Kategorisiz')).toBeInTheDocument();
  });

  it('kategorisiz konum yoksa o grup HİÇ görünmez', () => {
    setup({ pool: [{ id: 'a', fen: FEN, category: 'Piyon Finalleri' }] });
    expect(screen.queryByText('Kategorisiz')).not.toBeInTheDocument();
  });
});

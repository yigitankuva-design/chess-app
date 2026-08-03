import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlacePiecesFields } from '@/components/admin/PlacePiecesFields';

function setup(over: Partial<Parameters<typeof PlacePiecesFields>[0]> = {}) {
  const props = {
    fen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
    turn: 'w' as const,
    savedFen: null as string | null,
    selectedPiece: null as string | null,
    pieces: [] as { piece: string; square: string }[],
    annotations: [] as import('@/lib/chess/paintItems').PaintItem[],
    onAnnotationsChange: vi.fn(),
    onFenChange: vi.fn(),
    onTurnChange: vi.fn(),
    onSavePosition: vi.fn(),
    onSelectPiece: vi.fn(),
    onAddPair: vi.fn(),
    onRemovePair: vi.fn(),
    ...over,
  };
  return { ...render(<PlacePiecesFields {...props} />), props };
}

const SAVED = '7k/8/8/8/8/8/8/K7 w - - 0 1';

describe('PlacePiecesFields', () => {
  it('konum kaydedilmeden eklenecek taş paleti gösterilmez', () => {
    setup();
    expect(screen.queryByLabelText('Eklenecek taş paleti')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konumu Kaydet' })).toBeInTheDocument();
  });

  it('Konumu Kaydet basılınca onSavePosition çağrılır', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Konumu Kaydet' }));
    expect(props.onSavePosition).toHaveBeenCalledOnce();
  });

  it('konum kaydedilince taş paleti çıkar', () => {
    setup({ savedFen: SAVED });
    expect(screen.getByLabelText('Eklenecek taş paleti')).toBeInTheDocument();
  });

  it('paletten taş seçilince onSelectPiece çağrılır', () => {
    const { props } = setup({ savedFen: SAVED });
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    expect(props.onSelectPiece).toHaveBeenCalledWith('Q');
  });

  it('seçili taşa tekrar tıklamak seçimi kaldırır', () => {
    const { props } = setup({ savedFen: SAVED, selectedPiece: 'Q' });
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz Vezir' }));
    expect(props.onSelectPiece).toHaveBeenCalledWith(null);
  });

  it('eklenen çiftler listelenir ve silinebilir', () => {
    const { props } = setup({ savedFen: SAVED, pieces: [{ piece: 'Q', square: 'h5' }] });
    expect(screen.getByText(/Beyaz Vezir/)).toBeInTheDocument();
    expect(screen.getByText(/h5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sil h5/ }));
    expect(props.onRemovePair).toHaveBeenCalledWith(0);
  });
});

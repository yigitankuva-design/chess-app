import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MovePieceFields } from '@/components/admin/MovePieceFields';

const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';

describe('MovePieceFields', () => {
  it('fen null iken setup fazı: taş paleti ve "Konumu Kaydet" görünür', () => {
    render(<MovePieceFields fen={null} moves={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
    expect(screen.getByLabelText('Beyaz Vezir')).toBeInTheDocument(); // BoardEditor paleti
    expect(screen.queryByText('Notasyon Tablosu')).not.toBeInTheDocument();
  });

  it('"Konumu Kaydet" tıklanınca güncel FEN ile onChange çağrılır', () => {
    const onChange = vi.fn();
    render(<MovePieceFields fen={null} moves={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [calledFen, calledMoves] = onChange.mock.calls[0];
    expect(typeof calledFen).toBe('string');
    expect(calledMoves).toEqual([]);
  });

  it('fen doluyken recording fazı: Notasyon Tablosu ve "Konumu Düzenle" görünür', () => {
    render(<MovePieceFields fen={TWO_SIDED} moves={['Rh4']} onChange={vi.fn()} />);
    expect(screen.getByText('Notasyon Tablosu')).toBeInTheDocument();
    expect(screen.getByText('Konumu Düzenle')).toBeInTheDocument();
    expect(screen.queryByText('Konumu Kaydet')).not.toBeInTheDocument();
  });

  it('"Konumu Düzenle" setup fazına döner ve hamleleri sıfırlar', () => {
    const onChange = vi.fn();
    render(<MovePieceFields fen={TWO_SIDED} moves={['Rh4', 'Kf8']} onChange={onChange} />);
    fireEvent.click(screen.getByText('Konumu Düzenle'));
    expect(onChange).toHaveBeenCalledWith(null, []);
  });
});

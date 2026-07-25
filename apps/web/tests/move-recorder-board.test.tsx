import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveRecorderBoard } from '@/components/admin/MoveRecorderBoard';

const KINGLESS = '8/8/8/8/8/8/4P3/8 w - - 0 1';
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';

describe('MoveRecorderBoard', () => {
  it('ŞAHSIZ pozisyonda çökmeden 64 kare render eder', () => {
    const { container } = render(
      <MoveRecorderBoard fen={KINGLESS} moves={[]} onMovesChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('hamle yokken bilgilendirme metni gösterir', () => {
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={[]} onMovesChange={vi.fn()} />);
    expect(screen.getByText(/Henüz hamle yok/i)).toBeInTheDocument();
  });

  it('kaydedilen hamleleri Notasyon Tablosunda gösterir', () => {
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={['Rh4', 'Kf8']} onMovesChange={vi.fn()} />);
    expect(screen.getByText('Rh4')).toBeInTheDocument();
    expect(screen.getByText('Kf8')).toBeInTheDocument();
  });

  it('"Son Hamleyi Geri Al" son hamleyi çıkarır', () => {
    const onMovesChange = vi.fn();
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={['Rh4', 'Kf8']} onMovesChange={onMovesChange} />);
    fireEvent.click(screen.getByText('Son Hamleyi Geri Al'));
    expect(onMovesChange).toHaveBeenCalledWith(['Rh4']);
  });

  it('hamle yokken "Son Hamleyi Geri Al" devre dışı', () => {
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={[]} onMovesChange={vi.fn()} />);
    expect(screen.getByText('Son Hamleyi Geri Al')).toBeDisabled();
  });

  it('SIRA KİLİDİ: tek renkli pozisyonda hamle sonrası uyarı gösterir', () => {
    render(<MoveRecorderBoard fen={KINGLESS} moves={['e4']} onMovesChange={vi.fn()} />);
    expect(screen.getByText(/oynayabileceği taş yok/i)).toBeInTheDocument();
  });

  it('iki taraflı pozisyonda sıra uyarısı GÖSTERMEZ', () => {
    render(<MoveRecorderBoard fen={TWO_SIDED} moves={['Rh4']} onMovesChange={vi.fn()} />);
    expect(screen.queryByText(/oynayabileceği taş yok/i)).not.toBeInTheDocument();
  });
});

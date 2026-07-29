import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoveList } from '@/components/play/MoveList';

describe('MoveList — tahta altındaki notasyon (madde 1)', () => {
  it('hamle yokken bilgilendirir', () => {
    render(<MoveList san={[]} />);
    expect(screen.getByText('Henüz hamle yapılmadı.')).toBeInTheDocument();
  });

  it('hamleler numaralı satırlar hâlinde görünür', () => {
    render(<MoveList san={['e4', 'e5', 'Af3']} />);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('Af3')).toBeInTheDocument();
  });

  it('açılış konumundan başlayan maçta numara FEN’den devam eder', () => {
    render(
      <MoveList
        san={['Af6']}
        startFen="r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 3"
      />,
    );
    expect(screen.getByText('3.')).toBeInTheDocument();
    // Siyah once oynadi: beyaz hanesi bos gosterilir.
    expect(screen.getByText('…')).toBeInTheDocument();
  });
});

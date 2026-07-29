import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchHeader } from '@/components/play/MatchHeader';

const base = {
  whiteName: 'Zafer Dinç',
  blackName: 'Hasan Yiğit',
  whiteMs: 300_000,
  blackMs: 300_000,
  whiteToMove: true,
};

describe('MatchHeader — tahta üstü üç kart (madde 3)', () => {
  it('iki isim de ortadaki kartta görünür', () => {
    render(<MatchHeader {...base} />);
    // Ad hem orta kartta hem "Sıra:" satırında geçebilir.
    expect(screen.getAllByText(/Zafer Dinç/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hasan Yiğit/).length).toBeGreaterThan(0);
  });

  it('hangi saatin kime ait olduğu YAZAR', () => {
    render(<MatchHeader {...base} />);
    expect(screen.getByLabelText('Zafer Dinç saati')).toHaveTextContent('Beyaz');
    expect(screen.getByLabelText('Hasan Yiğit saati')).toHaveTextContent('Siyah');
  });

  it('sıra kimde olduğu yazar', () => {
    render(<MatchHeader {...base} />);
    expect(screen.getByText('Sıra: Zafer Dinç')).toBeInTheDocument();
  });

  it('me verilince "Sıra sende" / "Sıra rakipte" yazar', () => {
    const { rerender } = render(<MatchHeader {...base} me="white" />);
    expect(screen.getByText('Sıra sende')).toBeInTheDocument();
    rerender(<MatchHeader {...base} me="black" />);
    expect(screen.getByText('Sıra rakipte: Zafer Dinç')).toBeInTheDocument();
  });

  it('me verilince kendi adının yanında (Sen) yazar', () => {
    render(<MatchHeader {...base} me="black" />);
    expect(screen.getByText(/Hasan Yiğit \(Sen\)/)).toBeInTheDocument();
  });

  it('maç bitince sıra cümlesi yerine "Maç bitti" yazar', () => {
    render(<MatchHeader {...base} me="white" running={false} />);
    expect(screen.getByText('Maç bitti')).toBeInTheDocument();
    expect(screen.queryByText('Sıra sende')).not.toBeInTheDocument();
  });

  it('iki saat de gösterilir', () => {
    render(<MatchHeader {...base} />);
    expect(screen.getByLabelText('Zafer Dinç saati')).toHaveTextContent('05:00');
    expect(screen.getByLabelText('Hasan Yiğit saati')).toHaveTextContent('05:00');
  });

  it('sırası gelen oyuncunun saati aktiftir', () => {
    render(<MatchHeader {...base} />);
    expect(screen.getByLabelText('Zafer Dinç saati')).toHaveAttribute('data-active', 'true');
    expect(screen.getByLabelText('Hasan Yiğit saati')).toHaveAttribute('data-active', 'false');
  });

  it('maç bittiyse HİÇBİR saat aktif değildir', () => {
    render(<MatchHeader {...base} running={false} />);
    expect(screen.getByLabelText('Zafer Dinç saati')).toHaveAttribute('data-active', 'false');
    expect(screen.getByLabelText('Hasan Yiğit saati')).toHaveAttribute('data-active', 'false');
  });

  it('az süre kalınca vurgulanır', () => {
    render(<MatchHeader {...base} whiteMs={5_000} />);
    expect(screen.getByLabelText('Zafer Dinç saati')).toHaveAttribute('data-low', 'true');
  });

  it('saatsiz maçta kare çizilir ama süre yerine tire durur', () => {
    render(<MatchHeader {...base} whiteMs={null} blackMs={null} />);
    expect(screen.getByLabelText('Zafer Dinç saati')).toHaveTextContent('—');
  });
});

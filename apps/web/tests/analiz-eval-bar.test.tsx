import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvalBar } from '@/components/analiz/EvalBar';

describe('EvalBar', () => {
  it('eşit pozisyonda %50 civarında gösterir', () => {
    render(<EvalBar scoreCp={0} mate={null} />);
    const meter = screen.getByRole('meter');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBe(50);
  });

  it('beyaz avantajlıyken %50\'nin üstünde bir değer gösterir', () => {
    render(<EvalBar scoreCp={300} mate={null} />);
    const meter = screen.getByRole('meter');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(50);
  });

  it('siyah avantajlıyken %50\'nin altında bir değer gösterir', () => {
    render(<EvalBar scoreCp={-250} mate={null} />);
    const meter = screen.getByRole('meter');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeLessThan(50);
  });

  it('mat verilen tarafa göre uca yakın bir değer gösterir', () => {
    render(<EvalBar scoreCp={null} mate={3} />);
    expect(Number(screen.getByRole('meter').getAttribute('aria-valuenow'))).toBeGreaterThan(90);
  });

  it('skor yoksa %50 kalır', () => {
    render(<EvalBar scoreCp={null} mate={null} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '50');
  });

  it('madde 2026-09-03 (6): çubuğun içinde SAYISAL DEĞERLENDİRME metni YOKTUR', () => {
    const { container } = render(<EvalBar scoreCp={320} mate={null} />);
    expect(screen.queryByText('+3.2')).not.toBeInTheDocument();
    expect(container.querySelector('.font-mono')).not.toBeInTheDocument();
  });

  it('madde 2026-09-03 (6): çerçeve rengi belirgin (accent renkli, 2px)', () => {
    render(<EvalBar scoreCp={0} mate={null} />);
    expect(screen.getByRole('meter')).toHaveStyle({ border: '2px solid rgba(34,211,238,0.6)' });
  });
});

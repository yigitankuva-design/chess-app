import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvalBar } from '@/components/analiz/EvalBar';

describe('EvalBar', () => {
  it('eşit pozisyonda %50 civarında gösterir', () => {
    render(<EvalBar scoreCp={0} mate={null} />);
    const meter = screen.getByRole('meter');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBe(50);
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });

  it('beyaz avantajlıyken %50\'nin üstünde bir değer gösterir', () => {
    render(<EvalBar scoreCp={300} mate={null} />);
    const meter = screen.getByRole('meter');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(50);
    expect(screen.getByText('+3.0')).toBeInTheDocument();
  });

  it('siyah avantajlıyken %50\'nin altında bir değer gösterir', () => {
    render(<EvalBar scoreCp={-250} mate={null} />);
    const meter = screen.getByRole('meter');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeLessThan(50);
    expect(screen.getByText('-2.5')).toBeInTheDocument();
  });

  it('mat skorunu M ile gösterir', () => {
    render(<EvalBar scoreCp={null} mate={3} />);
    expect(screen.getByText('M3')).toBeInTheDocument();
  });

  it('skor yoksa tire gösterir, %50 kalır', () => {
    render(<EvalBar scoreCp={null} mate={null} />);
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '50');
  });
});

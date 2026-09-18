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

describe('EvalBar — madde 2026-09-18 (Antrenör Canlı Ders): showMarker', () => {
  it('showMarker verilmezse (varsayılan) işaretleyici/etiket HİÇ görünmez', () => {
    render(<EvalBar scoreCp={170} mate={null} />);
    expect(screen.queryByText('+1,7')).not.toBeInTheDocument();
  });

  it('showMarker true iken pozitif skor Türkçe virgüllü gösterilir (+1,7)', () => {
    render(<EvalBar scoreCp={170} mate={null} showMarker />);
    expect(screen.getByText('+1,7')).toBeInTheDocument();
  });

  it('showMarker true iken negatif skor gösterilir (-3,2)', () => {
    render(<EvalBar scoreCp={-320} mate={null} showMarker />);
    expect(screen.getByText('-3,2')).toBeInTheDocument();
  });

  it('showMarker true iken eşit pozisyonda 0,0 gösterilir', () => {
    render(<EvalBar scoreCp={0} mate={null} showMarker />);
    expect(screen.getByText('0,0')).toBeInTheDocument();
  });

  it('showMarker true iken mat durumunda "#N" gösterilir', () => {
    render(<EvalBar scoreCp={null} mate={3} showMarker />);
    expect(screen.getByText('#3')).toBeInTheDocument();
    render(<EvalBar scoreCp={null} mate={-2} showMarker />);
    expect(screen.getByText('-#2')).toBeInTheDocument();
  });

  it('işaretleyici, dolgu oranıyla AYNI dikey konumda (top) hareket eder', () => {
    const { container: highWhite } = render(<EvalBar scoreCp={900} mate={null} showMarker />);
    const { container: lowWhite } = render(<EvalBar scoreCp={-900} mate={null} showMarker />);
    const topOf = (c: HTMLElement) => (c.querySelector('[aria-hidden="true"]') as HTMLElement).style.top;
    // Beyaz çok üstünken işaretleyici çubuğun ÜST kısmına yakın (küçük top%),
    // siyah çok üstünken ALT kısmına yakın (büyük top%) olmalı.
    const highTop = parseFloat(topOf(highWhite));
    const lowTop = parseFloat(topOf(lowWhite));
    expect(highTop).toBeLessThan(lowTop);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoveLimitAnalysisSummary } from '@/components/play/MoveLimitAnalysisSummary';
import type { WhiteScore } from '@/lib/chess/moveQuality';

describe('MoveLimitAnalysisSummary (madde 2026-09-06 üçüncü tur/4)', () => {
  it('henüz değerlendirme bitmediyse ilerleme mesajı gösterir', () => {
    render(<MoveLimitAnalysisSummary evalByPly={{}} progress={{ done: 3, total: 10 }}
      totalPly={10} studentColor="w" />);
    expect(screen.getByText('İlerleme Tamamlandı')).toBeInTheDocument();
    expect(screen.getByText('Konum değerlendiriliyor... (3/10)')).toBeInTheDocument();
  });

  it('pozisyon net iyileştiyse olumlu mesaj gösterir', () => {
    const evalByPly: Record<number, WhiteScore> = {
      0: { cp: 20, mate: null },
      10: { cp: 220, mate: null },
    };
    render(<MoveLimitAnalysisSummary evalByPly={evalByPly} progress={{ done: 10, total: 10 }}
      totalPly={10} studentColor="w" />);
    expect(screen.getByText('Konumun iyileşti! (+2.00)')).toBeInTheDocument();
  });

  it('pozisyon net kötüleştiyse olumsuz mesaj gösterir', () => {
    const evalByPly: Record<number, WhiteScore> = {
      0: { cp: 20, mate: null },
      10: { cp: -180, mate: null },
    };
    render(<MoveLimitAnalysisSummary evalByPly={evalByPly} progress={{ done: 10, total: 10 }}
      totalPly={10} studentColor="w" />);
    expect(screen.getByText('Konumun kötüleşti (-2.00)')).toBeInTheDocument();
  });

  it('değişim küçükse nötr mesaj gösterir', () => {
    const evalByPly: Record<number, WhiteScore> = {
      0: { cp: 20, mate: null },
      10: { cp: 30, mate: null },
    };
    render(<MoveLimitAnalysisSummary evalByPly={evalByPly} progress={{ done: 10, total: 10 }}
      totalPly={10} studentColor="w" />);
    expect(screen.getByText('Konumun neredeyse aynı kaldı.')).toBeInTheDocument();
  });
});

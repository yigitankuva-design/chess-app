import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CandidateLines } from '@/components/analiz/CandidateLines';

describe('CandidateLines', () => {
  it('motor bilgisi ve 3 satırı gösterir', () => {
    render(
      <CandidateLines
        depth={20}
        lines={[
          { scoreCp: 50, mate: null, continuation: '1. e4 e5' },
          { scoreCp: 49, mate: null, continuation: '1. d4 d5' },
          { scoreCp: 29, mate: null, continuation: '1. Nf3 Nf6' },
        ]}
      />,
    );
    expect(screen.getByText(/Stockfish · Derinlik 20/)).toBeInTheDocument();
    expect(screen.getByText('+0.50')).toBeInTheDocument();
    expect(screen.getByText('1. e4 e5')).toBeInTheDocument();
    expect(screen.getByText('1. d4 d5')).toBeInTheDocument();
    expect(screen.getByText('1. Nf3 Nf6')).toBeInTheDocument();
  });

  it('mat skorunu # ile gösterir', () => {
    render(<CandidateLines depth={20} lines={[{ scoreCp: null, mate: 2, continuation: 'Qh4#' }]} />);
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('yükleniyor durumunda mesaj gösterir', () => {
    render(<CandidateLines depth={20} lines={[]} loading />);
    expect(screen.getByText(/analiz ediliyor/)).toBeInTheDocument();
  });

  it('boş ve yüklenmiyor durumunda "analiz alınamadı" gösterir', () => {
    render(<CandidateLines depth={20} lines={[]} />);
    expect(screen.getByText('Analiz alınamadı.')).toBeInTheDocument();
  });
});

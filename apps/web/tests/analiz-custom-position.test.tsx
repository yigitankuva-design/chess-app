import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
const analyzeMultiPv = vi.fn();
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    analyzeMultiPv(...args: unknown[]) { return analyzeMultiPv(...args); }
    destroy() {}
  },
}));

import { CustomPositionAnalysis } from '@/components/analiz/CustomPositionAnalysis';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

beforeEach(() => {
  analyzeMultiPv.mockReset();
  analyzeMultiPv.mockResolvedValue([]);
});

describe('CustomPositionAnalysis', () => {
  it('başlangıçta iki seçenek kartı görünür, AnalysisBoard henüz YOKTUR', () => {
    render(<CustomPositionAnalysis />);
    expect(screen.getByText('Konum Dizerek Ekle')).toBeInTheDocument();
    expect(screen.getByText('FEN Ekle')).toBeInTheDocument();
    expect(screen.queryByTestId('board')).not.toBeInTheDocument();
  });

  it('Konum Dizerek Ekle → Analiz Et basılınca AnalysisBoard başlangıç konumuyla görünür', async () => {
    render(<CustomPositionAnalysis />);
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    fireEvent.click(screen.getByText('🔍 Analiz Et'));
    expect(await screen.findByTestId('board')).toHaveAttribute('data-fen', START_FEN);
  });

  it('FEN Ekle: geçersiz FEN\'de kaydet/analiz butonu pasiftir', () => {
    render(<CustomPositionAnalysis />);
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: 'saçma metin' } });
    expect(screen.getByText(/geçerli değil/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🔍 Analiz Et' })).toBeDisabled();
  });

  it('FEN Ekle: geçerli FEN ile Analiz Et basılınca AnalysisBoard o FEN ile görünür', async () => {
    render(<CustomPositionAnalysis />);
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: START_FEN } });
    fireEvent.click(screen.getByRole('button', { name: '🔍 Analiz Et' }));
    expect(await screen.findByTestId('board')).toHaveAttribute('data-fen', START_FEN);
  });
});

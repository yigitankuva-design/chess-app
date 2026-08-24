import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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

import { AnalysisBoard } from '@/components/analiz/AnalysisBoard';

const FEN1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

beforeEach(() => {
  analyzeMultiPv.mockReset();
});

describe('AnalysisBoard', () => {
  it('mount olunca fen ile analyzeMultiPv çağrılır (skill 20, depth 20, multiPv 3), sonuç 3 satır olarak gösterilir', async () => {
    analyzeMultiPv.mockResolvedValue([
      { moveUci: 'e2e4', scoreCp: 40, mate: null, pvUci: ['e2e4', 'e7e5'] },
      { moveUci: 'd2d4', scoreCp: 20, mate: null, pvUci: ['d2d4'] },
      { moveUci: 'g1f3', scoreCp: -10, mate: null, pvUci: ['g1f3'] },
    ]);
    render(<AnalysisBoard fen={FEN1} />);

    expect(await screen.findByText('1. e4 e5')).toBeInTheDocument();
    expect(analyzeMultiPv).toHaveBeenCalledWith(FEN1, 20, 3);
    expect(screen.getByTestId('board')).toHaveAttribute('data-fen', FEN1);
  });

  it('fen değişince yeniden analiz eder', async () => {
    analyzeMultiPv.mockResolvedValue([{ moveUci: 'e7e5', scoreCp: -20, mate: null, pvUci: ['e7e5'] }]);
    const { rerender } = render(<AnalysisBoard fen={FEN1} />);
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalledTimes(1));

    rerender(<AnalysisBoard fen={FEN2} />);
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalledTimes(2));
    expect(analyzeMultiPv).toHaveBeenLastCalledWith(FEN2, 20, 3);
  });

  it('yarış koşulu: eski (yavaş) isteğin sonucu, yeni fen üzerine YAZILMAZ', async () => {
    let resolveFirst!: (v: unknown) => void;
    analyzeMultiPv.mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }));
    // FEN2'de sıra siyahta — devam dizisi FEN2 için GEÇERLİ bir hamle olmalı.
    analyzeMultiPv.mockResolvedValueOnce([{ moveUci: 'e7e5', scoreCp: -15, mate: null, pvUci: ['e7e5'] }]);

    const { rerender } = render(<AnalysisBoard fen={FEN1} />);
    rerender(<AnalysisBoard fen={FEN2} />);
    // İkinci (yeni) istek çözülür, ekranda onun sonucu görünür.
    await screen.findByText('1... e5');

    // Şimdi ESKİ (birinci) istek geç gelir — ekranı EZMEMELİ.
    resolveFirst([{ moveUci: 'e2e4', scoreCp: 999, mate: null, pvUci: ['e2e4'] }]);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('1... e5')).toBeInTheDocument();
    expect(screen.queryByText('+9.99')).not.toBeInTheDocument();
  });
});

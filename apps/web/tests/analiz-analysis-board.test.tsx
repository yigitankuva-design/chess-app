import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({
    fen, boardOrientation, interactive, onPieceDrop, onWheelStep, hideNotation,
  }: {
    fen: string; boardOrientation?: string; interactive?: boolean;
    onPieceDrop?: (from: string, to: string) => boolean;
    onWheelStep?: (delta: 1 | -1) => void; hideNotation?: boolean;
  }) => (
    <div data-testid="board" data-fen={fen} data-orientation={boardOrientation}
      data-interactive={interactive ? 'true' : 'false'}
      data-hide-notation={hideNotation ? 'true' : 'false'}
      onClick={() => onPieceDrop?.('e2', 'e4')}>
      <button type="button" data-testid="wheel-forward" onClick={() => onWheelStep?.(1)} />
    </div>
  ),
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
    expect(analyzeMultiPv).toHaveBeenCalledWith(FEN1, 14, 3, 700);
    expect(screen.getByTestId('board')).toHaveAttribute('data-fen', FEN1);
  });

  it('fen değişince yeniden analiz eder', async () => {
    analyzeMultiPv.mockResolvedValue([{ moveUci: 'e7e5', scoreCp: -20, mate: null, pvUci: ['e7e5'] }]);
    const { rerender } = render(<AnalysisBoard fen={FEN1} />);
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalledTimes(1));

    rerender(<AnalysisBoard fen={FEN2} />);
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalledTimes(2));
    expect(analyzeMultiPv).toHaveBeenLastCalledWith(FEN2, 14, 3, 700);
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

describe('AnalysisBoard — devam dizisi 4 hamleyle sınırlı (madde 2026-08-30/2)', () => {
  it('motor 4\'ten fazla hamle dönse bile yalnızca ilk 4\'ü gösterilir', async () => {
    analyzeMultiPv.mockResolvedValue([
      { moveUci: 'e2e4', scoreCp: 40, mate: null, pvUci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'] },
    ]);
    render(<AnalysisBoard fen={FEN1} />);
    expect(await screen.findByText('1. e4 e5 2. Af3 Ac6')).toBeInTheDocument();
    expect(screen.queryByText(/Bb5/)).not.toBeInTheDocument();
  });
});

describe('AnalysisBoard — boardOrientation (madde 2026-08-30/3)', () => {
  it('boardOrientation ChessBoard\'a aktarılır (varsayılan "white")', async () => {
    analyzeMultiPv.mockResolvedValue([]);
    render(<AnalysisBoard fen={FEN1} />);
    expect(screen.getByTestId('board')).toHaveAttribute('data-orientation', 'white');
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalled());
  });

  it('boardOrientation="black" verilince ChessBoard\'a aktarılır', async () => {
    analyzeMultiPv.mockResolvedValue([]);
    render(<AnalysisBoard fen={FEN1} boardOrientation="black" />);
    expect(screen.getByTestId('board')).toHaveAttribute('data-orientation', 'black');
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalled());
  });
});

describe('AnalysisBoard — interactive/onPieceDrop (madde 2026-09-02, "Yeni Analiz")', () => {
  it('varsayılan olarak interaktif DEĞİLDİR', async () => {
    analyzeMultiPv.mockResolvedValue([]);
    render(<AnalysisBoard fen={FEN1} />);
    expect(screen.getByTestId('board')).toHaveAttribute('data-interactive', 'false');
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalled());
  });

  it('interactive verilince ChessBoard\'a aktarılır', async () => {
    analyzeMultiPv.mockResolvedValue([]);
    render(<AnalysisBoard fen={FEN1} interactive onPieceDrop={() => true} />);
    expect(screen.getByTestId('board')).toHaveAttribute('data-interactive', 'true');
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalled());
  });

  it('onPieceDrop ChessBoard\'a aktarılır ve çağrılabilir', async () => {
    analyzeMultiPv.mockResolvedValue([]);
    const onPieceDrop = vi.fn(() => true);
    render(<AnalysisBoard fen={FEN1} interactive onPieceDrop={onPieceDrop} />);
    fireEvent.click(screen.getByTestId('board'));
    expect(onPieceDrop).toHaveBeenCalledWith('e2', 'e4');
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalled());
  });
});

describe('AnalysisBoard — onWheelStep/hideNotation (madde 2026-09-05 (2)(4))', () => {
  it('onWheelStep ChessBoard\'a aktarılır ve çağrılabilir', async () => {
    analyzeMultiPv.mockResolvedValue([]);
    const onWheelStep = vi.fn();
    render(<AnalysisBoard fen={FEN1} onWheelStep={onWheelStep} />);
    fireEvent.click(screen.getByTestId('wheel-forward'));
    expect(onWheelStep).toHaveBeenCalledWith(1);
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalled());
  });

  it('hideNotation varsayılan olarak false, verilince ChessBoard\'a aktarılır', async () => {
    analyzeMultiPv.mockResolvedValue([]);
    const { rerender } = render(<AnalysisBoard fen={FEN1} />);
    expect(screen.getByTestId('board')).toHaveAttribute('data-hide-notation', 'false');
    rerender(<AnalysisBoard fen={FEN1} hideNotation />);
    expect(screen.getByTestId('board')).toHaveAttribute('data-hide-notation', 'true');
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalled());
  });
});

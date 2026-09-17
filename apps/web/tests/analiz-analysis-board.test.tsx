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

// Madde 2026-09-18 (Analiz Et — Lichess Cloud Eval): varsayılan olarak
// `null` (bulunamadı) — mevcut testler bu şekilde AYNEN yerel motor
// akışını çalıştırmaya devam eder; ayrı testlerde "bulundu" senaryosu
// açıkça mock'lanır.
const fetchLichessCloudEval = vi.fn();
vi.mock('@/lib/chess/lichessCloudEval', () => ({
  fetchLichessCloudEval: (...args: unknown[]) => fetchLichessCloudEval(...args),
}));

import { AnalysisBoard } from '@/components/analiz/AnalysisBoard';

const FEN1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

beforeEach(() => {
  analyzeMultiPv.mockReset();
  fetchLichessCloudEval.mockReset();
  fetchLichessCloudEval.mockResolvedValue(null);
});

describe('AnalysisBoard', () => {
  it('mount olunca fen ile analyzeMultiPv çağrılır (skill 20, depth 18, multiPv 3), sonuç 3 satır olarak gösterilir', async () => {
    analyzeMultiPv.mockResolvedValue([
      { moveUci: 'e2e4', scoreCp: 40, mate: null, pvUci: ['e2e4', 'e7e5'] },
      { moveUci: 'd2d4', scoreCp: 20, mate: null, pvUci: ['d2d4'] },
      { moveUci: 'g1f3', scoreCp: -10, mate: null, pvUci: ['g1f3'] },
    ]);
    render(<AnalysisBoard fen={FEN1} />);

    expect(await screen.findByText('1. e4 e5')).toBeInTheDocument();
    // Madde 2026-09-05 (motor yükseltmesi): 14/700ms → 18/1200ms.
    expect(analyzeMultiPv).toHaveBeenCalledWith(FEN1, 18, 3, 1200);
    expect(screen.getByTestId('board')).toHaveAttribute('data-fen', FEN1);
  });

  it('fen değişince yeniden analiz eder', async () => {
    analyzeMultiPv.mockResolvedValue([{ moveUci: 'e7e5', scoreCp: -20, mate: null, pvUci: ['e7e5'] }]);
    const { rerender } = render(<AnalysisBoard fen={FEN1} />);
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalledTimes(1));

    rerender(<AnalysisBoard fen={FEN2} />);
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalledTimes(2));
    expect(analyzeMultiPv).toHaveBeenLastCalledWith(FEN2, 18, 3, 1200);
  });

  it('yarış koşulu: eski (yavaş) isteğin sonucu, yeni fen üzerine YAZILMAZ', async () => {
    let resolveFirst!: (v: unknown) => void;
    analyzeMultiPv.mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }));
    // FEN2'de sıra siyahta — devam dizisi FEN2 için GEÇERLİ bir hamle olmalı.
    analyzeMultiPv.mockResolvedValueOnce([{ moveUci: 'e7e5', scoreCp: -15, mate: null, pvUci: ['e7e5'] }]);

    const { rerender } = render(<AnalysisBoard fen={FEN1} />);
    // Madde 2026-09-18: artık motor çağrısından ÖNCE bir Lichess kontrolü var
    // — FEN1'in bu kontrolü geçip (yavaş) motor çağrısına ULAŞMASINI bekle,
    // yoksa senkron rerender FEN1'i Lichess aşamasında ("requestId eşleşmiyor")
    // motora hiç gitmeden eler ve bu testin senaryosu kurulamaz.
    await waitFor(() => expect(analyzeMultiPv).toHaveBeenCalledTimes(1));

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

describe('AnalysisBoard — Lichess Cloud Eval (madde 2026-09-18)', () => {
  it('Lichess sonuç dönerse yerel motor HİÇ çağrılmaz, "Lichess Cloud" etiketiyle gösterilir', async () => {
    fetchLichessCloudEval.mockResolvedValue({
      depth: 34,
      pvs: [
        { cp: 30, mate: null, movesUci: ['e2e4', 'e7e5'] },
        { cp: 20, mate: null, movesUci: ['d2d4'] },
      ],
    });
    render(<AnalysisBoard fen={FEN1} />);

    expect(await screen.findByText('1. e4 e5')).toBeInTheDocument();
    expect(screen.getByText(/Lichess Cloud · Derinlik 34/)).toBeInTheDocument();
    expect(analyzeMultiPv).not.toHaveBeenCalled();
  });

  it('Lichess bulamazsa (null) yerel motora düşülür, "Stockfish" etiketiyle gösterilir', async () => {
    fetchLichessCloudEval.mockResolvedValue(null);
    analyzeMultiPv.mockResolvedValue([
      { moveUci: 'e2e4', scoreCp: 40, mate: null, pvUci: ['e2e4', 'e7e5'] },
    ]);
    render(<AnalysisBoard fen={FEN1} />);

    expect(await screen.findByText('1. e4 e5')).toBeInTheDocument();
    expect(screen.getByText(/Stockfish · Derinlik 18/)).toBeInTheDocument();
    expect(analyzeMultiPv).toHaveBeenCalledWith(FEN1, 18, 3, 1200);
  });

  it('Lichess beyaz açısından gelen cp/mate\'i DEĞİŞTİRMEDEN kullanır (scoreForWhite uygulanmaz)', async () => {
    // Sırada SİYAH olsa bile (FEN2), Lichess'in cp'si zaten beyaz açısından —
    // yerel motor akışındaki gibi işaret çevrilmemeli.
    fetchLichessCloudEval.mockResolvedValue({
      depth: 30, pvs: [{ cp: -25, mate: null, movesUci: ['e7e5'] }],
    });
    render(<AnalysisBoard fen={FEN2} />);
    await screen.findByText('1... e5');
    expect(screen.getByText('-0.25')).toBeInTheDocument();
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

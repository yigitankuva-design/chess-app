import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let multiPvResult: { moveUci: string; scoreCp: number | null; mate: number | null; pvUci: string[] }[] = [];
let lastSkill: number | null = null;
let lastArgs: [string, number, number, number] | null = null;

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill(level: number) { lastSkill = level; }
    async analyzeMultiPv(fen: string, depth: number, multiPv: number, movetimeMs: number) {
      lastArgs = [fen, depth, multiPv, movetimeMs];
      return multiPvResult;
    }
    destroy() {}
  },
}));

import { CandidateMoveAnalysisPanel } from '@/components/admin/CandidateMoveAnalysisPanel';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('CandidateMoveAnalysisPanel — Aday Hamle Pratiği "Konumu Analiz Et" (madde 2026-09-15)', () => {
  it('geçersiz pozisyonda motora hiç gitmeden hata gösterir', async () => {
    render(<CandidateMoveAnalysisPanel fen="8/8/8/8/8/8/8/8 w - - 0 1" onAnalyzed={vi.fn()} />);
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    expect(await screen.findByText(/geçersiz/i)).toBeInTheDocument();
  });

  it('geçerli konumda motor en yüksek güçte (Skill 20, derinlik 20, multiPv 3) 3 aday hamle bulur ve onAnalyzed çağrılır', async () => {
    multiPvResult = [
      { moveUci: 'e2e4', scoreCp: 30, mate: null, pvUci: ['e2e4'] },
      { moveUci: 'd2d4', scoreCp: 25, mate: null, pvUci: ['d2d4'] },
      { moveUci: 'g1f3', scoreCp: 10, mate: null, pvUci: ['g1f3'] },
    ];
    const onAnalyzed = vi.fn();
    render(<CandidateMoveAnalysisPanel fen={START_FEN} onAnalyzed={onAnalyzed} />);
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));

    await waitFor(() => expect(screen.getByText('e4')).toBeInTheDocument());
    expect(screen.getByText('d4')).toBeInTheDocument();
    expect(screen.getByText('Nf3')).toBeInTheDocument();
    expect(lastSkill).toBe(20);
    expect(lastArgs).toEqual([START_FEN, 20, 3, 5000]);

    expect(onAnalyzed).toHaveBeenCalledTimes(1);
    const candidates = onAnalyzed.mock.calls[0][0];
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({ moveUci: 'e2e4', moveSan: 'e4', scoreCp: 30 });
  });

  it('motor hamle bulamazsa (mat/pat) onAnalyzed çağrılmaz', async () => {
    multiPvResult = [];
    const onAnalyzed = vi.fn();
    render(<CandidateMoveAnalysisPanel fen={START_FEN} onAnalyzed={onAnalyzed} />);
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    expect(await screen.findByText(/bulamadı/i)).toBeInTheDocument();
    expect(onAnalyzed).not.toHaveBeenCalled();
  });

  it('pozisyon (fen prop) değişince önceki analiz sonucu ekrandan kalkar', async () => {
    multiPvResult = [{ moveUci: 'e2e4', scoreCp: 30, mate: null, pvUci: ['e2e4'] }];
    const { rerender } = render(<CandidateMoveAnalysisPanel fen={START_FEN} onAnalyzed={vi.fn()} />);
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    await waitFor(() => expect(screen.getByText('e4')).toBeInTheDocument());

    const SIYAH_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    rerender(<CandidateMoveAnalysisPanel fen={SIYAH_FEN} onAnalyzed={vi.fn()} />);
    expect(screen.queryByText('e4')).not.toBeInTheDocument();
  });
});

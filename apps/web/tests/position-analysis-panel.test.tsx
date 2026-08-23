import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let analyzeResult: { bestMove: string | null; scoreCp: number | null; mate: number | null } = {
  bestMove: null, scoreCp: null, mate: null,
};
let lastSkill: number | null = null;
let lastAnalyzeDepth: number | null = null;

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill(level: number) { lastSkill = level; }
    async analyze(_fen: string, depth: number) {
      lastAnalyzeDepth = depth;
      return analyzeResult;
    }
    destroy() {}
  },
}));

import { PositionAnalysisPanel } from '@/components/admin/PositionAnalysisPanel';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Beyaz vezirle f7'de mat kurmuş bir pozisyon — Qxf7# hazır. */
const MATE_IN_1_FEN = 'rnb1kbnr/pppp1Qpp/8/4p3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 1';

describe('PositionAnalysisPanel — "Konumu Analiz Et" (madde: 2026-08-22)', () => {
  it('geçersiz pozisyonda (şah eksik) motora hiç gitmeden hata gösterir', async () => {
    render(<PositionAnalysisPanel fen="8/8/8/8/8/8/8/8 w - - 0 1" />);
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    expect(await screen.findByText(/geçersiz/i)).toBeInTheDocument();
  });

  it('geçerli konumda motor en yüksek güçte (Skill 20, derinlik 20) çalıştırılır', async () => {
    analyzeResult = { bestMove: 'e2e4', scoreCp: 30, mate: null };
    render(<PositionAnalysisPanel fen={START_FEN} />);
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    await waitFor(() => expect(screen.getByText(/Değerlendirme/)).toBeInTheDocument());
    expect(lastSkill).toBe(20);
    expect(lastAnalyzeDepth).toBe(20);
    expect(screen.getByText(/e4/)).toBeInTheDocument();
  });

  it('mat bulunca "mat veriyor" mesajı gösterir', async () => {
    analyzeResult = { bestMove: 'f7f8', scoreCp: null, mate: 1 };
    render(<PositionAnalysisPanel fen={MATE_IN_1_FEN} />);
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    expect(await screen.findByText(/mat veriyor/)).toBeInTheDocument();
  });
});

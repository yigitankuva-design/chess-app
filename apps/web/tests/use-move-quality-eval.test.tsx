import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const analyzeMultiPv = vi.fn();
const destroy = vi.fn();
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    analyzeMultiPv(...args: unknown[]) { return analyzeMultiPv(...args); }
    destroy() { destroy(); }
  },
}));

import { useMoveQualityEval } from '@/lib/chess/useMoveQualityEval';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const FEN_AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

beforeEach(() => {
  analyzeMultiPv.mockReset();
  destroy.mockReset();
  analyzeMultiPv.mockResolvedValue([{ moveUci: 'e2e4', scoreCp: 30, mate: null, pvUci: [] }]);
});

describe('useMoveQualityEval (madde 2026-09-05 (3))', () => {
  it('baseFen + 2 hamle için 3 pozisyonu (0,1,2) sırayla değerlendirir', async () => {
    const moves = [
      { ply: 1, fenAfter: FEN_AFTER_E4 },
      { ply: 2, fenAfter: FEN_AFTER_E5 },
    ];
    const { result } = renderHook(() => useMoveQualityEval(START_FEN, moves));

    await waitFor(() => expect(Object.keys(result.current.evalByPly)).toHaveLength(3));
    expect(result.current.evalByPly[0]).toBeDefined();
    expect(result.current.evalByPly[1]).toBeDefined();
    expect(result.current.evalByPly[2]).toBeDefined();
    expect(result.current.progress).toEqual({ done: 3, total: 3 });
    expect(analyzeMultiPv).toHaveBeenCalledTimes(3);
  });

  it('enabled=false iken hiçbir motor çağrısı yapılmaz', async () => {
    const moves = [{ ply: 1, fenAfter: FEN_AFTER_E4 }];
    renderHook(() => useMoveQualityEval(START_FEN, moves, false));
    await new Promise((r) => setTimeout(r, 20));
    expect(analyzeMultiPv).not.toHaveBeenCalled();
  });

  it('daha kısa bir moves dizisiyle yeniden render edilince (silme/dallanma) fazla ply budanır', async () => {
    const moves = [
      { ply: 1, fenAfter: FEN_AFTER_E4 },
      { ply: 2, fenAfter: FEN_AFTER_E5 },
    ];
    const { result, rerender } = renderHook(
      ({ m }: { m: typeof moves }) => useMoveQualityEval(START_FEN, m),
      { initialProps: { m: moves } },
    );
    await waitFor(() => expect(Object.keys(result.current.evalByPly)).toHaveLength(3));

    rerender({ m: [moves[0]] });
    await waitFor(() => expect(Object.keys(result.current.evalByPly).map(Number).sort((a, b) => a - b)).toEqual([0, 1]));
  });

  it('değerlendirme Beyaz açısından döner (scoreForWhite ile normalize)', async () => {
    // FEN_AFTER_E4'te sıra SİYAH'ta — motor siyah açısından -30 döndürsün,
    // Beyaz açısından +30 olarak saklanmalı.
    analyzeMultiPv.mockResolvedValue([{ moveUci: 'e7e5', scoreCp: -30, mate: null, pvUci: [] }]);
    const moves = [{ ply: 1, fenAfter: FEN_AFTER_E4 }];
    const { result } = renderHook(() => useMoveQualityEval(START_FEN, moves));

    await waitFor(() => expect(result.current.evalByPly[1]).toBeDefined());
    expect(result.current.evalByPly[1].cp).toBe(30);
  });
});

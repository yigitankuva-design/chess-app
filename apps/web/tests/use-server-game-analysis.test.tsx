import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useServerGameAnalysis } from '@/lib/chess/useServerGameAnalysis';

/**
 * Madde 2026-09-15 (sunucu analiz motoru): `useServerGameAnalysis` motoru
 * artık backend'de (native Stockfish) çalıştırıyor — bu hook SADECE
 * "iste (POST) + hazır değilse poll et (GET)" akışını yönetir. Gerçek
 * `fetch`/backend burada test edilmiyor (bkz. gameAnalysisApi'nin kendi
 * testi) — `requestGameAnalysis`/`fetchGameAnalysis` mock'lanır.
 */
const requestGameAnalysis = vi.fn();
const fetchGameAnalysis = vi.fn();
vi.mock('@/lib/chess/gameAnalysisApi', () => ({
  requestGameAnalysis: (...args: unknown[]) => requestGameAnalysis(...args),
  fetchGameAnalysis: (...args: unknown[]) => fetchGameAnalysis(...args),
}));

const RESULT = {
  summary: {
    inaccuracies: 1, mistakes: 0, blunders: 0, acpl: 20, accuracy: 90,
    phaseAccuracy: { opening: 90, middlegame: null, endgame: null }, mistakeMoves: [],
  },
  evalByPly: { 0: { cp: 0, mate: null } },
};

beforeEach(() => {
  requestGameAnalysis.mockReset();
  fetchGameAnalysis.mockReset();
});

describe('useServerGameAnalysis', () => {
  it('enabled=false iken hiçbir istek atılmaz', async () => {
    renderHook(() => useServerGameAnalysis(5, false));
    await new Promise((r) => setTimeout(r, 20));
    expect(requestGameAnalysis).not.toHaveBeenCalled();
  });

  it('gameId=null iken hiçbir istek atılmaz', async () => {
    renderHook(() => useServerGameAnalysis(null, true));
    await new Promise((r) => setTimeout(r, 20));
    expect(requestGameAnalysis).not.toHaveBeenCalled();
  });

  it('sonuç zaten hazırsa (POST direkt döner) poll etmeden "done" olur', async () => {
    requestGameAnalysis.mockResolvedValue(RESULT);
    const { result } = renderHook(() => useServerGameAnalysis(5, true));
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.summary).toEqual(RESULT.summary);
    expect(result.current.evalByPly).toEqual(RESULT.evalByPly);
    expect(fetchGameAnalysis).not.toHaveBeenCalled();
  });

  it('POST "pending" dönerse GET ile poll edilir, sonuç gelince "done" olur', async () => {
    requestGameAnalysis.mockResolvedValue({ status: 'pending' });
    fetchGameAnalysis.mockResolvedValueOnce(null).mockResolvedValueOnce(RESULT);
    const { result } = renderHook(() => useServerGameAnalysis(5, true));
    await waitFor(() => expect(result.current.status).toBe('pending'));
    await waitFor(() => expect(result.current.status).toBe('done'), { timeout: 4000 });
    expect(result.current.summary).toEqual(RESULT.summary);
  }, 8000);

  it('POST null dönerse (ağ/yetki hatası ya da maç bitmemiş) durum "error" olur', async () => {
    requestGameAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => useServerGameAnalysis(5, true));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('gameId değişince önceki isteğin geç gelen sonucu yoksayılır (nesil kontrolü)', async () => {
    let resolveFirst!: (v: unknown) => void;
    requestGameAnalysis.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
    requestGameAnalysis.mockResolvedValueOnce({ status: 'pending' });

    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useServerGameAnalysis(id, true),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });
    resolveFirst(RESULT); // gameId=1 için GEÇ gelen sonuç — artık geçersiz nesil.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.status).not.toBe('done');
  });
});

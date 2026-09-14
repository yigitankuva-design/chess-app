import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGameAnalysis, saveGameAnalysis } from '@/lib/chess/gameAnalysisApi';
import type { GameSummary } from '@/lib/chess/gameSummary';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

/**
 * Madde 2026-09-14 (3b/4): backend'in snake_case alanları ile frontend'in
 * GameSummary (camelCase) tipi arasındaki dönüşümü doğrular.
 */
describe('gameAnalysisApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('saveGameAnalysis doğru URL\'e, snake_case gövdeyle POST eder', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const summary: GameSummary = {
      inaccuracies: 1, mistakes: 2, blunders: 0, acpl: 55, accuracy: 80.4,
      phaseAccuracy: { opening: 90, middlegame: 70, endgame: null },
      mistakeMoves: [
        { ply: 5, fenBefore: 'FEN1', playedSan: 'a3', bestMove: 'e2e4', cpLoss: 110, severity: 'mistake' },
      ],
    };
    const ok = await saveGameAnalysis(9, summary);
    expect(ok).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/games/9/analysis');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      inaccuracies: 1, mistakes: 2, blunders: 0, acpl: 55, accuracy: 80.4,
      phase_accuracy_opening: 90, phase_accuracy_middlegame: 70, phase_accuracy_endgame: null,
      mistake_moves: [
        { ply: 5, fen_before: 'FEN1', played_san: 'a3', best_move: 'e2e4', cp_loss: 110, severity: 'mistake' },
      ],
    });
  });

  it('saveGameAnalysis sunucu hata dönerse false döner (istemciyi ÇÖKERTMEZ)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const ok = await saveGameAnalysis(9, {
      inaccuracies: 0, mistakes: 0, blunders: 0, acpl: null, accuracy: null,
      phaseAccuracy: { opening: null, middlegame: null, endgame: null }, mistakeMoves: [],
    });
    expect(ok).toBe(false);
  });

  it('fetchGameAnalysis backend yanıtını GameSummary\'ye (camelCase) çevirir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        inaccuracies: 3, mistakes: 1, blunders: 1, acpl: 60, accuracy: 72.5,
        phase_accuracy: { opening: 80, middlegame: 60, endgame: 90 },
        mistake_moves: [
          { ply: 2, fen_before: 'FEN2', played_san: 'b3', best_move: 'd2d4', cp_loss: 130, severity: 'blunder' },
        ],
      }),
    }));
    const summary = await fetchGameAnalysis(9);
    expect(summary).toEqual({
      inaccuracies: 3, mistakes: 1, blunders: 1, acpl: 60, accuracy: 72.5,
      phaseAccuracy: { opening: 80, middlegame: 60, endgame: 90 },
      mistakeMoves: [
        { ply: 2, fenBefore: 'FEN2', playedSan: 'b3', bestMove: 'd2d4', cpLoss: 130, severity: 'blunder' },
      ],
    });
  });

  it('fetchGameAnalysis 404 dönerse null döner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchGameAnalysis(9)).toBeNull();
  });

  it('fetchGameAnalysis ağ hatası fırlatırsa null döner (çökmez)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await fetchGameAnalysis(9)).toBeNull();
  });
});

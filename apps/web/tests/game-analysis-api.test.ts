import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestGameAnalysis, fetchGameAnalysis } from '@/lib/chess/gameAnalysisApi';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

/**
 * Madde 2026-09-15 (sunucu analiz motoru): motor artık backend'de çalışıyor
 * — istemci sadece TETİKLER (POST, requestGameAnalysis) ve sonucu okur
 * (GET, fetchGameAnalysis). Backend'in snake_case alanları ile frontend'in
 * GameSummary/WhiteScore (camelCase) tipleri arasındaki dönüşümü doğrular.
 */
const DONE_RESPONSE = {
  status: 'done',
  inaccuracies: 3, mistakes: 1, blunders: 1, acpl: 60, accuracy: 72.5,
  phase_accuracy: { opening: 80, middlegame: 60, endgame: 90 },
  mistake_moves: [
    { ply: 2, fen_before: 'FEN2', played_san: 'b3', best_move: 'd2d4', cp_loss: 130, severity: 'blunder' },
  ],
  eval_by_ply: [
    { ply: 0, cp: 0, mate: null },
    { ply: 1, cp: -130, mate: null },
  ],
};

const EXPECTED_RESULT = {
  summary: {
    inaccuracies: 3, mistakes: 1, blunders: 1, acpl: 60, accuracy: 72.5,
    phaseAccuracy: { opening: 80, middlegame: 60, endgame: 90 },
    mistakeMoves: [
      { ply: 2, fenBefore: 'FEN2', playedSan: 'b3', bestMove: 'd2d4', cpLoss: 130, severity: 'blunder' },
    ],
  },
  evalByPly: { 0: { cp: 0, mate: null }, 1: { cp: -130, mate: null } },
};

describe('gameAnalysisApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requestGameAnalysis doğru URL\'e gövdesiz POST eder', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'pending' }) });
    vi.stubGlobal('fetch', fetchMock);

    await requestGameAnalysis(9);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/games/9/analysis');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeUndefined();
  });

  it('requestGameAnalysis {status:"pending"} dönerse aynen döner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'pending' }) }));
    expect(await requestGameAnalysis(9)).toEqual({ status: 'pending' });
  });

  it('requestGameAnalysis zaten hazırsa sonucu (camelCase) döner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => DONE_RESPONSE }));
    expect(await requestGameAnalysis(9)).toEqual(EXPECTED_RESULT);
  });

  it('requestGameAnalysis sunucu hatasında null döner (istemciyi ÇÖKERTMEZ)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await requestGameAnalysis(9)).toBeNull();
  });

  it('fetchGameAnalysis backend yanıtını (camelCase + evalByPly) çevirir', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => DONE_RESPONSE }));
    expect(await fetchGameAnalysis(9)).toEqual(EXPECTED_RESULT);
  });

  it('fetchGameAnalysis 404 dönerse null döner (henüz hazır değil)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchGameAnalysis(9)).toBeNull();
  });

  it('fetchGameAnalysis ağ hatası fırlatırsa null döner (çökmez)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await fetchGameAnalysis(9)).toBeNull();
  });
});

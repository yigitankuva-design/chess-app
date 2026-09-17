import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLichessCloudEval } from '@/lib/chess/lichessCloudEval';

/** Madde 2026-09-18 (Analiz Et — Lichess Cloud Eval): doğru URL/parametre
 *  ile çağrıldığını doğrudan doğrular — gerçek uçtan uca testte (curl ile
 *  elle) `/api/cloud/eval` (yanlış) yerine `/api/cloud-eval` (doğru)
 *  olduğu ortaya çıkmıştı; bu test o regresyonu bir daha yakalasın. */
const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('fetchLichessCloudEval', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('doğru URL ve parametrelerle GET isteği atar (path: /api/cloud-eval, tireli)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ fen: FEN, depth: 34, pvs: [{ cp: 19, moves: 'e2e4 e7e5' }] }),
    } as Response);

    await fetchLichessCloudEval(FEN, 3);

    expect(fetch).toHaveBeenCalledWith(
      `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(FEN)}&multiPv=3`,
    );
  });

  it('200 yanıtını doğru şekle çevirir (moves boşluktan bölünür, mate yoksa null)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        fen: FEN, depth: 40,
        pvs: [{ cp: 19, moves: 'e2e4 e7e5 g1f3' }, { mate: 3, moves: 'd2d4' }],
      }),
    } as Response);

    const result = await fetchLichessCloudEval(FEN, 2);

    expect(result).toEqual({
      depth: 40,
      pvs: [
        { cp: 19, mate: null, movesUci: ['e2e4', 'e7e5', 'g1f3'] },
        { cp: null, mate: 3, movesUci: ['d2d4'] },
      ],
    });
  });

  it('404 (önbellekte yok) durumunda null döner', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await fetchLichessCloudEval(FEN, 3)).toBeNull();
  });

  it('ağ hatasında (fetch reject) null döner, hata fırlatmaz', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    await expect(fetchLichessCloudEval(FEN, 3)).resolves.toBeNull();
  });

  it('pvs boş dizi dönerse null kabul edilir (yerel motora düşülsün)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, json: async () => ({ fen: FEN, depth: 10, pvs: [] }),
    } as Response);
    expect(await fetchLichessCloudEval(FEN, 3)).toBeNull();
  });
});

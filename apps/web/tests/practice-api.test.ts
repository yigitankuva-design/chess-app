import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLessonScores, submitPracticeResult } from '@/lib/practice/practiceApi';

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchLessonScores', () => {
  it('token yoksa null döner ve ağa çıkmaz', async () => {
    expect(await fetchLessonScores(1)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('token varsa skorları ScoreMap e çevirir', async () => {
    sessionStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ scores: [
        { step_id: 10, mode: 'suresiz', best_score: 85 },
        { step_id: 10, mode: 'sureli', best_score: 40 },
        { step_id: 20, mode: 'suresiz', best_score: 60 },
      ] }),
    });
    expect(await fetchLessonScores(1)).toEqual({
      10: { suresiz: 85, sureli: 40 },
      20: { suresiz: 60 },
    });
  });

  it('sunucu hata verirse null döner (kilit uygulanmaz)', async () => {
    sessionStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await fetchLessonScores(1)).toBeNull();
  });

  it('ağ patlarsa null döner, hata fırlatmaz', async () => {
    sessionStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    expect(await fetchLessonScores(1)).toBeNull();
  });
});

describe('submitPracticeResult', () => {
  it('token yoksa null döner ve ağa çıkmaz', async () => {
    expect(await submitPracticeResult(5, 'suresiz', 17, 20)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('token varsa sunucu yanıtını döner', async () => {
    sessionStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ score: 85, best_score: 85, improved: true }),
    });
    expect(await submitPracticeResult(5, 'suresiz', 17, 20))
      .toEqual({ score: 85, best_score: 85, improved: true });
  });

  it('ağ patlarsa null döner (oturum sonucu yine gösterilebilsin)', async () => {
    sessionStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    expect(await submitPracticeResult(5, 'suresiz', 17, 20)).toBeNull();
  });
});

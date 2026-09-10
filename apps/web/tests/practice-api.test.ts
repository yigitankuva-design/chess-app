import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchLessonScores, submitPracticeResult, submitOdevAnswer, fetchOdevProgress,
} from '@/lib/practice/practiceApi';

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

// Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" soru soru kayıt.
describe('submitOdevAnswer / fetchOdevProgress', () => {
  it('token yoksa ikisi de null döner, ağa çıkmaz', async () => {
    expect(await submitOdevAnswer(5, 0, true)).toBeNull();
    expect(await fetchOdevProgress(5)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submitOdevAnswer question_index + correct gönderir, ilerlemeyi döner', async () => {
    sessionStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ total: 5, answered_count: 1, correct_count: 1, completed: false, per_question_correct: [true, null, null, null, null] }),
    });
    const r = await submitOdevAnswer(5, 0, true);
    expect(r?.answered_count).toBe(1);
    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((opts as { body: string }).body)).toEqual({ question_index: 0, correct: true });
  });

  it('fetchOdevProgress /odev/progress\'e gider', async () => {
    sessionStorage.setItem('chess_app_token', 'tk');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ total: 3, answered_count: 3, correct_count: 2, completed: true, per_question_correct: [true, false, true] }),
    });
    const r = await fetchOdevProgress(7);
    expect(r?.completed).toBe(true);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('/practice/steps/7/odev/progress');
  });
});

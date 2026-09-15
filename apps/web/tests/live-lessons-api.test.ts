import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import {
  fetchMyLiveLessons, fetchLiveLesson, createLiveLesson, startLiveLesson, endLiveLesson,
  requestLiveLessonJoin, pollLiveLessonJoinStatus, leaveLiveLesson, admitLiveLessonParticipant,
  liveLessonWsUrl,
} from '@/lib/liveLessonsApi';

beforeEach(() => { vi.restoreAllMocks(); });

describe('liveLessonsApi', () => {
  it('fetchMyLiveLessons — /live-lessons çağırır, listeyi döner', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true, json: async () => [{ id: 1 }] }));
    vi.stubGlobal('fetch', f);
    expect(await fetchMyLiveLessons()).toEqual([{ id: 1 }]);
    expect(f.mock.calls[0][0]).toContain('/live-lessons');
  });

  it('fetchMyLiveLessons — hata durumunda boş liste', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string) => Promise.resolve({ ok: false })));
    expect(await fetchMyLiveLessons()).toEqual([]);
  });

  it('fetchLiveLesson — /live-lessons/{id} çağırır', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true, json: async () => ({ id: 5 }) }));
    vi.stubGlobal('fetch', f);
    expect(await fetchLiveLesson(5)).toEqual({ id: 5 });
    expect(f.mock.calls[0][0]).toContain('/live-lessons/5');
  });

  it('createLiveLesson — doğru gövdeyle POST eder', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true, json: async () => ({ id: 9 }) }));
    vi.stubGlobal('fetch', f);
    const payload = { class_id: 1, title: 'X', scheduled_at: '2026-09-20T10:00:00Z', duration_minutes: 30, join_mode: 'auto' as const };
    const r = await createLiveLesson(payload);
    expect(r).toEqual({ id: 9 });
    const [url, opts] = f.mock.calls[0];
    expect(url).toContain('/live-lessons');
    expect(opts?.method).toBe('POST');
    expect(JSON.parse(opts?.body as string)).toEqual(payload);
  });

  it('startLiveLesson — POST /start çağırır, token+url döner', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true, json: async () => ({ token: 't', livekit_url: 'wss://x' }) }));
    vi.stubGlobal('fetch', f);
    const r = await startLiveLesson(5);
    expect(r).toEqual({ token: 't', livekit_url: 'wss://x' });
    expect(f.mock.calls[0][0]).toContain('/live-lessons/5/start');
  });

  it('endLiveLesson — POST /end çağırır', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', f);
    expect(await endLiveLesson(5)).toBe(true);
    expect(f.mock.calls[0][0]).toContain('/live-lessons/5/end');
  });

  it('requestLiveLessonJoin — pending sonucu aynen döner', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true, json: async () => ({ status: 'pending' }) })));
    expect(await requestLiveLessonJoin(5)).toEqual({ status: 'pending' });
  });

  it('pollLiveLessonJoinStatus — GET /join-status çağırır', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true, json: async () => ({ status: 'admitted', token: 't', livekit_url: 'wss://x' }) }));
    vi.stubGlobal('fetch', f);
    const r = await pollLiveLessonJoinStatus(5);
    expect(r).toEqual({ status: 'admitted', token: 't', livekit_url: 'wss://x' });
    expect(f.mock.calls[0][0]).toContain('/live-lessons/5/join-status');
  });

  it('leaveLiveLesson — POST /leave çağırır', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', f);
    expect(await leaveLiveLesson(5)).toBe(true);
    expect(f.mock.calls[0][0]).toContain('/live-lessons/5/leave');
  });

  it('admitLiveLessonParticipant — doğru gövdeyle POST eder', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', f);
    expect(await admitLiveLessonParticipant(5, 9, true)).toBe(true);
    const [url, opts] = f.mock.calls[0];
    expect(url).toContain('/live-lessons/5/admit');
    expect(JSON.parse(opts?.body as string)).toEqual({ child_id: 9, admit: true });
  });

  it('liveLessonWsUrl — http tabanını ws\'e çevirir, token taşır', () => {
    const url = liveLessonWsUrl(5);
    expect(url).toMatch(/^ws/);
    expect(url).toContain('/live-lessons/ws/live-lesson/5?token=tok');
  });
});

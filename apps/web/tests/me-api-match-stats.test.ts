import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { fetchMatchStats } from '@/lib/gamification/meApi';

/** Madde 2026-09-11 (Aşama C): kendi ucu vs antrenörün öğrenci ucu. */
describe('meApi — fetchMatchStats', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });

  it('childId yoksa /gamification/me/match-stats (sporcu VE antrenörün kendi profili)', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ 'Yıldırım': {} }) });
    const r = await fetchMatchStats();
    expect(r).toEqual({ 'Yıldırım': {} });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/gamification\/me\/match-stats$/);
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('childId verilince /teacher/students/{id}/match-stats; hata → null', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await fetchMatchStats(7);
    expect((fetchMock.mock.calls[0] as [string])[0]).toMatch(/\/teacher\/students\/7\/match-stats$/);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await fetchMatchStats()).toBeNull();
    fetchMock.mockRejectedValue(new Error('net'));
    expect(await fetchMatchStats()).toBeNull();
  });
});

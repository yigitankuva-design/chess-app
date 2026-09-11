import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { updateMyProfile, updateTeacherProfile } from '@/lib/gamification/meApi';

/** Madde 2026-09-11 (Aşama B / Madde 3): PATCH uçları + hata çevirisi. */
describe('meApi — profil düzenleme', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('updateMyProfile → PATCH /children/me/profile, gövde patch ile AYNI', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ nickname: 'A' }) });
    const r = await updateMyProfile({ nickname: 'A', province: 'Bilecik' });
    expect(r.ok).toBe(true);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/children\/me\/profile$/);
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body as string)).toEqual({ nickname: 'A', province: 'Bilecik' });
  });

  it('updateTeacherProfile → PATCH /teacher/me/profile, athlete_phone → phone çevrilir', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await updateTeacherProfile({ athlete_phone: '0532', lichess_username: 'h' });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/teacher\/me\/profile$/);
    expect(JSON.parse(opts.body as string)).toEqual({ phone: '0532', lichess_username: 'h' });
  });

  it('409 detail metni error olarak döner; ağ hatası "Sunucuya ulaşılamadı"', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ detail: 'Nickname 80 gün sonra tekrar deneyebilirsin' }) });
    const r = await updateMyProfile({ nickname: 'X' });
    expect(r).toEqual({ ok: false, error: 'Nickname 80 gün sonra tekrar deneyebilirsin' });
    fetchMock.mockRejectedValue(new Error('net'));
    expect(await updateMyProfile({ nickname: 'X' })).toEqual({ ok: false, error: 'Sunucuya ulaşılamadı' });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import {
  fetchNotifications, markNotificationVisited, odevTargetHref, NOTIFICATION_TYPE_META,
} from '@/lib/notificationsApi';

beforeEach(() => { vi.restoreAllMocks(); });

describe('notificationsApi', () => {
  it('fetchNotifications — /notifications çağırır ve gövdeyi döner', async () => {
    const f = vi.fn((_url: string) => Promise.resolve({
      ok: true, json: async () => ({ unread_count: 2, items: [{ id: 1 }] }),
    }));
    vi.stubGlobal('fetch', f);
    const r = await fetchNotifications();
    expect(r.unread_count).toBe(2);
    expect(f.mock.calls[0][0]).toContain('/notifications');
  });

  it('fetchNotifications — hata durumunda boş sonuç', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })));
    expect(await fetchNotifications()).toEqual({ unread_count: 0, items: [] });
  });

  it('fetchNotifications — ağ hatasında (throw) boş sonuç', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
    expect(await fetchNotifications()).toEqual({ unread_count: 0, items: [] });
  });

  it('markNotificationVisited — POST /notifications/{id}/visit çağırır', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', f);
    const ok = await markNotificationVisited(42);
    expect(ok).toBe(true);
    expect(f.mock.calls[0][0]).toContain('/notifications/42/visit');
    expect(f.mock.calls[0][1]?.method).toBe('POST');
  });

  it('odevTargetHref — pratik/suresiz linkini home/coach ile AYNI desende kurar', () => {
    const href = odevTargetHref({ lesson_step_id: 5, lesson_id: 10, alt_konu_title: 'Merkez Kavramı' });
    expect(href).toBe('/pratik/suresiz?konu=Merkez%20Kavram%C4%B1&step=5&ders=10');
  });

  it('NOTIFICATION_TYPE_META — 7 türün hepsi tanımlı (madde 2026-09-11, Aşama E: hoca_notu eklendi)', () => {
    expect(Object.keys(NOTIFICATION_TYPE_META).sort()).toEqual(
      ['eglence', 'hoca_notu', 'mac', 'odev', 'online_ders', 'pratik', 'turnuva'].sort(),
    );
  });
});

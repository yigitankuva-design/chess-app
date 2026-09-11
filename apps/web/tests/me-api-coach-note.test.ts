import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { writeCoachNote, deleteCoachNote } from '@/lib/gamification/meApi';

/** Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): antrenörün not
 *  yazma/silme uçları. */
describe('meApi — writeCoachNote / deleteCoachNote', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });

  it('writeCoachNote → PUT /teacher/students/{id}/note, gövde {text}', async () => {
    fetchMock.mockResolvedValue({
      ok: true, json: async () => ({ text: 'Aferin!', teacher_name: 'Hoca', created_at: '2026-09-11T10:00:00Z' }),
    });
    const r = await writeCoachNote(7, 'Aferin!');
    expect(r).toEqual({ text: 'Aferin!', teacher_name: 'Hoca', created_at: '2026-09-11T10:00:00Z' });
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/teacher\/students\/7\/note$/);
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body as string)).toEqual({ text: 'Aferin!' });
  });

  it('writeCoachNote hata durumunda null döner', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ detail: 'Not boş olamaz' }) });
    expect(await writeCoachNote(7, '')).toBeNull();
    fetchMock.mockRejectedValue(new Error('net'));
    expect(await writeCoachNote(7, 'x')).toBeNull();
  });

  it('deleteCoachNote → DELETE /teacher/students/{id}/note, başarı/başarısızlık', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    expect(await deleteCoachNote(7)).toBe(true);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/teacher\/students\/7\/note$/);
    expect(opts.method).toBe('DELETE');

    fetchMock.mockResolvedValue({ ok: false });
    expect(await deleteCoachNote(7)).toBe(false);
  });
});

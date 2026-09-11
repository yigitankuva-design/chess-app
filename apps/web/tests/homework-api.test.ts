import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import {
  fetchHomeworkTarget, sendHomework, fetchMyClasses, fetchClassStudents, fetchSentHomework,
} from '@/lib/homeworkApi';

beforeEach(() => { vi.restoreAllMocks(); });

describe('homeworkApi', () => {
  it('fetchHomeworkTarget — section_id ile /homework/target çağırır', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({
      ok: true, json: async () => ({ linked: true, lesson_step_id: 5 }),
    }));
    vi.stubGlobal('fetch', f);
    const r = await fetchHomeworkTarget(42);
    expect(r).toEqual({ linked: true, lesson_step_id: 5 });
    expect(f.mock.calls[0][0]).toContain('/homework/target?section_id=42');
  });

  it('sendHomework — POST /homework, gövde alanlarını gönderir', async () => {
    const f = vi.fn((_url: string, _opts?: RequestInit) => Promise.resolve({
      ok: true, json: async () => ({ id: 1, recipient_count: 3 }),
    }));
    vi.stubGlobal('fetch', f);
    const r = await sendHomework({
      lesson_step_id: 5, source_section_id: 9, child_ids: [1, 2], class_ids: [7],
      start_date: '2026-09-15', end_date: '2026-09-30', note: 'not',
    });
    expect(r).toEqual({ id: 1, recipient_count: 3 });
    const [url, opts] = f.mock.calls[0];
    expect(url).toContain('/homework');
    expect(opts?.method).toBe('POST');
    const body = JSON.parse(opts?.body as string);
    expect(body.lesson_step_id).toBe(5);
    expect(body.class_ids).toEqual([7]);
    expect(body.child_ids).toEqual([1, 2]);
  });

  it('sendHomework — hata dönerse null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await sendHomework({ lesson_step_id: 1, start_date: '2026-09-15' })).toBeNull();
  });

  it('fetchMyClasses / fetchClassStudents / fetchSentHomework — hata durumunda boş dizi', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await fetchMyClasses()).toEqual([]);
    expect(await fetchClassStudents(1)).toEqual([]);
    expect(await fetchSentHomework()).toEqual([]);
  });
});

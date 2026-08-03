import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ back: vi.fn() }),
}));

import AdminModuleLessonsPage from '@/app/admin/content/[id]/page';

const LESSONS = [{
  id: 7, module_id: 1, order_index: 1, title: 'Piyon Hareketleri',
  estimated_minutes: 10, published: true, step_count: 2,
}];
const MODULES = [{ id: 1, order_index: 1, name: 'Temel Düzey', lesson_count: 1 }];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    if (opts?.method === 'PATCH') return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    if (url.includes('/lessons')) return Promise.resolve({ ok: true, json: () => Promise.resolve(LESSONS) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(MODULES) });
  }) as unknown as typeof fetch);
});

describe('Admin dersler sayfası — ders başlığı düzenleme (A grubu madde 2)', () => {
  it('düzenle tıklanınca başlık değişir ve PATCH /admin/lessons/7 çağrılır', async () => {
    render(<AdminModuleLessonsPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));

    fireEvent.click(screen.getByLabelText('Piyon Hareketleri ders başlığını düzenle'));
    fireEvent.change(screen.getByLabelText('Piyon Hareketleri ders başlığını düzenle'), {
      target: { value: 'Piyon ve At Hareketleri' },
    });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain('/admin/lessons/7');
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ title: 'Piyon ve At Hareketleri' });
    });
  });
});

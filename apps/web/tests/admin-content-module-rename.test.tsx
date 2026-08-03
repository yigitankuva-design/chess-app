import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import AdminContentPage from '@/app/admin/content/page';

const ROWS = [{ id: 1, order_index: 1, name: 'Temel Düzey', lesson_count: 3 }];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((_url: string, opts?: RequestInit) => {
    if (opts?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(ROWS) });
  }) as unknown as typeof fetch);
});

describe('Admin içerik sayfası — düzey adı düzenleme (A grubu madde 2)', () => {
  it('düzenle tıklanınca isim değişir ve PATCH /admin/modules/1 çağrılır', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));

    fireEvent.click(screen.getByLabelText('Temel Düzey düzey adını düzenle'));
    const input = screen.getByLabelText('Temel Düzey düzey adını düzenle');
    fireEvent.change(input, { target: { value: 'İleri Düzey' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain('/admin/modules/1');
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ name: 'İleri Düzey' });
    });
  });

  it('düzenle butonuna tıklamak düzey sayfasına gitmez (Link navigasyonu durur)', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    const editBtn = screen.getByLabelText('Temel Düzey düzey adını düzenle');
    const evt = fireEvent.click(editBtn);
    expect(evt).toBe(false);
  });
});

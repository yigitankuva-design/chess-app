import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import AdminOpeningsPage from '@/app/admin/openings/page';

const OPENINGS = [
  { id: 1, name: 'İtalyan Açılışı', start_fen: 'FEN1' },
  { id: 2, name: 'Sicilya', start_fen: 'FEN2' },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    const method = opts?.method ?? 'GET';
    if (method === 'GET' || String(url).endsWith('/openings')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(OPENINGS) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch);
});

describe('Admin Açılış Listesi — düzenleme (madde 7)', () => {
  it('Düzenle tıklanınca ad/FEN alanları açılır ve dolu gelir', async () => {
    render(<AdminOpeningsPage />);
    await waitFor(() => screen.getByText('İtalyan Açılışı'));

    fireEvent.click(screen.getAllByText('Düzenle')[0]);

    expect(screen.getByDisplayValue('İtalyan Açılışı')).toBeInTheDocument();
    expect(screen.getByDisplayValue('FEN1')).toBeInTheDocument();
  });

  it('Kaydet PATCH isteği gönderir', async () => {
    render(<AdminOpeningsPage />);
    await waitFor(() => screen.getByText('İtalyan Açılışı'));

    fireEvent.click(screen.getAllByText('Düzenle')[0]);
    fireEvent.change(screen.getByDisplayValue('İtalyan Açılışı'), { target: { value: 'Yeni Ad' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const patchCall = calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain('/admin/openings/1');
    });
  });
});

describe('Admin Açılış Listesi — sıralama (madde 8)', () => {
  it('en üstteki açılışın YUKARI oku kilitlidir', async () => {
    render(<AdminOpeningsPage />);
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    expect(screen.getByLabelText('İtalyan Açılışı yukarı taşı')).toBeDisabled();
  });

  it('en alttaki açılışın AŞAĞI oku kilitlidir', async () => {
    render(<AdminOpeningsPage />);
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    expect(screen.getByLabelText('Sicilya aşağı taşı')).toBeDisabled();
  });

  it('aşağı tıklanınca /move isteği direction: down ile gider', async () => {
    render(<AdminOpeningsPage />);
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByLabelText('İtalyan Açılışı aşağı taşı'));

    await waitFor(() => {
      const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const moveCall = calls.find((c) => String(c[0]).includes('/move'));
      expect(moveCall).toBeTruthy();
      expect(moveCall![0]).toContain('/admin/openings/1/move');
      expect(JSON.parse((moveCall![1] as RequestInit).body as string)).toEqual({ direction: 'down' });
    });
  });
});

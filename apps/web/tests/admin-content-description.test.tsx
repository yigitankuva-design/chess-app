import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import AdminContentPage from '@/app/admin/content/page';

const ROWS_WITH_DESC = [
  { id: 1, order_index: 1, name: 'Temel Düzey', description: '', lesson_count: 0 },
];
const ROWS_FILLED = [
  { id: 1, order_index: 1, name: 'Temel Düzey', description: 'Var olan açıklama.', lesson_count: 0 },
];

function mockFetch(rows: unknown[]) {
  vi.stubGlobal('fetch', vi.fn((_url: string, opts?: RequestInit) => {
    if (opts?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(rows) });
  }) as unknown as typeof fetch);
}

describe('Admin içerik sayfası — düzey açıklaması (madde 2026-09-05 (1))', () => {
  beforeEach(() => { mockFetch(ROWS_WITH_DESC); });

  it('açıklama boşsa "+ Açıklama Ekle" gösterilir', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    expect(screen.getByText('+ Açıklama Ekle')).toBeInTheDocument();
  });

  it('"+ Açıklama Ekle" tıklanınca textarea açılır ve modül adına uygun öneri butonu görünür', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('+ Açıklama Ekle'));
    expect(screen.getByPlaceholderText(/Bu düzey kimin için uygun/)).toBeInTheDocument();
    expect(screen.getByText('Önerilen açıklamayı kullan')).toBeInTheDocument();
  });

  it('öneri butonuna basınca textarea Zafer\'in tanımladığı metinle dolar', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('+ Açıklama Ekle'));
    fireEvent.click(screen.getByText('Önerilen açıklamayı kullan'));
    const textarea = screen.getByPlaceholderText(/Bu düzey kimin için uygun/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('ELO puan aralığı 0-399');
  });

  it('Kaydet ile PATCH /admin/modules/1 açıklamayı gönderir', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('+ Açıklama Ekle'));
    const textarea = screen.getByPlaceholderText(/Bu düzey kimin için uygun/);
    fireEvent.change(textarea, { target: { value: 'Elle yazılan açıklama.' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain('/admin/modules/1');
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ description: 'Elle yazılan açıklama.' });
    });
  });

  it('Düzenle butonuna tıklamak düzey sayfasına gitmez (Link navigasyonu durur)', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('+ Açıklama Ekle'));
    const evt = fireEvent.click(screen.getByText('+ Açıklama Ekle'));
    expect(evt).toBe(false);
  });
});

describe('Admin içerik sayfası — mevcut açıklama gösterimi', () => {
  it('açıklama doluysa metni gösterir ve "Düzenle" butonu sunar', async () => {
    mockFetch(ROWS_FILLED);
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Var olan açıklama.'));
    expect(screen.getByText('Düzenle')).toBeInTheDocument();
    // Açıklama zaten doluyken öneri butonu YOK (yalnızca boşken/düzenlerken önerilir).
    fireEvent.click(screen.getByText('Düzenle'));
    expect(screen.queryByText('Önerilen açıklamayı kullan')).not.toBeInTheDocument();
  });
});

describe('Admin içerik sayfası — düzey konu özeti (madde 2026-09-07 (2))', () => {
  beforeEach(() => { mockFetch(ROWS_WITH_DESC); });

  it('konular boşsa "+ Konu Ekle" gösterilir', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    expect(screen.getByText('+ Konu Ekle')).toBeInTheDocument();
  });

  it('"+ Konu Ekle" tıklanınca textarea açılır ve Temel Düzey için öneri butonu görünür', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('+ Konu Ekle'));
    expect(screen.getByPlaceholderText(/hangi konular işleniyor/)).toBeInTheDocument();
    expect(screen.getByText('Önerilen konuları kullan')).toBeInTheDocument();
  });

  it('öneri butonuna basınca textarea Zafer\'in verdiği metinle dolar', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('+ Konu Ekle'));
    fireEvent.click(screen.getByText('Önerilen konuları kullan'));
    const textarea = screen.getByPlaceholderText(/hangi konular işleniyor/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Satranç Tahtası, Taşlar ve Temel Kurallar');
  });

  it('Kaydet ile PATCH /admin/modules/1 konuları gönderir', async () => {
    render(<AdminContentPage />);
    await waitFor(() => screen.getByText('Temel Düzey'));
    fireEvent.click(screen.getByText('+ Konu Ekle'));
    const textarea = screen.getByPlaceholderText(/hangi konular işleniyor/);
    fireEvent.change(textarea, { target: { value: 'Elle yazılan konu özeti.' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find((c: unknown[]) => (c[1] as RequestInit)?.method === 'PATCH');
      expect(patchCall).toBeTruthy();
      expect(patchCall![0]).toContain('/admin/modules/1');
      expect(JSON.parse((patchCall![1] as RequestInit).body as string)).toEqual({ topics: 'Elle yazılan konu özeti.' });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));

import { OpeningCategoryCards } from '@/components/admin/OpeningCategoryCards';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

function openingsFixture() {
  return [{
    id: 1, name: 'İtalyan Açılışı', category: 'e4',
    variants: [{ id: 11, name: 'Klasik Varyant', start_fen: FEN }],
  }];
}

beforeEach(() => {
  global.fetch = vi.fn((url: string, opts?: RequestInit) => {
    const method = opts?.method ?? 'GET';
    if (String(url).endsWith('/openings') && method === 'GET') {
      return Promise.resolve({ ok: true, json: async () => openingsFixture() } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as unknown as typeof fetch;
});

async function open() {
  render(<OpeningCategoryCards color="#38bdf8" />);
  fireEvent.click(screen.getByRole('button', { name: /Açılış Pratiği Yap kartını aç/ }));
  fireEvent.click(await screen.findByRole('button', { name: /e4'lü Açılışlar kartını aç/ }));
  await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
}

describe('OpeningCategoryCards — admin (madde: 2026-08-20, varyant seviyesi)', () => {
  it('kategori kartı açılınca açılış İSİMLERİ listelenir, "X varyant" sayısı görünür', async () => {
    await open();
    expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument();
    expect(screen.getByText('1 varyant')).toBeInTheDocument();
  });

  it('"Açılış ismi ekle" formunda FEN alanı YOKTUR', async () => {
    await open();
    expect(screen.getByPlaceholderText('Açılış adı (örn. İtalyan Açılışı)')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/FEN/)).not.toBeInTheDocument();
  });

  it('açılış ismine tıklanınca "Varyant ekle" bölümü açılır (isim + FEN alanları)', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /İtalyan Açılışı varyantlarını aç/ }));
    expect(screen.getByPlaceholderText('Varyant adı (örn. Klasik Varyant)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Varyanta ait FEN')).toBeInTheDocument();
    expect(screen.getByText('Klasik Varyant')).toBeInTheDocument();
    expect(screen.getByText(FEN)).toBeInTheDocument();
  });

  it('açılış ismi eklerken sadece {name, category} gönderilir (start_fen YOK)', async () => {
    await open();
    fireEvent.change(screen.getByPlaceholderText('Açılış adı (örn. İtalyan Açılışı)'), {
      target: { value: 'Sicilya' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Açılış ismi ekle' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/openings'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Sicilya', category: 'e4' }),
      }),
    ));
  });

  it('varyant eklerken {name, start_fen} doğru endpoint\'e gönderilir', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /İtalyan Açılışı varyantlarını aç/ }));
    fireEvent.change(screen.getByPlaceholderText('Varyant adı (örn. Klasik Varyant)'), {
      target: { value: 'Giuoco Piano' },
    });
    fireEvent.change(screen.getByPlaceholderText('Varyanta ait FEN'), { target: { value: FEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Varyant ekle' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/openings/1/variants'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Giuoco Piano', start_fen: FEN }),
      }),
    ));
  });

  it('varyant yoksa "Bu açılışta henüz varyant yok." gösterir', async () => {
    global.fetch = vi.fn((url: string) => {
      if (String(url).endsWith('/openings')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 1, name: 'Boş Açılış', category: 'e4', variants: [] }],
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    }) as unknown as typeof fetch;
    render(<OpeningCategoryCards color="#38bdf8" />);
    fireEvent.click(screen.getByRole('button', { name: /Açılış Pratiği Yap kartını aç/ }));
    fireEvent.click(await screen.findByRole('button', { name: /e4'lü Açılışlar kartını aç/ }));
    await waitFor(() => expect(screen.getByText('Boş Açılış')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Boş Açılış varyantlarını aç/ }));
    expect(screen.getByText('Bu açılışta henüz varyant yok.')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));

import { OpeningCategoryCards } from '@/components/admin/OpeningCategoryCards';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

function typesFixture() {
  return [{
    id: 1, name: "e4'lü Açılışlar",
    openings: [{
      id: 1, name: 'İtalyan Açılışı',
      variants: [{ id: 11, name: 'Klasik Varyant', start_fen: FEN }],
    }],
  }];
}

beforeEach(() => {
  global.fetch = vi.fn((url: string, opts?: RequestInit) => {
    const method = opts?.method ?? 'GET';
    if (String(url).endsWith('/openings') && method === 'GET') {
      return Promise.resolve({ ok: true, json: async () => typesFixture() } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as unknown as typeof fetch;
});

async function open() {
  render(<OpeningCategoryCards color="#38bdf8" />);
  fireEvent.click(screen.getByRole('button', { name: /Açılış Pratiği İçeriği kartını aç/ }));
  fireEvent.click(await screen.findByRole('button', { name: /e4'lü Açılışlar kartını aç/ }));
  await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
}

describe('OpeningCategoryCards — admin (madde: 2026-08-20, açılış türü seviyesi)', () => {
  it('"Açılış türü ekle" formu görünür, FEN ve isim alanı içermez', async () => {
    render(<OpeningCategoryCards color="#38bdf8" />);
    fireEvent.click(screen.getByRole('button', { name: /Açılış Pratiği İçeriği kartını aç/ }));
    expect(screen.getByPlaceholderText("Açılış türü adı (örn. e4'lü Açılışlar)")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Açılış türü ekle' })).toBeInTheDocument();
  });

  it('açılış türü eklerken sadece {name} gönderilir', async () => {
    render(<OpeningCategoryCards color="#38bdf8" />);
    fireEvent.click(screen.getByRole('button', { name: /Açılış Pratiği İçeriği kartını aç/ }));
    fireEvent.change(screen.getByPlaceholderText("Açılış türü adı (örn. e4'lü Açılışlar)"), {
      target: { value: "d4'lü Açılışlar" },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Açılış türü ekle' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/opening-types'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: "d4'lü Açılışlar" }),
      }),
    ));
  });

  it('tür kartı açılınca açılış İSİMLERİ listelenir, "X varyant" sayısı görünür', async () => {
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

  it('açılış ismi eklerken {name, opening_type_id} gönderilir (start_fen YOK)', async () => {
    await open();
    fireEvent.change(screen.getByPlaceholderText('Açılış adı (örn. İtalyan Açılışı)'), {
      target: { value: 'Sicilya' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Açılış ismi ekle' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/openings'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Sicilya', opening_type_id: 1 }),
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
          json: async () => [{
            id: 1, name: "e4'lü Açılışlar",
            openings: [{ id: 1, name: 'Boş Açılış', variants: [] }],
          }],
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    }) as unknown as typeof fetch;
    render(<OpeningCategoryCards color="#38bdf8" />);
    fireEvent.click(screen.getByRole('button', { name: /Açılış Pratiği İçeriği kartını aç/ }));
    fireEvent.click(await screen.findByRole('button', { name: /e4'lü Açılışlar kartını aç/ }));
    await waitFor(() => expect(screen.getByText('Boş Açılış')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Boş Açılış varyantlarını aç/ }));
    expect(screen.getByText('Bu açılışta henüz varyant yok.')).toBeInTheDocument();
  });

  it('tür yoksa "Henüz açılış türü yok." gösterir', async () => {
    global.fetch = vi.fn((url: string) => {
      if (String(url).endsWith('/openings')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    }) as unknown as typeof fetch;
    render(<OpeningCategoryCards color="#38bdf8" />);
    fireEvent.click(screen.getByRole('button', { name: /Açılış Pratiği İçeriği kartını aç/ }));
    await waitFor(() => expect(screen.getByText('Henüz açılış türü yok.')).toBeInTheDocument());
  });

  it('tür silinince altındaki açılış/varyantlar listeden kaybolur', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /e4'lü Açılışlar türünü sil/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/opening-types/1'),
      expect.objectContaining({ method: 'DELETE' }),
    ));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchPoolImages = vi.fn();
vi.mock('@/lib/admin/poolApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/poolApi')>(
    '@/lib/admin/poolApi',
  );
  return { ...actual, fetchPoolImages: (c: string) => fetchPoolImages(c) };
});

import { PoolPicker } from '@/components/admin/PoolPicker';

const A = 'data:image/png;base64,AAAA';
const B = 'data:image/png;base64,BBBB';

beforeEach(() => {
  fetchPoolImages.mockReset();
  fetchPoolImages.mockResolvedValue([]);
});

describe('PoolPicker', () => {
  it('on iki kategori düğmesi gösterir', async () => {
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    for (const c of ['Hayvanlar', 'Bitkiler', 'Satranç Şampiyonları', 'Rakamlar']) {
      expect(screen.getByRole('button', { name: c })).toBeInTheDocument();
    }
  });

  it('açılışta hiçbir kategori seçili değil, yönlendirme metni görünür', () => {
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/kategori seç/i)).toBeInTheDocument();
    expect(fetchPoolImages).not.toHaveBeenCalled();
  });

  it('kategori tıklanınca o kategori için istek atar', async () => {
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(fetchPoolImages).toHaveBeenCalledWith('Hayvanlar'));
  });

  it('gelen görselleri küçük resim olarak listeler', async () => {
    fetchPoolImages.mockResolvedValue([
      { id: 1, category: 'Hayvanlar', data_uri: A },
      { id: 2, category: 'Hayvanlar', data_uri: B },
    ]);
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));
  });

  it('görsele tıklanınca onSelect data-URI ile çağrılır ve onClose tetiklenir', async () => {
    fetchPoolImages.mockResolvedValue([{ id: 1, category: 'Hayvanlar', data_uri: A }]);
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<PoolPicker onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
    fireEvent.click(screen.getAllByRole('img')[0]);
    expect(onSelect).toHaveBeenCalledWith(A);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('boş kategoride yönlendirici not gösterir', async () => {
    fetchPoolImages.mockResolvedValue([]);
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Satranç Şampiyonları' }));
    await waitFor(() =>
      expect(screen.getByText(/henüz görsel yok/i)).toBeInTheDocument(),
    );
  });

  it('yükleme sırasında bilgi verir', async () => {
    let resolveFn: (v: unknown) => void = () => {};
    fetchPoolImages.mockReturnValue(new Promise((res) => { resolveFn = res; }));
    render(<PoolPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hayvanlar' }));
    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
    resolveFn([]);
    await waitFor(() => expect(screen.queryByText(/yükleniyor/i)).not.toBeInTheDocument());
  });

  it('Kapat düğmesi onClose çağırır', () => {
    const onClose = vi.fn();
    render(<PoolPicker onSelect={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

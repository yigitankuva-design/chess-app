import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchPoolImages = vi.fn();
const deletePoolImage = vi.fn();
vi.mock('@/lib/admin/poolApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/poolApi')>(
    '@/lib/admin/poolApi',
  );
  return {
    ...actual,
    fetchPoolImages: (c: string) => fetchPoolImages(c),
    deletePoolImage: (id: number) => deletePoolImage(id),
  };
});

import AdminPoolImagesPage from '@/app/admin/pool-images/page';

const A = 'data:image/png;base64,AAAA';
const B = 'data:image/png;base64,BBBB';

beforeEach(() => {
  fetchPoolImages.mockReset();
  deletePoolImage.mockReset();
  fetchPoolImages.mockResolvedValue([
    { id: 1, category: 'Hayvanlar', data_uri: A },
    { id: 2, category: 'Hayvanlar', data_uri: B },
  ]);
  deletePoolImage.mockResolvedValue(true);
});

/** Kategoriyi seçip görsellerin yüklenmesini bekler. */
async function openCategory(name = 'Hayvanlar') {
  render(<AdminPoolImagesPage />);
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(0));
}

describe('Admin Görsel Havuzu sayfası', () => {
  it('on iki kategori düğmesi gösterir', () => {
    render(<AdminPoolImagesPage />);
    for (const c of ['Hayvanlar', 'Bitkiler', 'Satranç Şampiyonları', 'Rakamlar']) {
      expect(screen.getByRole('button', { name: c })).toBeInTheDocument();
    }
  });

  it('açılışta kategori seçili değildir, istek atılmaz', () => {
    render(<AdminPoolImagesPage />);
    expect(fetchPoolImages).not.toHaveBeenCalled();
    expect(screen.getByText(/kategori seç/i)).toBeInTheDocument();
  });

  it('kategori tıklanınca o kategorinin görselleri listelenir', async () => {
    await openCategory();
    expect(fetchPoolImages).toHaveBeenCalledWith('Hayvanlar');
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('boş kategoride bilgi notu gösterir', async () => {
    fetchPoolImages.mockResolvedValue([]);
    render(<AdminPoolImagesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Satranç Şampiyonları' }));
    await waitFor(() =>
      expect(screen.getByText(/bu kategoride görsel yok/i)).toBeInTheDocument(),
    );
  });

  it('ONAY: Sil tıklanınca HENÜZ silmez, önce onay sorar', async () => {
    await openCategory();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    expect(deletePoolImage).not.toHaveBeenCalled();
    expect(screen.getByText(/emin misin/i)).toBeInTheDocument();
  });

  it('Vazgeç onayı kapatır ve silmez', async () => {
    await openCategory();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(deletePoolImage).not.toHaveBeenCalled();
    expect(screen.queryByText(/emin misin/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('"Evet, sil" doğru id ile siler ve görsel listeden kalkar', async () => {
    await openCategory();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));
    await waitFor(() => expect(deletePoolImage).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
  });

  it('AYNI ANDA TEK ONAY: ikinci Sil ilk onayı kapatır', async () => {
    await openCategory();
    const silButtons = screen.getAllByRole('button', { name: 'Sil' });
    fireEvent.click(silButtons[0]);
    expect(screen.getAllByText(/emin misin/i)).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    expect(screen.getAllByText(/emin misin/i)).toHaveLength(1);
  });

  it('silme başarısız olursa hata mesajı gösterir ve görsel listede kalır', async () => {
    deletePoolImage.mockResolvedValue(false);
    await openCategory();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));
    await waitFor(() => expect(screen.getByText(/silinemedi/i)).toBeInTheDocument());
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('silmenin soruları bozmadığını açıklayan not vardır', () => {
    render(<AdminPoolImagesPage />);
    expect(screen.getByText(/soruları etkilemez/i)).toBeInTheDocument();
  });
});

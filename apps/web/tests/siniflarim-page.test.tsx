import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 2): "SINIFLARIM" sayfası — antrenör
 * sınıf oluşturur (join_code sunucuda üretilir), mevcut sınıfları listeler,
 * "Sınıf Listesi" ile o sınıfın [id] sayfasına gider.
 *
 * Madde 2026-09-13 (devam, yönetim özellikleri): isim düzeltme, ▲/▼ ile
 * sıralama, silme (confirm() onayı).
 */
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: 'teacher', hydrated: true, token: 'tok', userId: 1, login: vi.fn(), logout: vi.fn() }),
}));

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush, replace: vi.fn() }) }));

const mocks = vi.hoisted(() => ({
  fetchMyClasses: vi.fn(),
  createClass: vi.fn(),
  renameClass: vi.fn(),
  deleteClass: vi.fn(),
  moveClass: vi.fn(),
}));
vi.mock('@/lib/homeworkApi', () => mocks);

import SiniflarimPage from '@/app/(teacher)/coach/classes/page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMyClasses.mockResolvedValue([
    { id: 1, name: 'Sınıf A', join_code: 'ABCD1234', order_index: 0 },
    { id: 2, name: 'Sınıf B', join_code: 'WXYZ5678', order_index: 1 },
  ]);
});

it('mevcut sınıfları numara + kod + Sınıf Listesi butonuyla listeler', async () => {
  render(<SiniflarimPage />);
  await waitFor(() => screen.getByText('Sınıf A'));
  expect(screen.getByText('ABCD1234')).toBeInTheDocument();
  expect(screen.getByText('Sınıf B')).toBeInTheDocument();
  expect(screen.getAllByText('Sınıf Listesi')).toHaveLength(2);
});

it('"Sınıf Listesi" tıklanınca o sınıfın [id] sayfasına gider', async () => {
  render(<SiniflarimPage />);
  await waitFor(() => screen.getByText('Sınıf B'));
  const buttons = screen.getAllByText('Sınıf Listesi');
  fireEvent.click(buttons[1]);
  expect(routerPush).toHaveBeenCalledWith('/coach/classes/2');
});

it('yeni sınıf oluşturunca listeye eklenir', async () => {
  mocks.createClass.mockResolvedValue({ id: 3, name: 'Sınıf C', join_code: 'NEWCODE1', order_index: 2 });
  render(<SiniflarimPage />);
  await waitFor(() => screen.getByText('Sınıf A'));

  const input = screen.getByPlaceholderText('Sınıf Adı');
  fireEvent.change(input, { target: { value: 'Sınıf C' } });
  fireEvent.click(screen.getByText('OLUŞTUR'));

  await waitFor(() => expect(mocks.createClass).toHaveBeenCalledWith('Sınıf C'));
  await waitFor(() => screen.getByText('NEWCODE1'));
});

it('boş isimle OLUŞTUR devre dışıdır, oluşturma çağrısı yapılmaz', async () => {
  render(<SiniflarimPage />);
  await waitFor(() => screen.getByText('Sınıf A'));
  const createBtn = screen.getByText('OLUŞTUR');
  expect(createBtn).toBeDisabled();
  expect(mocks.createClass).not.toHaveBeenCalled();
});

describe('İsim düzeltme (Sınıflarım yönetimi)', () => {
  it('kalem ikonuna basıp yeni ad girip Kaydet\'e basınca ad güncellenir', async () => {
    mocks.renameClass.mockResolvedValue({ id: 1, name: 'Yeni Ad', join_code: 'ABCD1234', order_index: 0 });
    render(<SiniflarimPage />);
    await waitFor(() => screen.getByText('Sınıf A'));

    fireEvent.click(screen.getByLabelText('Sınıf A adını düzenle'));
    const input = screen.getByLabelText('Sınıf Adı');
    fireEvent.change(input, { target: { value: 'Yeni Ad' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => expect(mocks.renameClass).toHaveBeenCalledWith(1, 'Yeni Ad'));
    await waitFor(() => screen.getByText('Yeni Ad'));
    expect(screen.queryByText('Sınıf A')).not.toBeInTheDocument();
  });

  it('kaydetme başarısız olursa hata gösterir, panel açık kalır', async () => {
    mocks.renameClass.mockResolvedValue(null);
    render(<SiniflarimPage />);
    await waitFor(() => screen.getByText('Sınıf A'));

    fireEvent.click(screen.getByLabelText('Sınıf A adını düzenle'));
    fireEvent.change(screen.getByLabelText('Sınıf Adı'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => screen.getByText('Kaydedilemedi, tekrar dene.'));
  });
});

describe('Sınıfı silme (Sınıflarım yönetimi)', () => {
  it('confirm onaylanınca sınıf silinir ve listeden kaldırılır', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.deleteClass.mockResolvedValue(true);
    render(<SiniflarimPage />);
    await waitFor(() => screen.getByText('Sınıf A'));

    fireEvent.click(screen.getAllByText('Sil')[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      '"Sınıf A" sınıfını silmek istediğine emin misin? Bu işlem geri alınamaz.',
    );
    await waitFor(() => expect(mocks.deleteClass).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('Sınıf A')).not.toBeInTheDocument());
  });

  it('confirm reddedilirse deleteClass hiç çağrılmaz, sınıf listede kalır', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SiniflarimPage />);
    await waitFor(() => screen.getByText('Sınıf A'));

    fireEvent.click(screen.getAllByText('Sil')[0]);

    expect(mocks.deleteClass).not.toHaveBeenCalled();
    expect(screen.getByText('Sınıf A')).toBeInTheDocument();
  });
});

describe('Sıralama — ▲/▼ (Sınıflarım yönetimi)', () => {
  it('ilk sınıfın ▲\'sı, son sınıfın ▼\'sı devre dışıdır', async () => {
    render(<SiniflarimPage />);
    await waitFor(() => screen.getByText('Sınıf A'));
    expect(screen.getByLabelText('Sınıf A yukarı taşı')).toBeDisabled();
    expect(screen.getByLabelText('Sınıf B aşağı taşı')).toBeDisabled();
    expect(screen.getByLabelText('Sınıf A aşağı taşı')).not.toBeDisabled();
    expect(screen.getByLabelText('Sınıf B yukarı taşı')).not.toBeDisabled();
  });

  it('ikinci sınıfı yukarı taşıyınca sırada yer değiştirir', async () => {
    mocks.moveClass.mockResolvedValue(true);
    render(<SiniflarimPage />);
    await waitFor(() => screen.getByText('Sınıf B'));

    fireEvent.click(screen.getByLabelText('Sınıf B yukarı taşı'));

    await waitFor(() => expect(mocks.moveClass).toHaveBeenCalledWith(2, 'up'));
    const names = screen.getAllByText(/^Sınıf [AB]$/).map((el) => el.textContent);
    expect(names).toEqual(['Sınıf B', 'Sınıf A']);
  });
});

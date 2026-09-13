import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 2): "SINIFLARIM" sayfası — antrenör
 * sınıf oluşturur (join_code sunucuda üretilir), mevcut sınıfları listeler,
 * "Sınıf Listesi" ile o sınıfın [id] sayfasına gider.
 */
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: 'teacher', hydrated: true, token: 'tok', userId: 1, login: vi.fn(), logout: vi.fn() }),
}));

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush, replace: vi.fn() }) }));

const mocks = vi.hoisted(() => ({
  fetchMyClasses: vi.fn(),
  createClass: vi.fn(),
}));
vi.mock('@/lib/homeworkApi', () => mocks);

import SiniflarimPage from '@/app/(teacher)/coach/classes/page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMyClasses.mockResolvedValue([
    { id: 1, name: 'Sınıf A', join_code: 'ABCD1234' },
    { id: 2, name: 'Sınıf B', join_code: 'WXYZ5678' },
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
  mocks.createClass.mockResolvedValue({ id: 3, name: 'Sınıf C', join_code: 'NEWCODE1' });
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

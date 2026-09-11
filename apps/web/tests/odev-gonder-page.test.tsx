import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi Faz 3): "Ödev Gönder" sayfası.
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

let mockRole: 'teacher' | 'athlete' | null = 'teacher';
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: mockRole, token: 'tok', login: vi.fn(), logout: vi.fn(), userId: 1 }),
}));

const routerPush = vi.fn();
const routerBack = vi.fn();
let search = 'section=7&tab=3';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, back: routerBack }),
  useSearchParams: () => new URLSearchParams(search),
}));

const mocks = vi.hoisted(() => ({
  fetchHomeworkTarget: vi.fn(),
  fetchMyClasses: vi.fn(),
  fetchClassStudents: vi.fn(),
  sendHomework: vi.fn(),
}));
vi.mock('@/lib/homeworkApi', () => mocks);

import OdevGonderPage from '@/app/(teacher)/coach/odev-gonder/page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRole = 'teacher';
  search = 'section=7&tab=3';
  mocks.fetchHomeworkTarget.mockResolvedValue({
    linked: true, lesson_step_id: 5, section_title: 'Alt Konu',
    alt_konu_title: 'Tahtanın Özellikleri', konu_title: 'Tahta ve Taşlar', duzey_title: 'Temel Düzey',
  });
  mocks.fetchMyClasses.mockResolvedValue([{ id: 1, name: 'Sınıf A', join_code: 'X' }]);
  mocks.fetchClassStudents.mockResolvedValue([
    { id: 10, display_name: 'Ali' }, { id: 11, display_name: 'Veli' },
  ]);
  mocks.sendHomework.mockResolvedValue({ id: 99, recipient_count: 1 });
});

it('bağlı alt konu için otomatik kart + sınıf/öğrenci listesi gösterir', async () => {
  render(<OdevGonderPage />);
  await waitFor(() => screen.getByText('Tahtanın Özellikleri'));
  expect(screen.getByText('Temel Düzey › Tahta ve Taşlar')).toBeInTheDocument();
  await waitFor(() => screen.getByText('Ali'));
  expect(screen.getByText('Sınıf A')).toBeInTheDocument();
  expect(screen.getByText('Veli')).toBeInTheDocument();
});

it('müfredat bağı yoksa uyarı gösterir, gönderim yok', async () => {
  mocks.fetchHomeworkTarget.mockResolvedValue({ linked: false, section_title: 'Alt Konu X' });
  render(<OdevGonderPage />);
  await waitFor(() => screen.getByText(/müfredata bağlı değil/));
  expect(screen.queryByText('Ödevi Gönder')).not.toBeInTheDocument();
});

it('öğrenci seçip gönderince sendHomework doğru gövdeyle çağrılır', async () => {
  render(<OdevGonderPage />);
  await waitFor(() => screen.getByText('Ali'));
  fireEvent.click(screen.getByLabelText('Ali', { selector: 'input' }) ?? screen.getByText('Ali'));
  // checkbox label ile:
  const aliCheckbox = screen.getByText('Ali').querySelector('input') as HTMLInputElement;
  if (!aliCheckbox.checked) fireEvent.click(aliCheckbox);

  const sendBtn = screen.getByRole('button', { name: /Ödevi Gönder/ });
  fireEvent.click(sendBtn);
  await waitFor(() => expect(mocks.sendHomework).toHaveBeenCalledTimes(1));
  const payload = mocks.sendHomework.mock.calls[0][0];
  expect(payload.lesson_step_id).toBe(5);
  expect(payload.source_section_id).toBe(7);
  expect(payload.child_ids).toContain(10);
  expect(payload.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it('"Tüm Sınıf" seçilince class_ids gönderilir ve öğrenci sayısı kadar sayılır', async () => {
  render(<OdevGonderPage />);
  await waitFor(() => screen.getByText('Ali'));
  fireEvent.click(screen.getByText('Tüm Sınıf').querySelector('input') as HTMLInputElement);
  // gönder düğmesi seçilen sporcu sayısını gösterir (2).
  expect(screen.getByRole('button', { name: 'Ödevi Gönder (2)' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Ödevi Gönder/ }));
  await waitFor(() => expect(mocks.sendHomework).toHaveBeenCalled());
  const payload = mocks.sendHomework.mock.calls[0][0];
  expect(payload.class_ids).toEqual([1]);
  expect(payload.child_ids).toEqual([]);
});

it('başarılı gönderimden sonra onay ekranı gösterir', async () => {
  render(<OdevGonderPage />);
  await waitFor(() => screen.getByText('Ali'));
  fireEvent.click(screen.getByText('Tüm Sınıf').querySelector('input') as HTMLInputElement);
  fireEvent.click(screen.getByRole('button', { name: /Ödevi Gönder/ }));
  await waitFor(() => screen.getByText('Ödev Gönderildi'));
});

it('antrenör değilse sayfa reddeder', async () => {
  mockRole = 'athlete';
  render(<OdevGonderPage />);
  await waitFor(() => screen.getByText(/yalnızca antrenörler/));
});

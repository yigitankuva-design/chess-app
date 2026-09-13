import { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 2): "Sınıf Listesi" sayfası — bir
 * sınıftaki sporcuları listeler; sporcu adına tıklayınca GERÇEK Sporcu
 * Profili'ne (/students/[id]) gider (GRUP B'nin salt-okunur profil
 * sayfasına ilk gerçek bağlantı). `use(params)` bir Promise olduğu için
 * (bkz. tests/parent-child-contact-info.test.tsx ile AYNI desen) render
 * bir <Suspense> içinde ve act(async) ile yapılmalı.
 *
 * Madde 2026-09-13 (devam, sporcu yönetimi): gerçek foto/emoji avatar geri
 * düşüşü + sıra numarası, nickname gösterimi, ▲/▼ sıralama, "Sınıf Değiştir".
 */
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: 'teacher', hydrated: true, token: 'tok', userId: 1, login: vi.fn(), logout: vi.fn() }),
}));

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush, replace: vi.fn() }) }));

const mocks = vi.hoisted(() => ({
  fetchMyClasses: vi.fn(),
  fetchClassStudents: vi.fn(),
  moveStudent: vi.fn(),
  changeStudentClass: vi.fn(),
}));
vi.mock('@/lib/homeworkApi', () => mocks);

import ClassRosterPage from '@/app/(teacher)/coach/classes/[id]/page';

async function renderPage(id: string) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ClassRosterPage params={Promise.resolve({ id })} />
      </Suspense>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMyClasses.mockResolvedValue([
    { id: 5, name: 'Sınıf V', join_code: 'CODE5678', order_index: 0 },
    { id: 6, name: 'Sınıf W', join_code: 'CODE9999', order_index: 1 },
  ]);
  mocks.fetchClassStudents.mockResolvedValue([
    { id: 10, display_name: 'Ali', avatar: 'lion', age: 9, nickname: null, photo_data_url: null, order_index: 0 },
    {
      id: 11, display_name: 'Defne Hüma Dinç', avatar: 'fox', age: 10,
      nickname: 'eyes of Polgar', photo_data_url: 'data:image/png;base64,xx', order_index: 1,
    },
  ]);
});

it('sınıf adını + kodu ve sporcu listesini gösterir', async () => {
  await renderPage('5');
  await waitFor(() => screen.getByText('Sınıf V'));
  expect(screen.getByText('Kod: CODE5678')).toBeInTheDocument();
  expect(screen.getByText('Ali')).toBeInTheDocument();
  expect(screen.getByText('Defne Hüma Dinç - eyes of Polgar')).toBeInTheDocument();
});

it('sporcu adına tıklayınca /students/{id} sayfasına gider', async () => {
  await renderPage('5');
  await waitFor(() => screen.getByText('Ali'));
  fireEvent.click(screen.getByText('Defne Hüma Dinç - eyes of Polgar'));
  expect(routerPush).toHaveBeenCalledWith('/students/11');
});

it('bu sınıfta sporcu yoksa boş durum metni gösterir', async () => {
  mocks.fetchClassStudents.mockResolvedValue([]);
  await renderPage('5');
  await waitFor(() => screen.getByText('Bu sınıfta henüz sporcu yok.'));
});

it('sınıf bu antrenöre ait değilse/bulunamazsa uyarı gösterir', async () => {
  mocks.fetchMyClasses.mockResolvedValue([]);
  await renderPage('999');
  await waitFor(() => screen.getByText('Sınıf bulunamadı'));
});

describe('Avatar + sıra numarası (madde 1)', () => {
  it('nickname/foto YOKSA sıra numarası + emoji avatar gösterir', async () => {
    await renderPage('5');
    await waitFor(() => screen.getByText('Ali'));
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });

  it('photo_data_url doluysa gerçek fotoğraf (img) gösterir, emoji YOK', async () => {
    await renderPage('5');
    await waitFor(() => screen.getByText('Defne Hüma Dinç - eyes of Polgar'));
    const img = screen.getByAltText('Defne Hüma Dinç') as HTMLImageElement;
    expect(img.src).toContain('data:image/png;base64,xx');
  });
});

describe('Sıralama — ▲/▼ (madde 2)', () => {
  it('ilk sporcunun ▲\'sı, son sporcunun ▼\'sı devre dışıdır', async () => {
    await renderPage('5');
    await waitFor(() => screen.getByText('Ali'));
    expect(screen.getByLabelText('Ali yukarı taşı')).toBeDisabled();
    expect(screen.getByLabelText('Defne Hüma Dinç aşağı taşı')).toBeDisabled();
    expect(screen.getByLabelText('Ali aşağı taşı')).not.toBeDisabled();
  });

  it('ikinci sporcuyu yukarı taşıyınca sırada yer değiştirir', async () => {
    mocks.moveStudent.mockResolvedValue(true);
    await renderPage('5');
    await waitFor(() => screen.getByText('Defne Hüma Dinç - eyes of Polgar'));

    fireEvent.click(screen.getByLabelText('Defne Hüma Dinç yukarı taşı'));

    await waitFor(() => expect(mocks.moveStudent).toHaveBeenCalledWith(5, 11, 'up'));
    const names = screen.getAllByText(/^(Ali|Defne Hüma Dinç - eyes of Polgar)$/).map((el) => el.textContent);
    expect(names).toEqual(['Defne Hüma Dinç - eyes of Polgar', 'Ali']);
  });
});

describe('Sınıf Değiştir (madde 4)', () => {
  it('yaş rozeti YOK, "Sınıf Değiştir" butonu var', async () => {
    await renderPage('5');
    await waitFor(() => screen.getByText('Ali'));
    expect(screen.queryByText('9')).not.toBeInTheDocument();
    expect(screen.getAllByText('Sınıf Değiştir')).toHaveLength(2);
  });

  it('panel açılır, başka sınıf seçilip Taşı\'ya basılınca öğrenci listeden kalkar', async () => {
    mocks.changeStudentClass.mockResolvedValue(true);
    await renderPage('5');
    await waitFor(() => screen.getByText('Ali'));

    fireEvent.click(screen.getAllByText('Sınıf Değiştir')[0]);
    fireEvent.change(screen.getByLabelText('Yeni Sınıf'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => expect(mocks.changeStudentClass).toHaveBeenCalledWith(6, 10));
    await waitFor(() => expect(screen.queryByText('Ali')).not.toBeInTheDocument());
  });

  it('başka sınıf seçilmeden Kaydet\'e basılırsa hata gösterir, çağrı yapılmaz', async () => {
    await renderPage('5');
    await waitFor(() => screen.getByText('Ali'));

    fireEvent.click(screen.getAllByText('Sınıf Değiştir')[0]);
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => screen.getByText('Bir sınıf seç.'));
    expect(mocks.changeStudentClass).not.toHaveBeenCalled();
  });
});

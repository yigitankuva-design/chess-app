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
 */
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: 'teacher', hydrated: true, token: 'tok', userId: 1, login: vi.fn(), logout: vi.fn() }),
}));

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush, replace: vi.fn() }) }));

const mocks = vi.hoisted(() => ({
  fetchMyClasses: vi.fn(),
  fetchClassStudents: vi.fn(),
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
    { id: 5, name: 'Sınıf V', join_code: 'CODE5678' },
  ]);
  mocks.fetchClassStudents.mockResolvedValue([
    { id: 10, display_name: 'Ali', avatar: 'lion', age: 9 },
    { id: 11, display_name: 'Zeynep', avatar: 'fox', age: 10 },
  ]);
});

it('sınıf adını + kodu ve sporcu listesini gösterir', async () => {
  await renderPage('5');
  await waitFor(() => screen.getByText('Sınıf V'));
  expect(screen.getByText('Kod: CODE5678')).toBeInTheDocument();
  expect(screen.getByText('Ali')).toBeInTheDocument();
  expect(screen.getByText('Zeynep')).toBeInTheDocument();
});

it('sporcu adına tıklayınca /students/{id} sayfasına gider', async () => {
  await renderPage('5');
  await waitFor(() => screen.getByText('Ali'));
  fireEvent.click(screen.getByText('Zeynep'));
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

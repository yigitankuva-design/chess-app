import { Suspense } from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';

// ClassDetailPage'in veri-yükleme efekti bağımlılık dizisinde `router`
// GEÇER ([classId, router]) — useRouter() her render'da YENİ bir nesne
// dönerse (naif bir mock gibi) efekt SONSUZ döngüye girer (gerçek
// Next.js'te router referansı STABİL'dir). Mock'u da stabil tutuyoruz.
const mockRouter = { push: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'teacher-tok',
}));

const STUDENTS = [
  { id: 7, display_name: 'Emir Dinç', avatar: 'lion', age: 10 },
];

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/students')) return Promise.resolve({ ok: true, json: async () => STUDENTS });
    if (url.includes('/leaderboard')) return Promise.resolve({ ok: true, json: async () => [] });
    return Promise.resolve({ ok: false, json: async () => null });
  }) as unknown as typeof fetch);
}

import ClassDetailPage from '@/app/(teacher)/classes/[id]/page';

describe('Antrenör — Sınıf Detayı: sporcu ismi profil sayfasına bağlı (madde 2026-09-07)', () => {
  beforeEach(stubFetch);

  it('"Emir Dinç" ismi /students/7\'ye giden bir bağlantıdır', async () => {
    // Next.js 15: params bir Promise — use() hook'u Suspense ister.
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <ClassDetailPage params={Promise.resolve({ id: '1' })} />
        </Suspense>,
      );
    });
    const link = await screen.findByRole('link', { name: /Emir Dinç/ });
    expect(link).toHaveAttribute('href', '/students/7');
  });
});

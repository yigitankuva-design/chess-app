import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-07 (Antrenör Paneli, 5): CoachHomePage'in "teacher rolü
 * yoksa dışarı at" koruması gerçek `AuthProvider`'ı (MOCK'LANMAMIŞ)
 * sarmalayarak test edilir — bkz. `alt-konu-page-back-override-
 * integration.test.tsx`'teki AYNI gerekçe: mock'lanmış `useAuth()`
 * (diğer coach-home-page.test.tsx'teki gibi) `hydrated` durumunu HER
 * ZAMAN sabit/anlık verir, bu yüzden AuthProvider'ın KENDİ token okuma
 * effect'inin (child effect'lerden SONRA çalışması) yarattığı gerçek
 * "F5 anı" yarış durumunu YAKALAYAMAZ. Bu test sessionStorage'a GERÇEK
 * bir teacher token'ı yazıp REAL AuthProvider ile mount ediyor.
 */
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({
    settings: {
      labels: {
        sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
        features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz Et', eglence: 'Eğlence' },
        icons: { play: '', lessons: '', analiz: '', eglence: '' },
      },
    },
  }),
}));
vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['play', 'lessons', 'analiz', 'eglence'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));
vi.mock('@/lib/assignmentsApi', () => ({ listMyAssignments: async () => [] }));
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([])),
  getCustomTab: vi.fn(() => Promise.resolve(null)),
}));

import { AuthProvider } from '@/lib/auth-context';
import CoachHomePage from '@/app/(teacher)/coach/page';

function fakeTeacherToken(): string {
  const header = btoa(JSON.stringify({ alg: 'none' }));
  const payload = btoa(JSON.stringify({ role: 'teacher', user_id: 7 }));
  return `${header}.${payload}.sig`;
}

beforeEach(() => {
  replace.mockClear();
  sessionStorage.clear();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
});

describe('CoachHomePage + gerçek AuthProvider — F5 anında yanlış yönlendirme regresyonu (madde 2026-09-07, 5)', () => {
  it('geçerli bir teacher token sessionStorage\'dayken, AuthProvider henüz KENDİ effect\'ini çalıştırmadan (ilk render) YANLIŞ yönlendirme OLMAZ, ve sayfa sonunda doğru render olur', async () => {
    sessionStorage.setItem('chess_app_token', fakeTeacherToken());

    render(
      <AuthProvider>
        <CoachHomePage />
      </AuthProvider>,
    );

    // Sayfa doğru şekilde teacher olarak yüklenene kadar hiçbir anda
    // yanlış yönlendirme çağrılmamalı.
    await waitFor(() => screen.getByText('Maç Yap'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('token YOKKEN gerçek AuthProvider ile de doğru şekilde dışarı atılır (karşı-örnek — koruma hâlâ çalışıyor)', async () => {
    render(
      <AuthProvider>
        <CoachHomePage />
      </AuthProvider>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('Maç Yap')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-07 (Antrenör Paneli, 1-4): antrenörün yeni "Hızlı Erişim"
 * kopyası (`/coach`) — sporcunun `/home` sayfasıyla AYNI 4 yerleşik sekmeyi
 * (Maç Yap/Dersler/Analiz Et/Eğlence) gösterdiğini VE role !== 'teacher'
 * iken (veya token yokken) ana giriş ekranına yönlendirdiğini doğrular.
 */
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

let mockRole: 'teacher' | null = 'teacher';
// Madde 2026-09-07 (Antrenör Paneli, 5): AuthProvider'ın token'ı okuyup
// role'ü çözmesi bir effect'te olur — `hydrated` bunun BİTTİĞİNİ işaretler.
// Testler varsayılan olarak "zaten çözülmüş" (true) durumu temsil eder;
// aşağıdaki özel test `hydrated=false` iken YANLIŞ yönlendirme OLMADIĞINI
// doğrular (bkz. lib/auth-context.tsx doc-comment'i).
let mockHydrated = true;
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: mockRole, hydrated: mockHydrated, token: 'tok', userId: 1, login: vi.fn(), logout: vi.fn() }),
}));

let mockToken: string | null = 'tok';
vi.mock('@/lib/auth-storage', () => ({
  getTeacherName: () => 'Ahmet Antrenör',
  getToken: () => mockToken,
}));

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
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([
    { id: 5, order_index: 1, label: 'Antrenör Dosyası', emoji: '🎓' },
  ])),
  getCustomTab: vi.fn(() => Promise.resolve({ id: 5, label: 'Antrenör Dosyası', emoji: '🎓', sections: [] })),
}));

beforeEach(() => {
  mockRole = 'teacher';
  mockHydrated = true;
  mockToken = 'tok';
  replace.mockClear();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
});

import CoachHomePage from '@/app/(teacher)/coach/page';

describe('Antrenör Paneli — /coach (sporcu Hızlı Erişim kopyası)', () => {
  it('teacher rolüyle + token varken sporcu sayfasındaki 4 yerleşik sekme AYNEN görünür', async () => {
    render(<CoachHomePage />);
    await waitFor(() => screen.getByText('Maç Yap'));
    expect(screen.getByText('Dersler')).toBeInTheDocument();
    expect(screen.getByText('Analiz Et')).toBeInTheDocument();
    expect(screen.getByText('Eğlence')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('özel sekmeler (ör. mevcut "Antrenör Dosyası" sekmesi) de sporcu sayfasındaki AYNI kaynaktan gelip görünür', async () => {
    render(<CoachHomePage />);
    await waitFor(() => screen.getByText('Antrenör Dosyası'));
  });

  it('kimlik şeridi "Antrenör" etiketiyle ve öğretmenin adıyla gösterilir (Sporcu DEĞİL)', async () => {
    render(<CoachHomePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    expect(screen.getByText('Antrenör')).toBeInTheDocument();
  });

  it('token yoksa ana giriş ekranına yönlendirilir, sayfa içeriği render edilmez', async () => {
    mockToken = null;
    render(<CoachHomePage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('Maç Yap')).not.toBeInTheDocument();
  });

  it('role teacher değilse (ör. child) ana giriş ekranına yönlendirilir', async () => {
    mockRole = null;
    render(<CoachHomePage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('Maç Yap')).not.toBeInTheDocument();
  });

  it('madde 2026-09-07 (5) — auth HENÜZ hydrated olmadan (F5 anındaki gerçek durum) geçerli antrenör YANLIŞLIKLA dışarı atılmaz', async () => {
    // AuthProvider'ın kendi token-çözme effect'i henüz bitmedi (rol hâlâ
    // ilk değeri olabilir) — bu ANDA sayfa "Yükleniyor..." göstermeli,
    // ASLA router.replace('/') çağırmamalı.
    mockHydrated = false;
    render(<CoachHomePage />);
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('Maç Yap')).not.toBeInTheDocument();
  });
});

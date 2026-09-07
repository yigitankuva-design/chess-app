import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Madde 2026-09-07 (Antrenör Paneli, 3): "Sporcu profilini de aynen antrenör
 * alanına taşı" — /coach/profile artık sporcunun Profil sayfasıyla (bkz.
 * components/profile/ProfileView.tsx) AYNI kartları (kimlik, İletişim
 * Bilgileri, Performans Puanı, Genel Maç İstatistikleri, Aktiflik Durumu,
 * Ders İlerlemesi, Güçlü/Zayıf Analiz, Turnuva Geçmişi, ayar kartları +
 * Çıkış) gösteriyor.
 */
const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));

let mockRole: 'teacher' | null = 'teacher';
let mockHydrated = true;
const logout = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: mockRole, hydrated: mockHydrated, token: 'tok', userId: 1, login: vi.fn(), logout }),
}));

let mockToken: string | null = 'tok';
vi.mock('@/lib/auth-storage', () => ({ getToken: () => mockToken }));

vi.mock('@/lib/gamification/meApi', () => ({
  fetchTeacherProgress: vi.fn(() => Promise.resolve({
    rank_name: '', rank_icon: '', xp_total: 0, next_rank_xp: 0,
    badges_earned: 0, badges_total: 0,
    member_since: '2026-01-15',
    display_name: 'Ahmet Antrenör',
    avatar: 'default',
    photo_data_url: null, province: null,
    athlete_phone: null, athlete_email: null,
    father_name: null, father_phone: null, father_email: null,
    mother_name: null, mother_phone: null, mother_email: null,
  })),
}));
vi.mock('@/lib/activity/activityApi', () => ({ fetchDaySummary: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/components/profile/LessonProgressCard', () => ({
  LessonProgressCard: () => <div data-testid="lesson-progress-card" />,
}));

beforeEach(() => {
  mockRole = 'teacher';
  mockHydrated = true;
  mockToken = 'tok';
  replace.mockClear();
  push.mockClear();
  logout.mockClear();
});

import CoachProfilePage from '@/app/(teacher)/coach/profile/page';

describe('Antrenör Paneli — /coach/profile (sporcu Profili kopyası)', () => {
  it('sporcu Profili ile AYNI kartlar görünür: kimlik, Performans Puanı, Ders İlerlemesi, ayar kartları', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    expect(screen.getByText('Antrenör')).toBeInTheDocument();
    expect(screen.getByText('Performans Puanı')).toBeInTheDocument();
    expect(screen.getByText('Genel Maç İstatistikleri')).toBeInTheDocument();
    expect(screen.getByText('Güçlü / Zayıf Yön Analizi')).toBeInTheDocument();
    expect(screen.getByText('Turnuva Geçmişi')).toBeInTheDocument();
    expect(screen.getByText('İletişim Bilgileri')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-progress-card')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('"Ana Sayfaya Dön" antrenörü /coach\'a götürür (sporcu tarafındaki /home DEĞİL)', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    fireEvent.click(screen.getByText('Ana Sayfaya Dön'));
    expect(push).toHaveBeenCalledWith('/coach');
  });

  it('Çıkış butonu auth.logout() çağırıp ana ekrana döner', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    fireEvent.click(screen.getByLabelText('Çıkış'));
    expect(logout).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('role teacher değilse ana giriş ekranına yönlendirilir', async () => {
    mockRole = null;
    render(<CoachProfilePage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('Performans Puanı')).not.toBeInTheDocument();
  });

  it('hydrated henüz false iken (F5 anı) YANLIŞ yönlendirme yapılmaz', () => {
    mockHydrated = false;
    render(<CoachProfilePage />);
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

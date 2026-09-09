import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Madde 2026-09-07 (Antrenör Paneli, 3): "Sporcu profilini de aynen antrenör
 * alanına taşı" — /coach/profile sporcunun Profil sayfasıyla (bkz.
 * components/profile/ProfileView.tsx) AYNI kartları gösteriyor.
 *
 * Madde 2026-09-07 (devam, Zafer'in 5 maddelik düzenleme turu): İletişim
 * Bilgileri/Ders İlerlemesi/Not kartları KALDIRILDI, kimlik fotoğrafı
 * GERÇEK yükleme alanı oldu, Türkiye bayrağı büyütüldü — bu testler
 * ARTIK bu düzenlenmiş hâli doğruluyor.
 *
 * Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): İletişim Bilgileri
 * kartı GERİ GETİRİLDİ (artık gerçek veri var — "Kayıt Ol" formundan
 * telefon/il/Lichess) — bu testler bu değişikliği yansıtır. Ders
 * İlerlemesi/Not hâlâ YOK.
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

const uploadTeacherPhoto = vi.fn((..._args: unknown[]) => Promise.resolve(true));
vi.mock('@/lib/gamification/meApi', () => ({
  fetchTeacherProgress: vi.fn(() => Promise.resolve({
    rank_name: '', rank_icon: '', xp_total: 0, next_rank_xp: 0,
    badges_earned: 0, badges_total: 0,
    member_since: '2026-01-15',
    display_name: 'Ahmet Antrenör',
    avatar: 'default',
    photo_data_url: null, province: 'Bilecik',
    athlete_phone: '5551234567', athlete_email: 'ahmet@test.com',
    lichess_username: 'ahmetchess',
    father_name: null, father_phone: null, father_email: null,
    mother_name: null, mother_phone: null, mother_email: null,
  })),
  uploadTeacherPhoto: (...args: unknown[]) => uploadTeacherPhoto(...args),
}));
vi.mock('@/lib/activity/activityApi', () => ({ fetchDaySummary: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/lib/image/resizeImage', () => ({
  resizeImageToDataUrl: vi.fn(() => Promise.resolve('data:image/png;base64,xyz')),
}));

beforeEach(() => {
  mockRole = 'teacher';
  mockHydrated = true;
  mockToken = 'tok';
  replace.mockClear();
  push.mockClear();
  logout.mockClear();
  uploadTeacherPhoto.mockClear();
});

import CoachProfilePage from '@/app/(teacher)/coach/profile/page';

describe('Antrenör Paneli — /coach/profile (sporcu Profili kopyası, düzenlenmiş)', () => {
  it('sporcu Profili ile AYNI kalan kartlar görünür: kimlik, Performans Puanı, Aktiflik Durumu, ayar kartları', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    expect(screen.getByText('Antrenör')).toBeInTheDocument();
    expect(screen.getByText('Performans Puanı')).toBeInTheDocument();
    expect(screen.getByText('Genel Maç İstatistikleri')).toBeInTheDocument();
    expect(screen.getByText('Aktiflik Durumu - Bu Hafta')).toBeInTheDocument();
    expect(screen.getByText('Güçlü / Zayıf Yön Analizi')).toBeInTheDocument();
    expect(screen.getByText('Turnuva Geçmişi')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('madde 2026-09-09 (AŞAMA 4): İletişim Bilgileri kartı GERİ GELDİ, telefon/e-posta/Lichess doğrudan gösterilir (pill seçici YOK)', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    expect(screen.getByText('İletişim Bilgileri')).toBeInTheDocument();
    expect(screen.getByText('5551234567')).toBeInTheDocument();
    expect(screen.getByText('ahmet@test.com')).toBeInTheDocument();
    expect(screen.getByText('ahmetchess')).toBeInTheDocument();
    // Sporcu tarafındaki gibi Sporcu/Baba/Anne pill'leri YOK.
    expect(screen.queryByText('Baba')).not.toBeInTheDocument();
    expect(screen.queryByText('Anne')).not.toBeInTheDocument();
  });

  it('madde 2026-09-09 (devam): İl artık kimlik kartında gösterilir', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    expect(screen.getByText('(Bilecik)')).toBeInTheDocument();
  });

  it('madde 2026-09-07 (3, hâlâ geçerli): Ders İlerlemesi, Not kartları YOK', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    expect(screen.queryByText('Ders İlerlemesi')).not.toBeInTheDocument();
    expect(screen.queryByText('Not eklendiğinde burada görünecek.')).not.toBeInTheDocument();
  });

  it('madde 2026-09-07 (5): Türkiye bayrağı text-5xl (önceki text-2xl\'in tam iki katı) ile büyütülmüş', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    expect(screen.getByText('🇹🇷')).toHaveClass('text-5xl');
  });

  it('madde 2026-09-07 (4): fotoğraf yoksa 🎓 rozeti tıklanabilir yükleme alanı içinde görünür, seçilince yüklenir', async () => {
    render(<CoachProfilePage />);
    await waitFor(() => screen.getByText('Ahmet Antrenör'));
    const input = screen.getByLabelText('Fotoğraf yükle') as HTMLInputElement;
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadTeacherPhoto).toHaveBeenCalledWith('data:image/png;base64,xyz'));
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

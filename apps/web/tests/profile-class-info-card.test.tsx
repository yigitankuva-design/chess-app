import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProfileView } from '@/components/profile/ProfileView';

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 3): "Sınıf Bilgileri" kartı —
 * İletişim Bilgileri'nin hemen altında. Sporcu kendi profilinde kod girip
 * sınıfa katılabilir (POST /children/me/join-class); antrenörün öğrenci
 * görünümünde (childId) sadece bilgi gösterilir, katılma eylemi yok.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), token: 'tok', role: 'child', userId: '1' }),
}));

vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Test Sporcu',
}));

type ClassInfo = { class_name: string; teacher_name: string | null; student_count: number };

const BASE_ME = {
  rank_name: 'Çaylak', rank_icon: '🐣', xp_total: 10, next_rank_xp: 100,
  badges_earned: 1, badges_total: 5, member_since: '2018-08-07',
  photo_data_url: null as string | null, province: null as string | null,
  athlete_phone: null as string | null, athlete_email: null as string | null,
  lichess_username: null as string | null, country: null as string | null,
  nickname: null as string | null,
  nickname_changed_at: null as string | null, nickname_next_change_at: null as string | null,
  father_name: null as string | null, father_phone: null as string | null, father_email: null as string | null,
  mother_name: null as string | null, mother_phone: null as string | null, mother_email: null as string | null,
  coach_note: null as { text: string; teacher_name: string; created_at: string } | null,
  class_info: null as ClassInfo | null,
};

let meState = { ...BASE_ME };

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    if (url.includes('/activity/day-summary')) return Promise.resolve({ ok: false, json: async () => null });
    if (url.includes('/children/me/join-class')) {
      const body = opts?.body ? JSON.parse(opts.body as string) : {};
      if (body.join_code === 'GOODCODE') {
        meState = { ...meState, class_info: { class_name: 'Sınıf X', teacher_name: 'Hoca', student_count: 3 } };
        return Promise.resolve({ ok: true, json: async () => ({ joined: true, class_name: 'Sınıf X' }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({ detail: 'Sınıf bulunamadı' }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(meState) });
  }) as unknown as typeof fetch);
}

describe('Sınıf Bilgileri kartı (Sınıflarım — Madde 3)', () => {
  beforeEach(() => {
    meState = { ...BASE_ME, class_info: null };
    stubFetch();
  });

  it('sınıfa henüz katılmamış sporcu kendi profilinde "Sınıfa Katıl" görür', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    expect(screen.getByText('Sınıfa Katıl')).toBeInTheDocument();
  });

  it('kod girip kaydedince kart sınıf bilgisiyle güncellenir, buton kaybolur', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    fireEvent.click(screen.getByText('Sınıfa Katıl'));
    fireEvent.change(screen.getByLabelText('Sınıf Kodu'), { target: { value: 'goodcode' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => screen.getByText('Sınıf X'));
    expect(screen.getByText(/Hoca · 3 sporcu/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sınıfa Katıl' })).not.toBeInTheDocument();
  });

  it('yanlış kod girilirse hata gösterir, buton kalır (katılmadı)', async () => {
    render(<ProfileView />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    fireEvent.click(screen.getByText('Sınıfa Katıl'));
    fireEvent.change(screen.getByLabelText('Sınıf Kodu'), { target: { value: 'BADCODE' } });
    fireEvent.click(screen.getByText('Kaydet'));

    await waitFor(() => screen.getByText('Sınıf bulunamadı'));
    expect(screen.queryByText('Sınıf X')).not.toBeInTheDocument();
  });

  it('antrenörün öğrenci görünümünde (childId) katılmışsa bilgi görünür, katılma butonu YOK', async () => {
    meState = { ...BASE_ME, class_info: { class_name: 'Sınıf Y', teacher_name: 'Hoca', student_count: 2 } };
    render(<ProfileView childId={5} />);
    await waitFor(() => screen.getByText('Sınıf Y'));
    expect(screen.queryByText('Sınıfa Katıl')).not.toBeInTheDocument();
  });

  it('antrenörün öğrenci görünümünde henüz katılmadıysa salt-okunur boş durum metni gösterir, buton YOK', async () => {
    render(<ProfileView childId={5} />);
    await waitFor(() => screen.getByText('Henüz bir sınıfa katılmadı.'));
    expect(screen.queryByText('Sınıfa Katıl')).not.toBeInTheDocument();
  });
});

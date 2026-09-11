import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ProfileView } from '@/components/profile/ProfileView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), token: 'tok', role: 'teacher', userId: '1' }),
}));

vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'teacher-tok',
  getAthleteName: () => 'Bu Çağrılmamalı', // antrenör görünümünde KULLANILMAMALI
}));

const TEACHER_ME = {
  rank_name: 'Çaylak', rank_icon: '🐣', xp_total: 10, next_rank_xp: 100,
  badges_earned: 1, badges_total: 5, member_since: '2018-08-07',
  display_name: 'Emir Dinç', avatar: 'lion',
};

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/teacher/students/7/profile-summary')) {
      return Promise.resolve({ ok: true, json: async () => TEACHER_ME });
    }
    return Promise.resolve({ ok: false, json: async () => null });
  }) as unknown as typeof fetch);
}

describe('ProfileView — antrenör salt-okunur görünümü (madde 2026-09-07, GRUP B)', () => {
  beforeEach(stubFetch);

  it('sunucudan gelen display_name gösterilir (cihazdaki getAthleteName() DEĞİL)', async () => {
    render(<ProfileView childId={7} />);
    await waitFor(() => screen.getByText('Emir Dinç'));
    expect(screen.queryByText('Bu Çağrılmamalı')).not.toBeInTheDocument();
  });

  it('ayar kartları ve Çıkış butonu GİZLENİR (salt-okunur)', async () => {
    render(<ProfileView childId={7} />);
    await waitFor(() => screen.getByText('Emir Dinç'));
    expect(screen.queryByLabelText('Tema Değiştir')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dil Seçeneği')).not.toBeInTheDocument();
  });

  it('alt buton "Geri Dön" yazar ("Ana Sayfaya Dön" DEĞİL — /home çocuğa özel)', async () => {
    render(<ProfileView childId={7} />);
    await waitFor(() => screen.getByText('Emir Dinç'));
    expect(screen.getByText('Geri Dön')).toBeInTheDocument();
    expect(screen.queryByText('Ana Sayfaya Dön')).not.toBeInTheDocument();
  });
});

describe('Madde 2026-09-11 (Aşama C): antrenör görünümünde istatistikler öğrencinin ucundan gelir', () => {
  it('/teacher/students/7/match-stats çağrılır ve dönen veri kartlarda görünür', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/teacher/students/7/profile-summary')) {
        return Promise.resolve({ ok: true, json: async () => TEACHER_ME });
      }
      if (url.includes('/teacher/students/7/match-stats')) {
        return Promise.resolve({ ok: true, json: async () => ({
          'Yıldırım': {
            rating: { value: 512, games_played: 4, provisional_games: 20, weekly_delta: 12, history: [500, 512] },
            stats: { total: 4, wins: 3, draws: 0, losses: 1, win_rate: 75, longest_win_streak: 3, best_win_rating: 430 },
            tournaments: { total: 1, games: 2, wins: 1, draws: 0, losses: 1, win_rate: 50, draw_rate: 0, loss_rate: 50, first: 0, second: 1, third: 0 },
          },
        }) });
      }
      return Promise.resolve({ ok: false, json: async () => null });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ProfileView childId={7} />);
    await waitFor(() => screen.getByText('512'));
    expect(screen.getByText('▲ 12 bu hafta')).toBeInTheDocument();
    expect(screen.getByText('%75')).toBeInTheDocument();
    expect(screen.getByText('3 galibiyet')).toBeInTheDocument();
    expect(screen.getByText('2.lik').previousSibling).toHaveTextContent('1');
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/teacher/students/7/match-stats'))).toBe(true);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/gamification/me/match-stats'))).toBe(false);
  });
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProfilePage from '@/app/(child)/profile/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), token: 'tok', role: 'child', userId: '1' }),
}));

vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Test Sporcu',
}));

const ME = {
  rank_name: 'Çaylak', rank_icon: '🐣', xp_total: 10, next_rank_xp: 100,
  badges_earned: 1, badges_total: 5, member_since: '2018-08-07',
};

const DAY_MON = {
  date: '2026-09-07', week_start: '2026-09-07',
  week_days: [
    { date: '2026-09-07', weekday: 0, has_activity: true },
    { date: '2026-09-08', weekday: 1, has_activity: false },
    { date: '2026-09-09', weekday: 2, has_activity: true },
    { date: '2026-09-10', weekday: 3, has_activity: false },
    { date: '2026-09-11', weekday: 4, has_activity: true },
    { date: '2026-09-12', weekday: 5, has_activity: false },
    { date: '2026-09-13', weekday: 6, has_activity: false },
  ],
  daily: { play_seconds: 9600, lessons_seconds: 5400, practice_seconds: 14400 },
  monthly: { play_seconds: 30240, lessons_seconds: 23520, practice_seconds: 52440 },
};

const DAY_WED = {
  ...DAY_MON,
  date: '2026-09-09',
  daily: { play_seconds: 60, lessons_seconds: 0, practice_seconds: 0 },
};

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/activity/day-summary')) {
      if (url.includes('date_str=2026-09-09')) return Promise.resolve({ ok: true, json: async () => DAY_WED });
      return Promise.resolve({ ok: true, json: async () => DAY_MON });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(ME) });
  }) as unknown as typeof fetch);
}

describe('Profil sayfası — "Bu Hafta" gerçek Maç Yap/Dersler/Pratik Yap süresi (madde 2026-09-06, Görsel 4)', () => {
  beforeEach(stubFetch);

  it('kaç gün çalıştığı gerçek veriden hesaplanır (3 gün) ve başlığın altı çizgi taşır', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByText('3 gün çalıştı'));
    const title = screen.getByText('Bu Hafta');
    const row = title.closest<HTMLElement>('div.flex.items-center.justify-between');
    expect(row?.className).toContain('border-b');
  });

  it('varsayılan (bugün=Pazartesi) günün Günlük/Aylık süreleri 3 kategori kartında gösterilir', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByText('Maç Yap'));
    expect(screen.getByText('Dersler')).toBeInTheDocument();
    expect(screen.getByText('Pratik Yap')).toBeInTheDocument();
    // Maç Yap: daily 9600s = 2 saat 40 dk, monthly 30240s = 8 saat 24 dk.
    expect(screen.getAllByText('2 saat 40 dk').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8 saat 24 dk').length).toBeGreaterThan(0);
  });

  it('farklı bir güne tıklayınca o günün özeti yeniden çekilip gösterilir', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByText('Maç Yap'));

    // 3. gün kutusu = Çarşamba (2026-09-09, has_activity true).
    const wedButton = screen.getByText('Ça').closest('button');
    expect(wedButton).not.toBeNull();
    fireEvent.click(wedButton!);

    await waitFor(() => expect(screen.getAllByText('1 dk').length).toBeGreaterThan(0));
  });
});

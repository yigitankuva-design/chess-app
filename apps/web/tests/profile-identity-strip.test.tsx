import { render, screen, waitFor } from '@testing-library/react';
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

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(ME) })
  ) as unknown as typeof fetch);
}

describe('Profil sayfası — kimlik şeridi (madde 2026-09-06, Görsel 1)', () => {
  beforeEach(stubFetch);

  it('Türkiye bayrağı ve üyelik tarihi "7 Ağu 2018" biçiminde gösterilir', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByText('Test Sporcu'));
    expect(screen.getByText(/🇹🇷/)).toBeInTheDocument();
    expect(screen.getByText(/Türkiye/)).toBeInTheDocument();
    expect(screen.getByText(/Üyelik tarihi 7 Ağu 2018/)).toBeInTheDocument();
  });
});

describe('Profil sayfası — kart başlıklarının altında ayırıcı çizgi (madde 2026-09-06, Görsel 2/3)', () => {
  beforeEach(stubFetch);

  it('"Performans Puanı" başlığının kapsayıcısı alt çizgi (border-b) taşır', async () => {
    render(<ProfilePage />);
    const title = await screen.findByText('Performans Puanı');
    const row = title.closest<HTMLElement>('div.flex.items-center.justify-between');
    expect(row?.className).toContain('border-b');
  });

  it('"Genel Maç İstatistikleri" başlığının kapsayıcısı alt çizgi (border-b) taşır', async () => {
    render(<ProfilePage />);
    const title = await screen.findByText('Genel Maç İstatistikleri');
    const row = title.closest<HTMLElement>('div.flex.items-center.justify-between');
    expect(row?.className).toContain('border-b');
  });

  it('Genel Maç İstatistikleri kutucukları ortalanır (text-center)', async () => {
    render(<ProfilePage />);
    const label = await screen.findByText('Toplam Maç');
    const tile = label.closest<HTMLElement>('div.rounded-xl');
    expect(tile?.className).toContain('text-center');
  });
});

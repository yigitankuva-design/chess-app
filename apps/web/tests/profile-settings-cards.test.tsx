import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('Profil sayfası — alt ayar kartları (Tema/Tahta Rengi/Taş/Dil/Çıkış)', () => {
  beforeEach(stubFetch);

  it('5 kart render edilir: 4 ayar + Çıkış', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByLabelText('Tema Değiştir'));

    expect(screen.getByLabelText('Tema Değiştir')).toBeInTheDocument();
    expect(screen.getByLabelText('Tahta Renklerini Değiştir')).toBeInTheDocument();
    expect(screen.getByLabelText('Taş Görünümünü Değiştir')).toBeInTheDocument();
    expect(screen.getByLabelText('Dil Seçeneği')).toBeInTheDocument();
    expect(screen.getByLabelText('Çıkış')).toBeInTheDocument();

    // Hiçbir karta tıklanmadan panel açık olmamalı
    expect(screen.queryByText('Sakin')).not.toBeInTheDocument();
  });

  it('"Tema Değiştir" tıklanınca tema seçenekleri açılır, tekrar tıklayınca kapanır', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByLabelText('Tema Değiştir'));

    fireEvent.click(screen.getByLabelText('Tema Değiştir'));
    expect(screen.getByText('Klasik')).toBeInTheDocument();
    expect(screen.getByText('Gece')).toBeInTheDocument();
    expect(screen.getByText('Neon')).toBeInTheDocument();
    expect(screen.getByText('Sakin')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Tema Değiştir'));
    expect(screen.queryByText('Sakin')).not.toBeInTheDocument();
  });

  it('"Tahta Renklerini Değiştir" renk seçeneklerini gösterir', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByLabelText('Tahta Renklerini Değiştir'));

    fireEvent.click(screen.getByLabelText('Tahta Renklerini Değiştir'));
    expect(screen.getByText('Mavi')).toBeInTheDocument();
    expect(screen.getByText('Kahve')).toBeInTheDocument();
    expect(screen.getByText('Yeşil')).toBeInTheDocument();
    expect(screen.getByText('Mor')).toBeInTheDocument();
    expect(screen.getByText('IC')).toBeInTheDocument();
  });

  it('"Taş Görünümünü Değiştir" taş setlerini gösterir; aynı anda sadece bir panel açık olur', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByLabelText('Taş Görünümünü Değiştir'));

    fireEvent.click(screen.getByLabelText('Tahta Renklerini Değiştir'));
    expect(screen.getByText('Mavi')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Taş Görünümünü Değiştir'));
    expect(screen.queryByText('Mavi')).not.toBeInTheDocument();
    expect(screen.getByText('Mevcut (Cburnett)')).toBeInTheDocument();
    expect(screen.getByText('Merida')).toBeInTheDocument();
    expect(screen.getByText('Chessnut')).toBeInTheDocument();
    expect(screen.getByText('Kiwen-Suwi')).toBeInTheDocument();
  });

  it('"Dil Seçeneği" sadece Türkçe gösterir', async () => {
    render(<ProfilePage />);
    await waitFor(() => screen.getByLabelText('Dil Seçeneği'));

    fireEvent.click(screen.getByLabelText('Dil Seçeneği'));
    expect(screen.getByText('Türkçe')).toBeInTheDocument();
  });
});

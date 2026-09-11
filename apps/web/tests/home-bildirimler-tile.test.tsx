import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi Faz 4): Hızlı Erişim'deki sabit "Bildirimler" kartı.
vi.mock('@/lib/auth-storage', () => ({ getAthleteName: () => 'Test Sporcu', getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({
    settings: {
      labels: {
        sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
        features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz', eglence: 'Eğlence' },
        icons: { play: '', lessons: '', analiz: '', eglence: '' },
      },
    },
  }),
}));
vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['play'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([])),
  getCustomTab: vi.fn(() => Promise.resolve(null)),
}));

const fetchNotifications = vi.fn();
vi.mock('@/lib/notificationsApi', () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotifications(...args),
}));

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
  fetchNotifications.mockReset();
});

import HomePage from '@/app/(child)/home/page';

describe('Ana sayfa — "Bildirimler" kartı (madde 2026-09-11, Ödev Sistemi Faz 4)', () => {
  it('kart her zaman görünür, ayrı sayfaya (link) gider', async () => {
    fetchNotifications.mockResolvedValue({ unread_count: 0, items: [] });
    render(<HomePage />);
    await waitFor(() => screen.getByText('Bildirimler'));
    const link = screen.getByText('Bildirimler').closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', '/bildirimler');
  });

  it('okunmamış bildirim varsa kırmızı rozet sayıyı gösterir', async () => {
    fetchNotifications.mockResolvedValue({ unread_count: 3, items: [] });
    render(<HomePage />);
    await waitFor(() => screen.getByText('3'));
    expect(screen.getByLabelText('3 yeni bildirim')).toBeInTheDocument();
  });

  it('madde 2026-09-11 (Görsel Turu A/10): rozet zilin ÜSTÜNDE, zil çalar, kart dikkat modunda', async () => {
    fetchNotifications.mockResolvedValue({ unread_count: 3, items: [] });
    render(<HomePage />);
    const badge = await waitFor(() => screen.getByLabelText('3 yeni bildirim'));
    const link = screen.getByText('Bildirimler').closest('a')!;
    // Kart: dikkat sınıfı (nefes alan çerçeve).
    expect(link).toHaveClass('qa-attention');
    // Rozet ARTIK kart köşesinde (LED'in yanında) DEĞİL — zil ikonunun kapsayıcısında.
    expect(badge.parentElement).not.toBe(link);
    expect(badge.parentElement?.textContent).toContain('🔔');
    // Zil sallanma sınıfı.
    expect(link.querySelector('.qa-bell-ring')?.textContent).toBe('🔔');
  });

  it('okunmamış bildirim yoksa rozet ve dikkat efektleri HİÇ gösterilmez', async () => {
    fetchNotifications.mockResolvedValue({ unread_count: 0, items: [] });
    render(<HomePage />);
    await waitFor(() => screen.getByText('Bildirimler'));
    expect(screen.queryByLabelText(/yeni bildirim/)).not.toBeInTheDocument();
    const link = screen.getByText('Bildirimler').closest('a')!;
    expect(link).not.toHaveClass('qa-attention');
    expect(link.querySelector('.qa-bell-ring')).toBeNull();
  });
});

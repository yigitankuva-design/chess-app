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

  it('okunmamış bildirim yoksa rozet HİÇ gösterilmez', async () => {
    fetchNotifications.mockResolvedValue({ unread_count: 0, items: [] });
    render(<HomePage />);
    await waitFor(() => screen.getByText('Bildirimler'));
    expect(screen.queryByLabelText(/yeni bildirim/)).not.toBeInTheDocument();
  });
});

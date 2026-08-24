import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

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
  listCustomTabs: vi.fn(() => Promise.resolve([
    { id: 5, order_index: 1, label: 'Turnuvalar', emoji: '📌' },
  ])),
  getCustomTab: vi.fn(() => Promise.resolve({
    id: 5, label: 'Turnuvalar', emoji: '📌',
    sections: [{ id: 50, order_index: 1, title: 'Kayıt', body: 'En az 8 yaş', images: [], practice_positions: [] }],
  })),
}));

global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;

import HomePage from '@/app/(child)/home/page';

/** Sayfa yenilemesini SİMÜLE eder: React ağacını söküp aynı sessionStorage
 *  ile YENİDEN mount eder — F5'te component state kaybolur ama sessionStorage
 *  kalır, tam olarak gerçek bir sayfa yenilemesindeki gibi. */
function simulateRefresh() {
  cleanup();
  return render(<HomePage />);
}

describe('Hızlı Erişim — sayfa yenilenince görünüm DEĞİŞMEZ (madde: 2026-08-25)', () => {
  it('Maç Yap sekmesi açıkken yenilenince yine açık gelir', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Maç Yap'));
    await waitFor(() => screen.getByText('Bota Karşı Oyna'));

    simulateRefresh();
    await waitFor(() => screen.getByText('Bota Karşı Oyna'));
  });

  it('özel sekme (Turnuvalar) açıkken yenilenince yine açık gelir ve içeriği yeniden yüklenir', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    fireEvent.click(screen.getByText('Turnuvalar'));
    await waitFor(() => screen.getByText('Kayıt'));

    simulateRefresh();
    await waitFor(() => screen.getByText('Kayıt'));
  });

  it('hiçbir sekme açık değilken yenilemek hâlâ kapalı bırakır (yanlış pozitif yok)', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Maç Yap'));
    expect(screen.queryByText('Bota Karşı Oyna')).not.toBeInTheDocument();

    simulateRefresh();
    await waitFor(() => screen.getByText('Maç Yap'));
    expect(screen.queryByText('Bota Karşı Oyna')).not.toBeInTheDocument();
  });
});

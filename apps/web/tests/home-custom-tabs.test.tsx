import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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
    sections: [
      { id: 50, order_index: 1, title: 'Kayıt', body: 'En az 8 yaş', images: [], practice_positions: [] },
      { id: 51, order_index: 1, title: 'Kayıt Formu', body: '', images: [], practice_positions: [], parent_id: 50 },
    ],
  })),
}));

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
});

import HomePage from '@/app/(child)/home/page';

describe('Ana sayfa — özel sekme kartı (B grubu)', () => {
  it('özel sekme kartı AYRI SAYFAYA GİTMEZ (link değil, düğme)', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.getByText('Turnuvalar').closest('a')).toBeNull();
  });

  it('karta tıklayınca alt sekmeler aynı ekranda görünür', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    fireEvent.click(screen.getByText('Turnuvalar'));
    await waitFor(() => screen.getByText('Kayıt'));
    expect(screen.getByText('Kayıt')).toBeInTheDocument();
  });

  it('en üst seviye başlık tema rengini, İÇ seviye başlık sabit metin rengini kullanır (madde 2026-09-02)', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    fireEvent.click(screen.getByText('Turnuvalar'));
    await waitFor(() => screen.getByText('Kayıt'));
    expect(screen.getByText('Kayıt').style.color).toBe('var(--t-accent)');

    fireEvent.click(screen.getByText('Kayıt'));
    await waitFor(() => screen.getByText('Kayıt Formu'));
    expect(screen.getByText('Kayıt Formu').style.color).toBe('var(--t-text-1)');
  });
});

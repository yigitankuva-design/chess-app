import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getAthleteName: () => 'Test Sporcu', getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({
    settings: {
      labels: {
        sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
        features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz', eglence: 'Eğlence' },
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
}));

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
});

import HomePage from '@/app/(child)/home/page';

describe('Ana sayfa — özel sekme kartı (B grubu)', () => {
  it('özel sekme kartı görünür ve /custom/5 linkine gider', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    const link = screen.getByText('Turnuvalar').closest('a');
    expect(link).toHaveAttribute('href', '/custom/5');
  });
});

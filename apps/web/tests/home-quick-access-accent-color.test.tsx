import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getAthleteName: () => 'Test Sporcu' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib/settings/settings-context', async () => {
  const { LEVELS, TIME_GROUPS } = await vi.importActual<typeof import('@/lib/play/levels')>('@/lib/play/levels');
  return {
    useSettings: () => ({
      settings: {
        labels: {
          sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
          features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz', eglence: 'Eğlence' },
          icons: { play: '', lessons: '', analiz: '', eglence: '' },
        },
        customTabs: [],
        play: {
          levels: LEVELS,
          timeGroups: TIME_GROUPS,
          tournamentDefaults: { durationMinutes: 60, timeControlLabel: '10+0', rated: true },
        },
      },
    }),
  };
});

vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['play', 'lessons', 'analiz', 'eglence'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));

import ChildHomePage from '@/app/(child)/home/page';

describe('Ana sayfa Hızlı Erişim — "Tek Vurgu" (madde 2026-09-02)', () => {
  it('4 yerleşik sekme de aktif temanın vurgu rengini (--t-accent) kullanır', () => {
    render(<ChildHomePage />);

    for (const label of ['Maç Yap', 'Dersler', 'Analiz', 'Eğlence']) {
      const el = screen.getByText(label);
      expect(el.style.color).toBe('var(--t-accent)');
    }
  });

  it('yanan kartların parlaması --t-glow kullanır (yalnızca Neon temasında görünür olsun diye)', () => {
    render(<ChildHomePage />);
    const el = screen.getByText('Maç Yap');
    expect(el.style.filter).toBe('drop-shadow(0 0 5px var(--t-glow))');
  });
});

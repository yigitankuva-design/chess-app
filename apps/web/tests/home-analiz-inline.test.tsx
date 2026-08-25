import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getAthleteName: () => 'Test Sporcu' }));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({
    settings: {
      labels: {
        sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
        features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz Et', eglence: 'Eğlence' },
        icons: { play: '', lessons: '', analiz: '', eglence: '' },
      },
      customTabs: [],
    },
  }),
}));

vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['analiz'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));
vi.mock('@/components/analiz/AnalizPanel', () => ({
  AnalizPanel: () => <div data-testid="analiz-panel" />,
}));

import ChildHomePage from '@/app/(child)/home/page';

describe('Ana sayfa — Analiz Et sekmesi AYRI SAYFAYA gitmez, akordiyon içinde açılır (madde 2026-09-01/1)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
  });

  it('sekme kapalıyken AnalizPanel görünmez', () => {
    render(<ChildHomePage />);
    expect(screen.queryByTestId('analiz-panel')).not.toBeInTheDocument();
  });

  it('"Analiz Et" tıklanınca AYNI SAYFADA AnalizPanel açılır, sayfa yönlendirmesi (router.push) OLMAZ', () => {
    render(<ChildHomePage />);
    fireEvent.click(screen.getByText('Analiz Et'));
    expect(screen.getByTestId('analiz-panel')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('"Analiz Et" kartı artık /analiz\'e giden bir <a> linki DEĞİLDİR', () => {
    render(<ChildHomePage />);
    const label = screen.getByText('Analiz Et');
    expect(label.closest('a')).toBeNull();
  });

  it('tekrar tıklayınca kapanır', () => {
    render(<ChildHomePage />);
    fireEvent.click(screen.getByText('Analiz Et'));
    expect(screen.getByTestId('analiz-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Analiz Et'));
    expect(screen.queryByTestId('analiz-panel')).not.toBeInTheDocument();
  });
});

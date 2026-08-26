import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getAthleteName: () => 'Test Sporcu' }));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

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

vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['play'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));

import ChildHomePage from '@/app/(child)/home/page';

const MODES = ['Arkadaşla Oyna', 'Bota Karşı Oyna', 'Turnuvaya Katıl'];

function openPlayTab() {
  render(<ChildHomePage />);
  fireEvent.click(screen.getByText('Maç Yap'));
}

describe('Ana sayfa — Maç Yap sekmesi 3 maç türü', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
  });

  it('sekme kapalıyken maç türleri görünmez', () => {
    render(<ChildHomePage />);
    for (const m of MODES) expect(screen.queryByText(m)).not.toBeInTheDocument();
  });

  it('sekmeye tıklanınca üç maç türü de sekmenin altında açılır', () => {
    openPlayTab();
    for (const m of MODES) expect(screen.getByText(m)).toBeInTheDocument();
  });

  it('Arkadaşla Oyna kriter ekranına götürür (eski /play/online değil)', () => {
    openPlayTab();
    expect(screen.getByText('Arkadaşla Oyna').closest('a')).toHaveAttribute('href', '/play?mode=friend');
  });

  it('REGRESYON: Açılış Pratiği Yap artık burada değil (Pratik Yap özel sekmesine taşındı)', () => {
    openPlayTab();
    expect(screen.queryByText('Açılış Pratiği Yap')).not.toBeInTheDocument();
  });

  it('Turnuvaya Katıl turnuva akışına götürür', () => {
    openPlayTab();
    expect(screen.getByText('Turnuvaya Katıl').closest('a')).toHaveAttribute('href', '/play?mode=tournament');
  });

  it('Bota Karşı Oyna sayfa değiştirmeden kriter seçimini açar', () => {
    openPlayTab();
    expect(screen.queryByRole('button', { name: 'Düzey 1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    // Madde 5: ana sayfa artik maç sayfasindaki AYNI bileseni gosteriyor.
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
    expect(screen.getByText(/Tempo ve Süre Seç/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Maça Başla/ })).toBeInTheDocument();
  });

  it('kriterler seçilince bot maçına yönlendirir', () => {
    push.mockClear();
    openPlayTab();
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 4' }));
    fireEvent.click(screen.getByRole('button', { name: '10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Maça Başla/ }));
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain('mode=bot');
    expect(url).toContain('tc=10%2B0');
  });

  it('sekme tekrar tıklanınca maç türleri kapanır', () => {
    openPlayTab();
    fireEvent.click(screen.getByText('Maç Yap'));
    for (const m of MODES) expect(screen.queryByText(m)).not.toBeInTheDocument();
  });
});

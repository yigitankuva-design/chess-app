import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getAthleteName: () => 'Test Sporcu' }));

vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({
    settings: {
      labels: {
        sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
        features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz', eglence: 'Eğlence' },
      },
      customTabs: [],
    },
  }),
}));

vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['play'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));

import ChildHomePage from '@/app/(child)/home/page';

const MODES = ['Arkadaşla Oyna', 'Bota Karşı Oyna', 'Açılış Pratiği Yap', 'Turnuvaya Katıl'];

function openPlayTab() {
  render(<ChildHomePage />);
  fireEvent.click(screen.getByText('Maç Yap'));
}

describe('Ana sayfa — Maç Yap sekmesi 4 maç türü', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
  });

  it('sekme kapalıyken maç türleri görünmez', () => {
    render(<ChildHomePage />);
    for (const m of MODES) expect(screen.queryByText(m)).not.toBeInTheDocument();
  });

  it('sekmeye tıklanınca dört maç türü de sekmenin altında açılır', () => {
    openPlayTab();
    for (const m of MODES) expect(screen.getByText(m)).toBeInTheDocument();
  });

  it('Arkadaşla Oyna kriter ekranına götürür (eski /play/online değil)', () => {
    openPlayTab();
    expect(screen.getByText('Arkadaşla Oyna').closest('a')).toHaveAttribute('href', '/play?mode=friend');
  });

  it('Açılış Pratiği Yap açılış akışına götürür', () => {
    openPlayTab();
    expect(screen.getByText('Açılış Pratiği Yap').closest('a')).toHaveAttribute('href', '/play?mode=opening');
  });

  it('Turnuvaya Katıl turnuva akışına götürür', () => {
    openPlayTab();
    expect(screen.getByText('Turnuvaya Katıl').closest('a')).toHaveAttribute('href', '/play?mode=tournament');
  });

  it('Bota Karşı Oyna sayfa değiştirmeden zorluk seçimini açar', () => {
    openPlayTab();
    expect(screen.queryByText('1 · Zorluk')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    expect(screen.getByText('1 · Zorluk')).toBeInTheDocument();
  });

  it('sekme tekrar tıklanınca maç türleri kapanır', () => {
    openPlayTab();
    fireEvent.click(screen.getByText('Maç Yap'));
    for (const m of MODES) expect(screen.queryByText(m)).not.toBeInTheDocument();
  });
});

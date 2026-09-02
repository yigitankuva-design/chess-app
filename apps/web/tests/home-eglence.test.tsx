import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getAthleteName: () => 'Test Sporcu' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({
    settings: {
      labels: {
        sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
        features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz', eglence: 'Eğlence' },
        icons: { play: '', lessons: '', analiz: '', eglence: '' },
      },
      customTabs: [],
    },
  }),
}));

vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['eglence'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));

import ChildHomePage from '@/app/(child)/home/page';

const ACTIVITIES = [
  { id: 1, name: 'Koordinat Yarışı', description: 'Kareleri hızlıca bul', emoji: '🏁' },
  { id: 2, name: 'Bulmaca Düellosu', description: '', emoji: '⚔️' },
];

describe('Ana sayfa — Eğlence sekmesi (madde: 2026-08-21, admin verisi)', () => {
  it('sekme kapalıyken oyun/yarışma kartları görünmez, /fun-activities isteği atılmaz', () => {
    const fetchSpy = vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => [] }));
    global.fetch = fetchSpy as never;
    render(<ChildHomePage />);
    expect(screen.queryByText('Koordinat Yarışı')).not.toBeInTheDocument();
    expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes('/fun-activities'))).toBe(false);
  });

  it('sekmeye tıklanınca admin\'in eklediği kartlar dairesel kart olarak listelenir', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITIES })) as never;
    render(<ChildHomePage />);
    fireEvent.click(screen.getByText('Eğlence'));
    expect(await screen.findByText('Koordinat Yarışı')).toBeInTheDocument();
    expect(screen.getByText('Bulmaca Düellosu')).toBeInTheDocument();
    const link = screen.getByText('Koordinat Yarışı').closest('a');
    expect(link).toHaveAttribute('href', '/eglence/1');
  });

  it('oyun/yarışma adları aktif temanın vurgu rengini kullanır (madde 2026-09-02 "Tek Vurgu")', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITIES })) as never;
    render(<ChildHomePage />);
    fireEvent.click(screen.getByText('Eğlence'));
    const el = await screen.findByText('Koordinat Yarışı');
    expect(el.style.color).toBe('var(--t-accent)');
  });

  it('hiç kart eklenmediyse bilgi mesajı gösterilir', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
    render(<ChildHomePage />);
    fireEvent.click(screen.getByText('Eğlence'));
    await waitFor(() =>
      expect(screen.getByText('Henüz oyun/yarışma eklenmedi.')).toBeInTheDocument(),
    );
  });
});

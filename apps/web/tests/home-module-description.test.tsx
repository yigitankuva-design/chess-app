import { describe, it, expect, vi } from 'vitest';
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
vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['lessons'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([])),
  getCustomTab: vi.fn(() => Promise.resolve(null)),
}));

global.fetch = vi.fn((url: string) => {
  if (url.includes('/modules')) {
    return Promise.resolve({
      ok: true,
      json: async () => [
        {
          id: 1, order_index: 1, name: 'Temel Düzey',
          description: 'ELO 0-399, yeni başlayanlar için.',
          topics: 'Satranç Tahtası, Taşlar ve Temel Kurallar',
          lessons_count: 0,
        },
        { id: 2, order_index: 2, name: 'Orta Düzey', description: '', lessons_count: 0 },
      ],
    });
  }
  return Promise.resolve({ ok: true, json: async () => [] });
}) as never;

import HomePage from '@/app/(child)/home/page';

describe('Ana sayfa — Dersler düzey açıklaması (madde 2026-09-05 (1), güncelleme 2026-09-07 (2))', () => {
  it('numaralandırma (1./2.) KALDIRILDI — düzey adı numarasız gösterilir', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    expect(screen.queryByText('1. Temel Düzey')).not.toBeInTheDocument();
    expect(screen.getByText('Orta Düzey')).toBeInTheDocument();
  });

  it('açıklaması olan düzeyde açıklama PARANTEZ İÇİNDE VE BEYAZ (t-text) gösterilir', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    const el = screen.getByText('(ELO 0-399, yeni başlayanlar için.)');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('t-text');
    expect(el.className).not.toContain('t-muted');
  });

  it('3. satırda konu özeti (topics) PARANTEZ İÇİNDE VE İTALİK gösterilir (görsel: 2026-09-08)', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Temel Düzey'));
    const el = screen.getByText('(Satranç Tahtası, Taşlar ve Temel Kurallar)');
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('italic');
    expect(el.className).toContain('t-text');
    expect(el.className).not.toContain('t-muted');
  });

  it('düzey adı mavi (Dersler marka rengi) gösterilir (görsel: 2026-09-08)', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    const label = await screen.findByText('Temel Düzey');
    expect(label.style.color).toBe('#38bdf8');
  });

  it('açıklaması olmayan düzeyde hiçbir açıklama satırı gösterilmez', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Orta Düzey'));
    // "Orta Düzey" başlığı yanında boş bir açıklama paragrafı OLMAMALI.
    const label = screen.getByText('Orta Düzey');
    const row = label.closest('button');
    expect(row?.parentElement?.querySelector('p.t-text')).toBeNull();
  });
});

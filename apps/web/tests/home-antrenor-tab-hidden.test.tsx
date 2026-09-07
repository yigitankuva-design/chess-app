import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-07 (Antrenör Paneli, 1): "Sporcunun sayfasında bulunan
 * Antrenör sekmesini kaldır" — admin'in Sekmeler'de yönettiği, adı TAM
 * OLARAK "Antrenör" olan özel sekme artık sporcunun Hızlı Erişim'inde
 * (/home) GÖSTERİLMİYOR. Aynı içerik antrenörün KENDİ panelinde (/coach)
 * hâlâ görünür — bkz. coach-home-page.test.tsx'teki "Antrenör Dosyası"
 * testi (kasıtlı olarak FARKLI bir etiket kullanıyor, çakışmasın diye;
 * gerçek üretim etiketi burada test edildiği gibi tam "Antrenör").
 * Diğer özel sekmeler (adı "Antrenör" OLMAYAN) etkilenmez.
 */
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
    { id: 5, order_index: 1, label: 'Antrenör', emoji: '🎓' },
    { id: 6, order_index: 2, label: 'Turnuvalar', emoji: '📌' },
  ])),
  getCustomTab: vi.fn(),
}));

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
});

import HomePage from '@/app/(child)/home/page';

describe('Sporcu Hızlı Erişim — "Antrenör" özel sekmesi artık gösterilmez (madde 2026-09-07, 1)', () => {
  it('"Antrenör" etiketli sekme kartı YOK, diğer özel sekmeler (Turnuvalar) hâlâ görünür', async () => {
    render(<HomePage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.queryByText('Antrenör')).not.toBeInTheDocument();
  });
});

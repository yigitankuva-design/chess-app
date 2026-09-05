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
  if (url.includes('/assignments')) return Promise.resolve({ ok: true, json: async () => [] });
  if (url.includes('/modules/1/lessons')) {
    return Promise.resolve({
      ok: true, json: async () => [{ id: 10, order_index: 1, title: 'Ders 1', estimated_minutes: 8 }],
    });
  }
  if (url.includes('/modules')) {
    return Promise.resolve({
      ok: true, json: async () => [{ id: 1, order_index: 1, name: 'Temel Düzey', description: '', lessons_count: 1 }],
    });
  }
  if (url.includes('/lessons/10')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        steps: [{ id: 100, type: 'explanation', content_json: { title: 'Tahtanın Genel Özellikleri' } }],
      }),
    });
  }
  return Promise.resolve({ ok: true, json: async () => [] });
}) as never;

import HomePage from '@/app/(child)/home/page';

async function openAltKonuCards() {
  render(<HomePage />);
  fireEvent.click(screen.getByText('Dersler'));
  await waitFor(() => screen.getByText('Temel Düzey'));
  fireEvent.click(screen.getByText('Temel Düzey'));
  await waitFor(() => screen.getByText('Ders 1'));
  fireEvent.click(screen.getByText('Ders 1'));
  await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
  fireEvent.click(screen.getByText('Tahtanın Genel Özellikleri'));
  await waitFor(() => screen.getByText('Video İzle'));
}

describe('Ana sayfa — Alt Konu pratik kartları (madde 2026-09-05: Video İzle + Ödevini Yap yeniden adlandırma)', () => {
  it('4 kart görünür: Video İzle, Ödevini Yap, Süreli Pratik Yap, Kendini Test Et — "Süresiz Pratik Yap" artık YOK', async () => {
    await openAltKonuCards();
    expect(screen.getByText('Ödevini Yap')).toBeInTheDocument();
    expect(screen.getByText('Süreli Pratik Yap')).toBeInTheDocument();
    expect(screen.getByText('Kendini Test Et')).toBeInTheDocument();
    expect(screen.queryByText('Süresiz Pratik Yap')).not.toBeInTheDocument();
  });

  it('Video İzle kartı tıklanamaz (henüz sadece görsel — Link/href yok)', async () => {
    await openAltKonuCards();
    expect(screen.getByText('Video İzle').closest('a')).toBeNull();
  });
});

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
  if (url.includes('/assignments')) {
    return Promise.resolve({
      ok: true,
      json: async () => [
        {
          id: 1, title: 'İtalyan Açılışı Ödevi', description: null, due_date: '2026-09-10',
          target_module_id: 2, target_lesson_id: 5, target_title: 'Açık Oyunlar',
          completed: false,
        },
        {
          id: 2, title: 'Tamamlanan Ödev', description: null, due_date: null,
          target_module_id: 1, target_lesson_id: null, target_title: 'Temel Düzey',
          completed: true,
        },
      ],
    });
  }
  if (url.includes('/modules')) {
    return Promise.resolve({ ok: true, json: async () => [] });
  }
  return Promise.resolve({ ok: true, json: async () => [] });
}) as never;

import HomePage from '@/app/(child)/home/page';

describe('Ana sayfa — Dersler sekmesi "Ödevlerim" (madde 2026-09-05: Antrenör → Ödev → Dersler köprüsü)', () => {
  it('atanmış ödevler başlık, hedef ve son tarihle listelenir', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('İtalyan Açılışı Ödevi'));
    expect(screen.getByText('Açık Oyunlar')).toBeInTheDocument();
    expect(screen.getByText('2026-09-10')).toBeInTheDocument();
  });

  it('tamamlanan ödev ✅ ile, tamamlanmamış olan 📝 ile gösterilir', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('Tamamlanan Ödev'));
    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
  });

  it('bir ödeve tıklayınca hedef derse/modüle giden link doğru href taşır', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => screen.getByText('İtalyan Açılışı Ödevi'));
    const withLesson = screen.getByText('İtalyan Açılışı Ödevi').closest('a');
    expect(withLesson).toHaveAttribute('href', '/lesson/5');
    const withoutLesson = screen.getByText('Tamamlanan Ödev').closest('a');
    expect(withoutLesson).toHaveAttribute('href', '/modules/1');
  });

  it('hiç ödev yoksa "Ödevlerim" bölümü hiç görünmez', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/assignments')) return Promise.resolve({ ok: true, json: async () => [] });
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    render(<HomePage />);
    fireEvent.click(screen.getByText('Dersler'));
    await waitFor(() => expect(screen.queryByText('Düzeyler yükleniyor...')).not.toBeInTheDocument());
    expect(screen.queryByText('📌 Ödevlerim')).not.toBeInTheDocument();
  });
});

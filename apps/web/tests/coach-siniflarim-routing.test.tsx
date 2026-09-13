import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 2): antrenörün "Çalışmalar"daki
 * "Sınıflarım" özel sekmesi (kind='siniflarim') diğer özel sekmeler gibi
 * AKORDİYON İÇİNDE açılmaz — ayrı /coach/classes sayfasına gider (bkz.
 * app/(teacher)/coach/page.tsx toggleCustomTab onClick dalı). Sıradan bir
 * özel sekme (kind=null) ise eskisi gibi akordiyonda açılmalı.
 */
const pushMock = vi.fn();
vi.mock('@/lib/auth-storage', () => ({
  getAthleteName: () => 'Test Sporcu', getTeacherName: () => 'Ahmet Antrenör', getToken: () => 'tok',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, replace: vi.fn() }) }));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: 'teacher', hydrated: true, token: 'tok', userId: 1, login: vi.fn(), logout: vi.fn() }),
}));

const SETTINGS = {
  labels: {
    sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Ders Seç' },
    features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz Et', eglence: 'Eğlence' },
    icons: { play: '', lessons: '', analiz: '', eglence: '' },
  },
  customTabs: [],
};
vi.mock('@/lib/settings/settings-context', () => ({ useSettings: () => ({ settings: SETTINGS }) }));
vi.mock('@/lib/settings/defaults', () => ({ visibleTabsInOrder: () => ['play', 'lessons', 'analiz', 'eglence'] }));
vi.mock('@/lib/practice/practiceApi', () => ({ fetchLessonScores: async () => null }));
vi.mock('@/lib/notificationsApi', () => ({ fetchNotifications: vi.fn(() => Promise.resolve({ unread_count: 0, items: [] })) }));
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([
    { id: 1, order_index: 0, label: 'Sınıflarım', emoji: '🏫', kind: 'siniflarim' },
    { id: 2, order_index: 1, label: 'Duyurular', emoji: '📣', kind: null },
  ])),
  getCustomTab: vi.fn(() => Promise.resolve({ id: 2, label: 'Duyurular', emoji: '📣', sections: [] })),
}));

beforeEach(() => {
  pushMock.mockClear();
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
});

import CoachHomePage from '@/app/(teacher)/coach/page';
import { getCustomTab } from '@/lib/customTabsApi';

describe('Madde 2026-09-13: Sınıflarım sekmesi ayrı sayfaya gider', () => {
  it('"Sınıflarım" (kind=siniflarim) tıklanınca /coach/classes\'e yönlendirir, akordiyon açılmaz', async () => {
    render(<CoachHomePage />);
    const tab = await screen.findByText('Sınıflarım');
    fireEvent.click(tab);
    expect(pushMock).toHaveBeenCalledWith('/coach/classes');
    expect(screen.queryByText('Yükleniyor...')).not.toBeInTheDocument();
  });

  it('sıradan bir özel sekme (kind=null) yönlendirme YAPMAZ (akordiyon dalına girer)', async () => {
    render(<CoachHomePage />);
    const tab = await screen.findByText('Duyurular');
    fireEvent.click(tab);
    await waitFor(() => expect(getCustomTab).toHaveBeenCalledWith(2));
    expect(pushMock).not.toHaveBeenCalled();
  });
});

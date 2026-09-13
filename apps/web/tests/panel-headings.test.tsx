import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-13: sporcu ekranında "Hızlı Erişim" başlığı artık sabit
 * "Sporcu Paneli", antrenör ekranında sabit "Antrenör Paneli" — öncesinde
 * ikisi de admin panelinden düzenlenen AYNI paylaşılan `labels.sections.
 * quickAccess` değerini kullanıyordu (Zafer'in isteği: ikisi FARKLI metin
 * göstersin).
 */
vi.mock('@/lib/auth-storage', () => ({
  getAthleteName: () => 'Test Sporcu', getTeacherName: () => 'Ahmet Antrenör', getToken: () => 'tok',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: 'teacher', hydrated: true, token: 'tok', userId: 1, login: vi.fn(), logout: vi.fn() }),
}));

const SETTINGS = {
  labels: {
    // Kasıtlı olarak "Hızlı Erişim" — bu artık HİÇBİR YERDE ekrana basılmamalı.
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
  listCustomTabs: vi.fn(() => Promise.resolve([])),
  getCustomTab: vi.fn(() => Promise.resolve(null)),
}));

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
});

import ChildHomePage from '@/app/(child)/home/page';
import CoachHomePage from '@/app/(teacher)/coach/page';

describe('Madde 2026-09-13: panel başlıkları rol bazında sabit', () => {
  it('sporcu ekranında "Sporcu Paneli" görünür, "Hızlı Erişim" YOK', async () => {
    render(<ChildHomePage />);
    await waitFor(() => screen.getByText('Sporcu Paneli'));
    expect(screen.queryByText('Hızlı Erişim')).not.toBeInTheDocument();
  });

  it('antrenör ekranında "Antrenör Paneli" görünür, "Hızlı Erişim" YOK', async () => {
    render(<CoachHomePage />);
    await waitFor(() => screen.getByText('Antrenör Paneli'));
    expect(screen.queryByText('Hızlı Erişim')).not.toBeInTheDocument();
  });
});

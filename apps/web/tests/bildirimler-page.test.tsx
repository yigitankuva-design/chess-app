import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Madde 2026-09-11 (Ödev Sistemi Faz 4): sporcu "Bildirimler" sayfası.
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }));

const mocks = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  markNotificationVisited: vi.fn(),
}));
vi.mock('@/lib/notificationsApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/notificationsApi')>('@/lib/notificationsApi');
  return { ...actual, fetchNotifications: mocks.fetchNotifications, markNotificationVisited: mocks.markNotificationVisited };
});

import BildirimlerPage from '@/app/(child)/bildirimler/page';

beforeEach(() => {
  vi.clearAllMocks();
  routerPush.mockClear();
  mocks.markNotificationVisited.mockResolvedValue(true);
});

it('boş listede "Henüz bildirim yok." gösterir', async () => {
  mocks.fetchNotifications.mockResolvedValue({ unread_count: 0, items: [] });
  render(<BildirimlerPage />);
  await waitFor(() => screen.getByText('Henüz bildirim yok.'));
});

it('"N yeni bildirim" ve YENİ etiketi + yeşil Git gösterir, ziyaret edilmiş satırda kırmızı Git', async () => {
  mocks.fetchNotifications.mockResolvedValue({
    unread_count: 1,
    items: [
      {
        id: 1, type: 'odev', title: 'Yeni Ödev: Merkez', subtitle: 'Temel Düzey › Tahta ve Taşlar',
        created_at: '2026-09-11T10:00:00Z', visited_at: null,
        target: { lesson_step_id: 5, lesson_id: 10, alt_konu_title: 'Merkez' },
      },
      {
        id: 2, type: 'odev', title: 'Yeni Ödev: Açılış', subtitle: null,
        created_at: '2026-09-10T10:00:00Z', visited_at: '2026-09-10T12:00:00Z',
        target: { lesson_step_id: 6, lesson_id: 11, alt_konu_title: 'Açılış' },
      },
    ],
  });
  render(<BildirimlerPage />);
  await waitFor(() => screen.getByText('1 yeni bildirim'));
  expect(screen.getByText('YENİ')).toBeInTheDocument();

  const gitButtons = screen.getAllByTitle('Git');
  expect(gitButtons[0]).toHaveStyle({ background: '#22c55e' }); // ziyaret edilmemiş → yeşil
  expect(gitButtons[1]).toHaveStyle({ background: '#ef4444' }); // ziyaret edilmiş → kırmızı
});

it('Git\'e basınca ziyaret işaretlenir ve ödev hedefine yönlendirir', async () => {
  mocks.fetchNotifications.mockResolvedValue({
    unread_count: 1,
    items: [{
      id: 1, type: 'odev', title: 'Yeni Ödev: Merkez', subtitle: null,
      created_at: '2026-09-11T10:00:00Z', visited_at: null,
      target: { lesson_step_id: 5, lesson_id: 10, alt_konu_title: 'Merkez' },
    }],
  });
  render(<BildirimlerPage />);
  await waitFor(() => screen.getByText('Yeni Ödev: Merkez'));
  fireEvent.click(screen.getByTitle('Git'));

  await waitFor(() => expect(mocks.markNotificationVisited).toHaveBeenCalledWith(1));
  expect(routerPush).toHaveBeenCalledWith('/pratik/suresiz?konu=Merkez&step=5&ders=10');
  // Optimistik güncelleme: "YENİ" etiketi ve sayaç hemen kalkar.
  await waitFor(() => expect(screen.queryByText('YENİ')).not.toBeInTheDocument());
  expect(screen.queryByText('1 yeni bildirim')).not.toBeInTheDocument();
});

it('madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): hoca_notu türünde Git\'e basınca /profile\'a gider', async () => {
  mocks.fetchNotifications.mockResolvedValue({
    unread_count: 1,
    items: [{
      id: 9, type: 'hoca_notu', title: 'Hoca sana bir not bıraktı', subtitle: 'Açılışta daha dikkatli ol.',
      created_at: '2026-09-11T10:00:00Z', visited_at: null, target: null,
    }],
  });
  render(<BildirimlerPage />);
  await waitFor(() => screen.getByText('Hoca sana bir not bıraktı'));
  expect(screen.getByText('📝')).toBeInTheDocument();
  fireEvent.click(screen.getByTitle('Git'));

  await waitFor(() => expect(mocks.markNotificationVisited).toHaveBeenCalledWith(9));
  expect(routerPush).toHaveBeenCalledWith('/profile');
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({ reload: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(),
  createCustomTab: vi.fn(),
  deleteCustomTab: vi.fn(() => Promise.resolve(true)),
  getCustomTab: vi.fn(),
  createCustomTabSection: vi.fn(),
  deleteCustomTabSection: vi.fn(() => Promise.resolve(true)),
}));

import AdminTabsPage from '@/app/admin/settings/tabs/page';
import {
  listCustomTabs, getCustomTab, createCustomTabSection,
} from '@/lib/customTabsApi';

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({}) }),
  ) as never;
  (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 7, order_index: 1, label: 'Turnuvalar', emoji: '📌' },
  ]);
  (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 7, label: 'Turnuvalar', emoji: '📌',
    sections: [{ id: 10, order_index: 1, title: 'Kayıt Şartları', body: 'En az 8 yaş', images: [] }],
  });
});

async function openTurnuvalar() {
  render(<AdminTabsPage />);
  await waitFor(() => screen.getByText(/Turnuvalar/));
  fireEvent.click(screen.getByLabelText('Turnuvalar sekmesini aç'));
  await waitFor(() => screen.getByText('Kayıt Şartları'));
}

describe('Admin özel sekme — alt sekmeler kart içinde (inline)', () => {
  it('AÇ basınca alt sekme başlığı görünür, yazı henüz görünmez (kapalı akordiyon)', async () => {
    await openTurnuvalar();
    expect(screen.getByText('Kayıt Şartları')).toBeInTheDocument();
    expect(screen.queryByText('En az 8 yaş')).not.toBeInTheDocument();
  });

  it('alt sekme başlığına tıklayınca yazı görünür', async () => {
    await openTurnuvalar();
    fireEvent.click(screen.getByText('Kayıt Şartları'));
    expect(screen.getByText('En az 8 yaş')).toBeInTheDocument();
  });

  it('+ Alt Sekme Ekle formu ile yeni alt sekme eklenebilir', async () => {
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 11, order_index: 2, title: 'Ödüller', body: 'Kupa', images: [],
    });
    await openTurnuvalar();
    fireEvent.change(screen.getByPlaceholderText('Alt sekme başlığı'), { target: { value: 'Ödüller' } });
    fireEvent.change(screen.getByPlaceholderText('Yazı'), { target: { value: 'Kupa' } });
    fireEvent.click(screen.getByText('Alt sekme ekle'));
    await waitFor(() => expect(createCustomTabSection).toHaveBeenCalledWith(7, 'Ödüller', 'Kupa', []));
    await waitFor(() => screen.getByText('Ödüller'));
  });

  it('etiketi "Pratik Yap" OLMAYAN sekmede "Açılış Pratiği Yap" görünmez', async () => {
    await openTurnuvalar();
    expect(screen.queryByText('Açılış Pratiği Yap')).not.toBeInTheDocument();
  });

  it('etiketi tam olarak "Pratik Yap" olan sekmede sabit "Açılış Pratiği Yap" kısayolu görünür', async () => {
    (listCustomTabs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 9, order_index: 1, label: 'Pratik Yap', emoji: '🧩' },
    ]);
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 9, label: 'Pratik Yap', emoji: '🧩', sections: [],
    });
    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Pratik Yap/));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Açılış Pratiği Yap'));
    const link = screen.getByText('Açılış Pratiği Yap').closest('a');
    expect(link).toHaveAttribute('href', '/admin/openings');
  });
});

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({ reload: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({
  listCustomTabs: vi.fn(() => Promise.resolve([
    { id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' },
  ])),
  createCustomTab: vi.fn(),
  deleteCustomTab: vi.fn(() => Promise.resolve(true)),
}));

import AdminTabsPage from '@/app/admin/settings/tabs/page';

beforeAll(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({}) }),
  ) as never;
});

describe('Admin Sekmeler — eklenen sekme "Sporcuda görünen sekmeler" içinde gösterilir', () => {
  it('eklenen sekme "+ Yeni Sekme Ekle" kartının İÇİNDE değil, DIŞINDA (öncesinde) yer alır', async () => {
    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Turnuvalar/));

    const customLabel = screen.getByText(/Turnuvalar/);
    const addCardHeading = screen.getByText('+ Yeni Sekme Ekle');

    // DOCUMENT_POSITION_PRECEDING (2) = customLabel, addCardHeading'den ÖNCE gelir.
    // Eğer hâlâ "Yeni Sekme Ekle" kartının içinde olsaydı FOLLOWING (4) dönerdi.
    const position = addCardHeading.compareDocumentPosition(customLabel);
    expect(position & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('"Sporcuda görünen sekmeler" sayacı eklenen sekmeyi de sayar', async () => {
    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText(/Turnuvalar/));
    expect(screen.getByText('Sporcuda görünen sekmeler (5)')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({
  getCustomTab: vi.fn(),
  createCustomTabSection: vi.fn(),
  updateCustomTabSection: vi.fn(),
  deleteCustomTabSection: vi.fn(),
}));

import AdminCustomTabPage from '@/app/admin/custom-tabs/[id]/page';
import { getCustomTab, createCustomTabSection, deleteCustomTabSection } from '@/lib/customTabsApi';

const TAB = {
  id: 1, label: 'Turnuvalar', emoji: '📌',
  sections: [
    { id: 10, order_index: 1, title: 'Kayıt Şartları', body: 'metin', images: [] },
  ],
};

beforeEach(() => {
  (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue(TAB);
});

describe('Admin özel sekme bölüm yönetimi', () => {
  it('sekme başlığı ve mevcut bölüm görünür', async () => {
    render(<AdminCustomTabPage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.getByText('Kayıt Şartları')).toBeInTheDocument();
  });

  it('yeni bölüm eklenebilir', async () => {
    (createCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 11, order_index: 2, title: 'Yeni Bölüm', body: 'yeni metin', images: [],
    });
    render(<AdminCustomTabPage />);
    await waitFor(() => screen.getByText('Turnuvalar'));

    fireEvent.change(screen.getByPlaceholderText('Bölüm başlığı'), { target: { value: 'Yeni Bölüm' } });
    fireEvent.change(screen.getByPlaceholderText('Yazı'), { target: { value: 'yeni metin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bölüm ekle' }));

    await waitFor(() => expect(createCustomTabSection).toHaveBeenCalledWith(1, 'Yeni Bölüm', 'yeni metin', []));
  });

  it('bölüm silinebilir', async () => {
    (deleteCustomTabSection as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    render(<AdminCustomTabPage />);
    await waitFor(() => screen.getByText('Kayıt Şartları'));
    fireEvent.click(screen.getByLabelText('Kayıt Şartları bölümünü sil'));
    await waitFor(() => expect(deleteCustomTabSection).toHaveBeenCalledWith(10));
  });
});

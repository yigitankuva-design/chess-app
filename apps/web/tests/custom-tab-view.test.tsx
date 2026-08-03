import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5' }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: vi.fn() }));

import CustomTabViewPage from '@/app/(child)/custom/[id]/page';
import { getCustomTab } from '@/lib/customTabsApi';

describe('Sporcu özel sekme sayfası', () => {
  it('bölümler sırayla başlık+yazı+görsellerle render edilir', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Turnuvalar', emoji: '📌',
      sections: [
        { id: 1, order_index: 1, title: 'Kayıt Şartları', body: 'En az 8 yaş', images: [] },
        { id: 2, order_index: 2, title: 'Ödüller', body: 'Kupa verilir', images: ['data:image/png;base64,abc'] },
      ],
    });
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.getByText('Kayıt Şartları')).toBeInTheDocument();
    expect(screen.getByText('En az 8 yaş')).toBeInTheDocument();
    expect(screen.getByText('Ödüller')).toBeInTheDocument();
    expect(screen.getByAltText('Ödüller görseli 1')).toBeInTheDocument();
  });

  it('bölüm yoksa "Henüz içerik eklenmedi" mesajı görünür', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Turnuvalar', emoji: '📌', sections: [],
    });
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Turnuvalar'));
    expect(screen.getByText('Henüz içerik eklenmedi')).toBeInTheDocument();
  });

  it('sekme bulunamazsa hata mesajı görünür', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Sayfa bulunamadı'));
  });
});

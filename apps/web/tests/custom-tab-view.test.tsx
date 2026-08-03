import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5' }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: vi.fn() }));

import CustomTabViewPage from '@/app/(child)/custom/[id]/page';
import { getCustomTab } from '@/lib/customTabsApi';

describe('Sporcu özel sekme sayfası', () => {
  it('bölüm başlıkları listelenir; tıklanınca yazı+görseller açılır (akordiyon)', async () => {
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
    expect(screen.getByText('Ödüller')).toBeInTheDocument();
    // Kapalı akordiyon: yazı/görsel henüz görünmez.
    expect(screen.queryByText('En az 8 yaş')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Kayıt Şartları'));
    expect(screen.getByText('En az 8 yaş')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ödüller'));
    expect(screen.getByText('Kupa verilir')).toBeInTheDocument();
    expect(screen.getByAltText('Ödüller görseli 1')).toBeInTheDocument();
  });

  it('etiketi "Pratik Yap" olan sekmede sabit "Açılış Pratiği Yap" kısayolu görünür', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Pratik Yap', emoji: '🧩', sections: [],
    });
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Pratik Yap'));
    const link = screen.getByText('Açılış Pratiği Yap').closest('a');
    expect(link).toHaveAttribute('href', '/play?mode=opening');
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

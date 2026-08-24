import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5', sectionId: '203' }),
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: vi.fn() }));

import AltKonuPage from '@/app/(child)/custom/[id]/alt-konu/[sectionId]/page';
import { getCustomTab } from '@/lib/customTabsApi';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Alt Konu ayrı sayfası — madde 2026-08-25', () => {
  it('bölüm başlığı, yazı/görsel ve SIRALI soru gezinmesi gösterilir', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Antrenör', emoji: '🎓',
      sections: [
        {
          id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', emoji: '📘',
          body: 'Konu açıklaması', images: [], parent_id: 202,
          practice_positions: [{ id: 'p1', fen: FEN }],
          board_exercises: [{ type: 'click_square', instruction: 'e4 karesine tıkla', fen: FEN, target_squares: ['e4'] }],
        },
      ],
    });
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(screen.getByText('Konu açıklaması')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sonraki Soru ›'));
    expect(screen.getByText('2 / 2 — Kareye Tıkla 001')).toBeInTheDocument();
  });

  it('madde 2: başlığın solunda ikon/avatar YOKTUR', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Antrenör', emoji: '🎓',
      sections: [{
        id: 203, order_index: 1, title: 'Tahtanın Genel Özellikleri', emoji: '📘',
        body: '', images: [], parent_id: 202, practice_positions: [], board_exercises: [],
      }],
    });
    render(<AltKonuPage />);
    const heading = await waitFor(() => screen.getByText('Tahtanın Genel Özellikleri'));
    expect(heading.textContent).toBe('Tahtanın Genel Özellikleri');
    expect(screen.queryByText('📘')).not.toBeInTheDocument();
  });

  it('bölüm bulunamazsa hata mesajı gösterir', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Antrenör', emoji: '🎓', sections: [],
    });
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Bölüm bulunamadı'));
  });

  it('sekme bulunamazsa hata mesajı gösterir', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Sayfa bulunamadı'));
  });

  it('madde 1: Geri butonu ana sayfaya değil, sekmenin kendi sayfasına (/custom/5) yönlendirir', async () => {
    push.mockClear();
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Antrenör', emoji: '🎓',
      sections: [{
        id: 203, order_index: 1, title: 'Alt Konu', body: '', images: [], parent_id: 202,
        practice_positions: [], board_exercises: [],
      }],
    });
    render(<AltKonuPage />);
    await waitFor(() => screen.getByText('Alt Konu'));
    fireEvent.click(screen.getByText('← Geri'));
    expect(push).toHaveBeenCalledWith('/custom/5');
  });
});

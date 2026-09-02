import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '5' }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: vi.fn() }));
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return '(none)'; }
    destroy() {}
  },
}));
vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Ahmet',
}));
vi.mock('@/lib/avatars', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatars')>('@/lib/avatars');
  return { ...actual, getSavedAvatar: () => 'unicorn' };
});
vi.mock('@/components/play/OpeningPractice', () => ({
  OpeningPractice: () => <div data-testid="opening-practice">açılış pratiği içeriği</div>,
}));

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

  it('etiketi "Pratik Yap" olan sekmede sabit "Açılış Pratiği Yap" satırı görünür ve aynı sayfada açılır', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5, label: 'Pratik Yap', emoji: '🧩',
      // Madde 2026-09-02: "Açılış Pratiği Yap" artık gerçek bir kayıt (diğer
      // 2 sabit alt sekmeyle AYNI order_index mantığı) — fixture'da olmazsa
      // hiç görünmez.
      sections: [{ id: 9, order_index: 0, title: 'Açılış Pratiği Yap', body: '', images: [], practice_positions: [] }],
    });
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Pratik Yap'));
    expect(screen.getByText('Açılış Pratiği Yap').closest('a')).toBeNull();
    fireEvent.click(screen.getByText('Açılış Pratiği Yap'));
    expect(screen.getByTestId('opening-practice')).toBeInTheDocument();
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

  it('Pratik Yap alt sekmesi tıklanınca body/images yerine PositionPoolPractice görünür', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, label: 'Pratik Yap', emoji: '🎯',
      sections: [{
        id: 10, order_index: 1, title: 'Süresiz Pratik', body: 'bu metin görünmemeli', images: [],
        practice_positions: [{ id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }],
      }],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ game_id: 1 }) }));
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Süresiz Pratik'));
    fireEvent.click(screen.getByText('Süresiz Pratik'));

    await waitFor(() => screen.getByText(/Pratiğe Başla/));
    expect(screen.queryByText('bu metin görünmemeli')).not.toBeInTheDocument();
  });

  it('Pratik Yap OLMAYAN sekmede alt sekme hâlâ body/images gösterir (regresyon)', async () => {
    (getCustomTab as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2, label: 'Bulmacalar', emoji: '🧩',
      sections: [{ id: 20, order_index: 1, title: 'Bölüm', body: 'normal metin', images: [], practice_positions: [] }],
    });
    render(<CustomTabViewPage />);
    await waitFor(() => screen.getByText('Bölüm'));
    fireEvent.click(screen.getByText('Bölüm'));
    await waitFor(() => screen.getByText('normal metin'));
  });
});

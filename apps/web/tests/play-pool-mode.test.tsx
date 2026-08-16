import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const search = { value: '' };
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));
vi.mock('@/components/BotGame', () => ({ BotGame: () => <div data-testid="bot-game" /> }));
vi.mock('@/components/play/OfferBoard', () => ({ OfferBoard: () => <div /> }));
vi.mock('@/components/play/OpeningPractice', () => ({ OpeningPractice: () => <div /> }));
vi.mock('@/components/play/PositionPoolPractice', () => ({
  PositionPoolPractice: ({ positions, initialCriteria, title }: {
    positions: { id: string }[]; initialCriteria?: { level: { level: number } }; title?: string;
  }) => (
    <div data-testid="pool-practice"
      data-count={positions.length}
      data-level={initialCriteria ? String(initialCriteria.level.level) : 'yok'}>
      {title}
    </div>
  ),
}));

const getCustomTab = vi.fn();
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: (id: number) => getCustomTab(id) }));

import PlayPage from '@/app/(child)/play/page';

const SECTION = {
  id: 10, order_index: 1, title: 'Süresiz Pratik', body: '', images: [],
  practice_positions: [{ id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }],
};

const OYUNSONU_SECTION = {
  id: 41, order_index: 1, title: 'Oyunsonu Pratiği Yap', body: '', images: [],
  practice_positions: [
    { id: 'a', fen: 'x', category: 'Piyon Finalleri' },
    { id: 'b', fen: 'y', category: 'Kale Finalleri' },
    { id: 'c', fen: 'z', category: 'Kale Finalleri' },
  ],
};

beforeEach(() => {
  getCustomTab.mockReset();
  getCustomTab.mockResolvedValue({ id: 1, label: 'Pratik Yap', emoji: '🎯', sections: [SECTION] });
});

describe('/play — pool modu', () => {
  it('havuzu yükler, kriterleri adresten alır ve pratiği başlatır', async () => {
    search.value = 'mode=pool&tab=1&section=10&skill=2&tc=5%2B0&color=white';
    render(<PlayPage />);
    const el = await screen.findByTestId('pool-practice');
    expect(el).toHaveAttribute('data-count', '1');
    expect(el).toHaveAttribute('data-level', '2');
  });

  it('alt sekme bulunamazsa bilgi mesajı gösterir', async () => {
    search.value = 'mode=pool&tab=1&section=999&skill=2&tc=5%2B0&color=white';
    render(<PlayPage />);
    await waitFor(() => screen.getByText(/Bu bölümde henüz konum yok/));
  });

  it('alt sekme başlığı üst satırda görünür', async () => {
    search.value = 'mode=pool&tab=1&section=10&skill=2&tc=5%2B0&color=white';
    render(<PlayPage />);
    await waitFor(() => screen.getByText(/Süresiz Pratik/));
  });

  it('kategori adreste varsa havuz o kategoriyle sınırlanır', async () => {
    getCustomTab.mockResolvedValue({ id: 1, label: 'Pratik Yap', emoji: '🎯', sections: [OYUNSONU_SECTION] });
    search.value = 'mode=pool&tab=1&section=41&category=Kale+Finalleri&skill=2&tc=5%2B0&color=white';
    render(<PlayPage />);
    const el = await screen.findByTestId('pool-practice');
    // 3 konumdan yalnız Kale Finalleri kategorisindeki 2 tanesi gelmeli.
    expect(el).toHaveAttribute('data-count', '2');
  });

  it('kategori adreste yoksa havuz filtrelenmez (Kazanç Konumunu Pratik Yap gibi)', async () => {
    getCustomTab.mockResolvedValue({ id: 1, label: 'Pratik Yap', emoji: '🎯', sections: [OYUNSONU_SECTION] });
    search.value = 'mode=pool&tab=1&section=41&skill=2&tc=5%2B0&color=white';
    render(<PlayPage />);
    const el = await screen.findByTestId('pool-practice');
    expect(el).toHaveAttribute('data-count', '3');
  });
});

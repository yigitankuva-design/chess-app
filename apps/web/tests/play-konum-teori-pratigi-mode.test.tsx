import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const search = { value: '' };
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));
vi.mock('@/components/BotGame', () => ({ BotGame: () => <div data-testid="bot-game" /> }));
vi.mock('@/components/play/OfferBoard', () => ({ OfferBoard: () => <div /> }));
vi.mock('@/components/play/OpeningPractice', () => ({ OpeningPractice: () => <div /> }));
vi.mock('@/components/play/PositionPoolPractice', () => ({ PositionPoolPractice: () => <div /> }));
vi.mock('@/components/play/KonumPratigiPractice', () => ({
  KonumPratigiPractice: ({ questions }: { questions: { id: string }[] }) => (
    <div data-testid="konum-pratigi" data-count={questions.length} />
  ),
}));
vi.mock('@/components/play/TeoriPratigiPractice', () => ({
  TeoriPratigiPractice: ({ questions }: { questions: { id: string }[] }) => (
    <div data-testid="teori-pratigi" data-count={questions.length} />
  ),
}));

const getCustomTab = vi.fn();
vi.mock('@/lib/customTabsApi', () => ({ getCustomTab: (id: number) => getCustomTab(id) }));

import PlayPage from '@/app/(child)/play/page';

const OPENING_SECTION = {
  id: 20, order_index: 1, title: 'Açılış Pratiği Yap', body: '', images: [],
  section_kind: 'opening',
  konum_pratigi_pool: [{ id: 'q1', instruction: 'x' }],
  teori_pratigi_pool: [{ id: 't1', instruction: 'x' }, { id: 't2', instruction: 'y' }],
};

beforeEach(() => {
  getCustomTab.mockReset();
  getCustomTab.mockResolvedValue({ id: 1, label: 'Pratik Yap', emoji: '📖', sections: [OPENING_SECTION] });
});

describe('/play — konum-pratigi modu', () => {
  it('havuzu yükler ve KonumPratigiPractice\'e geçirir', async () => {
    search.value = 'mode=konum-pratigi&tab=1&section=20';
    render(<PlayPage />);
    const el = await screen.findByTestId('konum-pratigi');
    expect(el).toHaveAttribute('data-count', '1');
  });

  it('alt sekme bulunamazsa boş dizi geçirir', async () => {
    search.value = 'mode=konum-pratigi&tab=1&section=999';
    render(<PlayPage />);
    const el = await screen.findByTestId('konum-pratigi');
    expect(el).toHaveAttribute('data-count', '0');
  });
});

describe('/play — teori-pratigi modu', () => {
  it('havuzu yükler ve TeoriPratigiPractice\'e geçirir', async () => {
    search.value = 'mode=teori-pratigi&tab=1&section=20';
    render(<PlayPage />);
    const el = await screen.findByTestId('teori-pratigi');
    expect(el).toHaveAttribute('data-count', '2');
  });
});

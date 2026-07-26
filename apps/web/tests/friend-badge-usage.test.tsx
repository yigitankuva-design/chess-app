import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const usePresenceCount = vi.fn();
vi.mock('@/lib/presence/PresenceContext', () => ({
  usePresenceCount: () => usePresenceCount(),
  PresenceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));
vi.mock('@/components/BotGame', () => ({ BotGame: () => <div data-testid="bot-game" /> }));
vi.mock('@/components/play/OfferBoard', () => ({
  OfferBoard: () => <div data-testid="offer-board" />,
}));
vi.mock('@/components/play/OpeningPractice', () => ({
  OpeningPractice: () => <div>Bota Karşı Pratik Yap</div>,
}));

import PlayPage from '@/app/(child)/play/page';

beforeEach(() => {
  usePresenceCount.mockReset();
});

describe('/play — Arkadaşla Oyna rozeti', () => {
  it('sayı bilinmiyorken rozet GÖSTERİLMEZ', () => {
    usePresenceCount.mockReturnValue(null);
    render(<PlayPage />);
    expect(screen.queryByLabelText(/aktif sporcu/)).not.toBeInTheDocument();
  });

  it('sayı 0 iken kırmızı rozet gösterilir', () => {
    usePresenceCount.mockReturnValue(0);
    render(<PlayPage />);
    const badge = screen.getByLabelText('0 aktif sporcu');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('data-active')).toBe('false');
  });

  it('sayı > 0 iken yeşil rozet ve doğru sayı gösterilir', () => {
    usePresenceCount.mockReturnValue(21);
    render(<PlayPage />);
    const badge = screen.getByLabelText('21 aktif sporcu');
    expect(badge).toHaveTextContent('21');
    expect(badge.getAttribute('data-active')).toBe('true');
  });

  it('rozet YALNIZCA Arkadaşla Oyna kartındadır', () => {
    usePresenceCount.mockReturnValue(5);
    render(<PlayPage />);
    expect(screen.getAllByLabelText(/aktif sporcu/)).toHaveLength(1);
  });

  it('REGRESYON: dört mod kartı hâlâ listeleniyor', () => {
    usePresenceCount.mockReturnValue(5);
    render(<PlayPage />);
    expect(screen.getByText('Arkadaşla Oyna')).toBeInTheDocument();
    expect(screen.getByText('Bota Karşı Oyna')).toBeInTheDocument();
    expect(screen.getByText('Açılışı Pratiği Yap')).toBeInTheDocument();
    expect(screen.getByText('Turnuvaya Katıl')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));

vi.mock('@/components/BotGame', () => ({
  BotGame: () => <div data-testid="bot-game" />,
}));

// Arkadasla Oyna artik teklif panosunu acar; OfferBoard useLobby -> gercek
// WebSocket'e uzandigi icin mock'lanmali (happy-dom'da WebSocket yok).
vi.mock('@/components/play/OfferBoard', () => ({
  OfferBoard: () => <div data-testid="offer-board" />,
}));

vi.mock('@/components/play/OpeningPractice', () => ({
  OpeningPractice: () => <div>Bota Karşı Pratik Yap</div>,
}));

vi.mock('@/components/play/TournamentPlay', () => ({
  TournamentPlay: () => <div data-testid="tournament-play" />,
}));

import PlayPage from '@/app/(child)/play/page';

describe('/play — 4 sekme (madde a)', () => {
  it('dört maç türü kartı gösterilir', () => {
    render(<PlayPage />);
    expect(screen.getByText('Arkadaşla Oyna')).toBeInTheDocument();
    expect(screen.getByText('Bota Karşı Oyna')).toBeInTheDocument();
    expect(screen.getByText('Açılışı Pratiği Yap')).toBeInTheDocument();
    expect(screen.getByText('Turnuvaya Katıl')).toBeInTheDocument();
  });

  it('Bota Karşı Oyna seçilince kriter ekranı açılır', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rastgele' })).toBeInTheDocument();
  });

  it('Arkadaşla Oyna seçilince teklif panosu açılır', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Arkadaşla Oyna'));
    expect(screen.getByTestId('offer-board')).toBeInTheDocument();
  });

  it('Turnuvaya Katıl seçilince turnuva ekranı açılır', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Turnuvaya Katıl'));
    expect(screen.getByTestId('tournament-play')).toBeInTheDocument();
  });

  it('Açılışı Pratiği Yap seçilince rakip türü sorulur', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Açılışı Pratiği Yap'));
    expect(screen.getByText('Bota Karşı Pratik Yap')).toBeInTheDocument();
  });

  it('Bota Karşı akışında kriterler seçilip başlatılınca oyun render edilir', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 4' }));
    fireEvent.click(screen.getByRole('button', { name: '10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Maça Başla/ }));
    expect(screen.getByTestId('bot-game')).toBeInTheDocument();
  });
});

describe('/play — "Maç Türü" yazısı kaldırıldı (madde 4 ve 8)', () => {
  it('Arkadaşla Oyna içinde "Maç Türü" YAZISI yoktur', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Arkadaşla Oyna'));
    expect(screen.queryByText(/Maç Türü/)).not.toBeInTheDocument();
  });

  it('Açılışı Pratiği Yap içinde "Maç Türü" YAZISI yoktur', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Açılışı Pratiği Yap'));
    expect(screen.queryByText(/Maç Türü/)).not.toBeInTheDocument();
  });

  /** Madde 2 (2026-08-19): Arkadaşla Oyna ekranındaki geri ok kartı
   *  kaldırıldı — bu ekrana artık her zaman ana sayfadan direkt gelinir. */
  it('Arkadaşla Oyna ekranında geri ok kartı YOKTUR', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Arkadaşla Oyna'));
    expect(screen.queryByLabelText('Maç türü seçimine dön')).not.toBeInTheDocument();
  });
});

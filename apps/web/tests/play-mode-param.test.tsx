import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const search = { value: '' };

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));
vi.mock('@/components/BotGame', () => ({ BotGame: () => <div data-testid="bot-game" /> }));
vi.mock('@/components/ChallengeScreen', () => ({
  ChallengeScreen: () => <div data-testid="challenge-screen" />,
}));
// Arkadasla Oyna artik teklif panosunu acar; OfferBoard useLobby -> gercek
// WebSocket'e uzandigi icin mock'lanmali (happy-dom'da WebSocket yok).
vi.mock('@/components/play/OfferBoard', () => ({
  OfferBoard: () => <div data-testid="offer-board" />,
}));
vi.mock('@/components/play/OpeningPractice', () => ({
  OpeningPractice: () => <div data-testid="opening-practice" />,
}));

import PlayPage from '@/app/(child)/play/page';

function renderWith(qs: string) {
  search.value = qs;
  render(<PlayPage />);
}

describe('/play — ?mode= ile doğrudan akış açılır', () => {
  it('mode=friend teklif panosunu açar, kart listesini atlar', () => {
    renderWith('mode=friend');
    expect(screen.getByTestId('offer-board')).toBeInTheDocument();
    expect(screen.queryByText('Maç Türü Seç')).not.toBeInTheDocument();
  });

  it('mode=opening açılış pratiği akışını açar', () => {
    renderWith('mode=opening');
    expect(screen.getByTestId('opening-practice')).toBeInTheDocument();
  });

  it('mode=tournament Yakında ekranını açar', () => {
    renderWith('mode=tournament');
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
  });

  it('mode=bot kriter ekranını açar', () => {
    renderWith('mode=bot');
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
  });

  it('geçersiz mode değeri kart listesine düşer', () => {
    renderWith('mode=uydurma');
    expect(screen.getByText('Maç Türü Seç')).toBeInTheDocument();
  });

  it('mode yoksa kart listesi gösterilir (regresyon)', () => {
    renderWith('');
    expect(screen.getByText('Maç Türü Seç')).toBeInTheDocument();
  });

  it('skill+tc kısayolu mode parametresini ezip bot maçına girer (regresyon)', () => {
    renderWith('skill=0&depth=1&tc=3%2B2&mode=tournament');
    expect(screen.getByTestId('bot-game')).toBeInTheDocument();
  });
});

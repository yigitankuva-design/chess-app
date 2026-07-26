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

vi.mock('@/components/ChallengeScreen', () => ({
  ChallengeScreen: () => <div data-testid="challenge-screen" />,
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

  it('Arkadaşla Oyna seçilince davet ekranı açılır', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Arkadaşla Oyna'));
    expect(screen.getByTestId('challenge-screen')).toBeInTheDocument();
  });

  it('Turnuvaya Katıl seçilince Yakında mesajı gösterilir', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Turnuvaya Katıl'));
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
  });

  it('Açılışı Pratiği Yap seçilince Yakında mesajı gösterilir', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Açılışı Pratiği Yap'));
    expect(screen.getByText(/yakında/i)).toBeInTheDocument();
  });

  it('Bota Karşı akışında kriterler seçilip başlatılınca oyun render edilir', () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByText('Bota Karşı Oyna'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 4' }));
    fireEvent.click(screen.getByRole('button', { name: '10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Oyuna Başla/ }));
    expect(screen.getByTestId('bot-game')).toBeInTheDocument();
  });
});

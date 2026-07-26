import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/BotGame', () => ({
  BotGame: ({ startFen }: { startFen?: string }) => (
    <div data-testid="bot-game" data-start-fen={startFen ?? ''} />
  ),
}));

vi.mock('@/components/ChallengeScreen', () => ({
  ChallengeScreen: () => <div data-testid="challenge-screen" />,
}));

import { OpeningPractice } from '@/components/play/OpeningPractice';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => [{ id: 1, name: 'İtalyan Açılışı', start_fen: FEN }],
  })));
});

describe('OpeningPractice', () => {
  it('önce rakip türü sorulur (Bota Karşı / Arkadaşına Karşı)', () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    expect(screen.getByText('Bota Karşı Pratik Yap')).toBeInTheDocument();
    expect(screen.getByText('Arkadaşına Karşı Pratik Yap')).toBeInTheDocument();
  });

  it('rakip seçilince açılış listesi yüklenir', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
  });

  it('açılış seçilince maç kriterleri sorulur', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
  });

  it('bot dalında maç seçilen açılışın FENiyle başlar', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    const game = screen.getByTestId('bot-game');
    expect(game.getAttribute('data-start-fen')).toBe(FEN);
  });

  it('arkadaş dalında davet ekranı gösterilir', async () => {
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    expect(screen.getByTestId('challenge-screen')).toBeInTheDocument();
  });

  it('açılış listesi boşsa bilgi mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    render(<OpeningPractice onMatched={vi.fn()} />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    await waitFor(() =>
      expect(screen.getByText(/henüz açılış eklemedi/i)).toBeInTheDocument(),
    );
  });
});

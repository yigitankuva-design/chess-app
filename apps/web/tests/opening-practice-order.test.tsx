import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const challenge = vi.fn();

vi.mock('@/lib/lobby/LobbyContext', () => ({
  useLobbyContext: () => ({ players: [{ child_id: 7 }], challenge }),
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

vi.mock('@/components/BotGame', () => ({ BotGame: () => <div data-testid="bot-game" /> }));

const OPENINGS = [
  { id: 1, name: 'İtalyan Açılışı', start_fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1' },
];
const ATHLETES = [{ child_id: 7, display_name: 'Hasan Yiğit' }];

beforeEach(() => {
  challenge.mockClear();
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url).includes('/openings') ? OPENINGS : ATHLETES),
    }),
  ) as unknown as typeof fetch);
});

import { OpeningPractice } from '@/components/play/OpeningPractice';

describe('Açılış Pratiği — arkadaşa karşı sıra (madde 6)', () => {
  it('adımlar 1) Açılış 2) Kriterler 3) Arkadaş sırasındadır', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));

    // StepCard basligi "N. Baslik" olarak tek parca cizilir.
    expect(screen.getByText('1. Açılış Konumunu Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Maç Kriterlerini Belirle')).toBeInTheDocument();
    expect(screen.getByText('3. Arkadaşını Seç')).toBeInTheDocument();
  });

  it('TUZAK: açılış seçilmeden kriter adımı KİLİTLİDİR', () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    const card = screen.getByText('2. Maç Kriterlerini Belirle').closest('button');
    expect(card).toHaveAttribute('aria-disabled', 'true');
  });

  it('seçilen açılışın start_fen değeri teklifle birlikte gider', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));

    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByText('İtalyan Açılışı'));

    fireEvent.click(screen.getByRole('button', { name: '10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Kriterleri Onayla/ }));

    await waitFor(() => screen.getByText('Hasan Yiğit'));
    fireEvent.click(screen.getByText('Hasan Yiğit'));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));

    expect(challenge).toHaveBeenCalledTimes(1);
    expect(challenge.mock.calls[0][1].start_fen).toBe(OPENINGS[0].start_fen);
  });
});

describe('FriendChallenge — açılış adımı VERİLMEZSE çizilmez', () => {
  it('Arkadaşla Oyna akışında açılış adımı yoktur, kriter kilitli değildir', async () => {
    const { FriendChallenge } = await import('@/components/play/FriendChallenge');
    render(<FriendChallenge />);
    expect(screen.queryByText(/Açılış Konumunu Seç/)).not.toBeInTheDocument();
    expect(screen.getByText('1. Maç Kriterlerini Belirle').closest('button'))
      .toHaveAttribute('aria-disabled', 'false');
  });
});

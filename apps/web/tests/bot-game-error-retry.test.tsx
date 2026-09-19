import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
const bestMove = vi.fn();
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove(...args: unknown[]) { return bestMove(...args); }
    async bestMoveCandidates() { return []; }
    destroy() {}
  },
}));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok', getAthleteName: () => 'Ahmet' }));
vi.mock('@/lib/avatars', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatars')>('@/lib/avatars');
  return { ...actual, getSavedAvatar: () => 'unicorn' };
});

import { BotGame } from '@/components/BotGame';

/**
 * Madde 2026-09-19 (bot hamle etmeme hatasi): motor '(none)' donerse
 * (StockfishEngine artik zaman asiminda bunu yapiyor — bkz. stockfish-
 * timeout.test.ts) sporcu sonsuza kadar "Dusunuyor..." ekraninda takili
 * KALMAMALI — hata karti + "Tekrar Dene" gormeli.
 */
describe('BotGame — motor yanıt vermeyince hata kartı ve "Tekrar Dene" (madde 2026-09-19)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    bestMove.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ game_id: 1 }) }));
  });

  it('bot ilk hamlesinde başarısız olursa "Bot yanıt vermedi." gösterir, tahta kilitli kalır', async () => {
    bestMove.mockResolvedValue('(none)');
    // studentColor='b' → bot beyaz, ilk hamleyi bot oynar (madde: ilk hamle efekti).
    render(<BotGame skillLevel={5} depth={5} studentColor="b" onGameEnd={() => {}} />);
    await screen.findByTestId('board');

    await waitFor(() => screen.getByText('Bot yanıt vermedi.'));
    expect(screen.getByText('Tekrar Dene')).toBeInTheDocument();
  });

  it('"Tekrar Dene"ye tıklayınca motor tekrar denenir, başarılı olursa hata kartı kaybolur', async () => {
    bestMove.mockResolvedValueOnce('(none)').mockResolvedValueOnce('e2e4');
    render(<BotGame skillLevel={5} depth={5} studentColor="b" onGameEnd={() => {}} />);
    await screen.findByTestId('board');
    await waitFor(() => screen.getByText('Bot yanıt vermedi.'));

    fireEvent.click(screen.getByText('Tekrar Dene'));

    await waitFor(() => expect(screen.queryByText('Bot yanıt vermedi.')).not.toBeInTheDocument());
    expect(bestMove).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
const bestMoveCandidates = vi.fn().mockResolvedValue(['e2e4', 'd2d4', 'g1f3']);
const bestMove = vi.fn().mockResolvedValue('(none)');
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove(...args: unknown[]) { return bestMove(...args); }
    async bestMoveCandidates(...args: unknown[]) { return bestMoveCandidates(...args); }
    destroy() {}
  },
}));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok', getAthleteName: () => 'Ahmet' }));
vi.mock('@/lib/avatars', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatars')>('@/lib/avatars');
  return { ...actual, getSavedAvatar: () => 'unicorn' };
});
vi.mock('@/lib/play/blunder', () => ({
  shouldBlunder: vi.fn(() => true),
  pickBlunderMove: vi.fn((c: string[]) => c[1]),
}));

import { BotGame } from '@/components/BotGame';

describe('BotGame — blunder mekanizması', () => {
  beforeEach(() => {
    sessionStorage.clear();
    bestMove.mockClear();
    bestMoveCandidates.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ game_id: 1 }) }));
  });

  it('blunderChance > 0 iken bestMoveCandidates çağrılır, bestMove ÇAĞRILMAZ', async () => {
    render(
      <BotGame skillLevel={20} depth={6} studentColor="b" blunderChance={0.6} onGameEnd={() => {}} />,
    );
    await screen.findByTestId('board');
    await waitFor(() => expect(bestMoveCandidates).toHaveBeenCalled());
    expect(bestMove).not.toHaveBeenCalled();
  });

  it('blunderChance verilmezse (0) eski bestMove akışı çalışır', async () => {
    render(<BotGame skillLevel={5} depth={5} studentColor="b" onGameEnd={() => {}} />);
    await screen.findByTestId('board');
    await waitFor(() => expect(bestMove).toHaveBeenCalled());
    expect(bestMoveCandidates).not.toHaveBeenCalled();
  });
});

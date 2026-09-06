import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e7e5'; }
    async analyzeMultiPv() { return [{ scoreCp: 20, mate: null, pvUci: [] }]; }
    destroy() {}
  },
}));

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, onPieceDrop }: { fen: string; onPieceDrop?: (f: string, t: string) => boolean }) => (
    <div data-testid="board" data-fen={fen}>
      <button type="button" onClick={() => onPieceDrop?.('e2', 'e4')}>oyna-e4</button>
    </div>
  ),
}));

vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Ahmet',
}));

const logActivityTime = vi.fn();
vi.mock('@/lib/activity/activityApi', () => ({
  logActivityTime: (...args: unknown[]) => logActivityTime(...args),
}));

import { BotGame } from '@/components/BotGame';

beforeEach(() => {
  sessionStorage.clear();
  logActivityTime.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

describe('BotGame — Sporcu Profili "Bu Hafta" Maç Yap süresi (madde 2026-09-06)', () => {
  it('maç bitince logActivityTime(\'play\', süre) TEK SEFER çağrılır', async () => {
    render(
      <BotGame skillLevel={1} depth={1} studentColor="w" moveLimit={1}
        onGameEnd={vi.fn()} practiceActions={{ onPlaySame: vi.fn(), onPlayDifferent: vi.fn() }} />,
    );
    await screen.findByTestId('board');
    fireEvent.click(screen.getByText('oyna-e4'));

    await waitFor(() => expect(logActivityTime).toHaveBeenCalledTimes(1));
    expect(logActivityTime).toHaveBeenCalledWith('play', expect.any(Number));
  });
});

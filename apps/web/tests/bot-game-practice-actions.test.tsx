import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return '(none)'; }
    destroy() {}
  },
}));
vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Ahmet',
}));
vi.mock('@/lib/avatars', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatars')>('@/lib/avatars');
  return { ...actual, getSavedAvatar: () => 'unicorn' };
});

import { BotGame } from '@/components/BotGame';

describe('BotGame — practiceActions', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 1 }),
    }));
  });

  it('practiceActions verilince Beraberlik Teklif Et yerine Aynı Konumu Pratik Et görünür', async () => {
    const onPlaySame = vi.fn();
    const onPlayDifferent = vi.fn();
    render(
      <BotGame
        skillLevel={1} depth={1} studentColor="w"
        onGameEnd={() => {}}
        practiceActions={{ onPlaySame, onPlayDifferent }}
      />,
    );
    await screen.findByTestId('board');
    await waitFor(() => screen.getByText('Aynı Konumu Pratik Et'));
    expect(screen.queryByText(/Beraberlik Teklif Et/)).not.toBeInTheDocument();
    expect(screen.getByText('Farklı Bir Konumu Pratik Yap')).toBeInTheDocument();
  });

  it('practiceActions verilmezse eski Beraberlik Teklif Et davranışı korunur', async () => {
    render(<BotGame skillLevel={1} depth={1} studentColor="w" onGameEnd={() => {}} />);
    await screen.findByTestId('board');
    await waitFor(() => screen.getByText(/Beraberlik Teklif Et/));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

describe('BotGame — Yeniden Oyna', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 1 }),
    }));
  });

  it('onRematch verilmezse buton görünmez', async () => {
    render(<BotGame skillLevel={5} depth={5} onGameEnd={vi.fn()} />);
    await screen.findByTestId('board');
    expect(screen.queryByRole('button', { name: 'Yeniden Oyna' })).not.toBeInTheDocument();
  });

  it('onRematch verilirse buton görünür ama maç sürerken DEVRE DIŞIDIR', async () => {
    render(<BotGame skillLevel={5} depth={5} onGameEnd={vi.fn()} onRematch={vi.fn()} />);
    await screen.findByTestId('board');
    expect(screen.getByRole('button', { name: 'Yeniden Oyna' })).toBeDisabled();
  });

  it('sporcunun avatarı yerel getSavedAvatar\'dan gelir', async () => {
    render(<BotGame skillLevel={5} depth={5} onGameEnd={vi.fn()} />);
    await screen.findByTestId('board');
    expect(screen.getByText('🦄')).toBeInTheDocument(); // unicorn
    expect(screen.getByText('🤖')).toBeInTheDocument(); // bot
  });
});

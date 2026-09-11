import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-11 (Görsel Turu Aşama B / Madde 11): bot maçında sporcunun
 * kendi adı olarak sunucunun `/games/bot/start` yanıtındaki `player_name`
 * (nickname varsa o) gösterilir — cihazdaki gerçek isim DEĞİL.
 */
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e2e4'; }
    destroy() {}
  },
}));
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
vi.mock('@/lib/auth-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-storage')>();
  return { ...actual, getToken: () => 'tok', getAthleteName: () => 'Mehmet Kaya' };
});

import { BotGame } from '@/components/BotGame';

beforeEach(() => { sessionStorage.clear(); });

describe('BotGame — maçta nickname (madde 2026-09-11 / 11)', () => {
  it('sunucu player_name dönerse alt oyuncu adı o olur', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (
      String(url).includes('/games/bot/start')
        ? { ok: true, json: async () => ({ game_id: 5, player_name: 'Kaya' }) }
        : { ok: false, json: async () => ({}) }
    )));
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Kaya')).toBeInTheDocument());
    expect(screen.queryByText('Mehmet Kaya')).not.toBeInTheDocument();
  });

  it('player_name yoksa (eski sunucu / çevrimdışı) cihazdaki isim kalır', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Mehmet Kaya')).toBeInTheDocument());
  });
});

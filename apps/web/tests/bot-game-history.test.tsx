import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { botGameKey, saveBotGame } from '@/lib/play/botGameSession';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e2e4'; }
    destroy() {}
  },
}));

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, interactive }: { fen: string; interactive?: boolean }) => (
    <div data-testid="board" data-fen={fen} data-interactive={String(!!interactive)} />
  ),
}));

import { BotGame } from '@/components/BotGame';

const board = () => screen.getByTestId('board');

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  // Kayittan 2 hamlelik gecmisle basla: gezinilecek bir sey olsun.
  saveBotGame(botGameKey(0, 'w'), {
    gameId: 7, moves: ['e2e4', 'e7e5'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
  });
});

describe('BotGame — hamle geçmişinde gezinme (madde 1)', () => {
  it('notasyondaki ilk hamleye tıklayınca tahta o konuma döner', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    const e4 = await screen.findByRole('button', { name: 'e4' });
    fireEvent.click(e4);
    await waitFor(() => {
      const fen = board().getAttribute('data-fen') ?? '';
      expect(fen).toContain(' b ');   // e4 sonrasi: sira siyahta
    });
  });

  it('geçmişe bakarken tahta ETKİLEŞİMSİZ olur (taş oynatılamaz)', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    const e4 = await screen.findByRole('button', { name: 'e4' });
    fireEvent.click(e4);
    await waitFor(() => expect(board().getAttribute('data-interactive')).toBe('false'));
  });

  it('Canlıya dön butonu güncel konuma geri getirir', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'e4' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Canlıya dön' }));
    await waitFor(() => {
      expect(board().getAttribute('data-interactive')).toBe('true');
      expect(board().getAttribute('data-fen')).toContain(' w ');
    });
  });

  it('canlıyken uyarı şeridi görünmez', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board()).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Canlıya dön' })).toBeNull();
  });
});

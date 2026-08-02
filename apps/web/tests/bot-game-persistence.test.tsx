import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { botGameKey, saveBotGame, loadBotGame } from '@/lib/play/botGameSession';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e2e4'; }
    destroy() {}
  },
}));

// Gercek react-chessboard happy-dom'da "Square width not found" firlatir
// (P5'te olculdu). Test edilen sey tahta cizimi degil, FEN mantigi.
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));

import { BotGame } from '@/components/BotGame';

const board = () => screen.getByTestId('board');

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

describe('BotGame — sayfa yenilemesi (madde 3)', () => {
  it('kayıtlı oturum varsa tahta o pozisyondan devam eder, sıfırlanmaz', async () => {
    saveBotGame(botGameKey(0, 'w'), {
      gameId: 7, moves: ['e2e4', 'e7e5'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
    });

    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);

    await waitFor(() => {
      const fen = board().getAttribute('data-fen') ?? '';
      // e4 ve e5 oynanmis: baslangic pozisyonu DEGIL, sira beyazda.
      expect(fen.split(' ')[0]).not.toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
      expect(fen).toContain(' w ');
    });
  });

  it('kayıt varken yeni oyun açmak için sunucuya BAŞVURMAZ', async () => {
    saveBotGame(botGameKey(0, 'w'), {
      gameId: 7, moves: ['e2e4', 'e7e5'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
    });
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => ({ ok: false, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);

    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board()).toBeInTheDocument());

    const startCalls = fetchMock.mock.calls
      .filter((c) => String(c[0]).includes('/games/bot/start'));
    expect(startCalls).toHaveLength(0);
  });

  it('kayıt yoksa bugünkü davranış korunur: yeni oyun açılır', async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => ({ ok: false, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);

    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => {
      const startCalls = fetchMock.mock.calls
        .filter((c) => String(c[0]).includes('/games/bot/start'));
      expect(startCalls.length).toBeGreaterThan(0);
    });
  });

  it('BOZUK kayıt ekranı kilitlemez, yeni oyun açılır', async () => {
    sessionStorage.setItem(botGameKey(0, 'w'), 'bu JSON değil');
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => {
      expect(board().getAttribute('data-fen'))
        .toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    });
  });

  it('maç terk edilince kayıt silinir (bitmiş maç geri gelmez)', async () => {
    const key = botGameKey(0, 'w');
    saveBotGame(key, {
      gameId: 7, moves: ['e2e4', 'e7e5'], whiteTime: 0, blackTime: 0, drawOffersUsed: 0,
    });
    vi.stubGlobal('confirm', () => true);

    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    const terk = await screen.findByText('Terk Et');
    terk.click();

    await waitFor(() => expect(loadBotGame(key)).toBeNull());
  });
});

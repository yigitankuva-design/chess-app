import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Stockfish worker happy-dom'da calismaz — motoru taklit ediyoruz.
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e2e4'; }
    destroy() {}
  },
}));

// NEDEN STUB: gercek react-chessboard pozisyon degisince happy-dom'da
// "Square width not found" firlatir (P5'te olculdu). Burada test edilen sey
// tahta cizimi degil, renk/FEN mantigi — prop'lar uzerinden dogruluyoruz.
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, boardOrientation }: { fen: string; boardOrientation?: string }) => (
    <div data-testid="board" data-fen={fen} data-orientation={boardOrientation ?? 'white'} />
  ),
}));

import { BotGame } from '@/components/BotGame';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

const board = () => screen.getByTestId('board');

describe('BotGame — renk desteği', () => {
  it('sporcu beyazsa tahta beyaz yönünde açılır', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board().getAttribute('data-orientation')).toBe('white'));
  });

  it('sporcu siyahsa tahta siyah yönünde açılır', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="b" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board().getAttribute('data-orientation')).toBe('black'));
  });

  it('sporcu beyazsa bot BAŞTA hamle yapmaz (sıra sporcuda)', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    await waitFor(() => expect(board()).toBeInTheDocument());
    // Baslangic pozisyonu degismemis olmali: beyaz oynayacak (" w " iceriyor)
    expect(board().getAttribute('data-fen')).toContain(' w ');
  });

  it('sporcu siyahsa bot ilk hamleyi otomatik oynar (e2e4)', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="b" onGameEnd={vi.fn()} />);
    // Mock motor e2e4 oynar → FEN'de e4'te piyon olur ve sira siyaha gecer.
    await waitFor(
      () => {
        const fen = board().getAttribute('data-fen') ?? '';
        expect(fen).toContain(' b ');          // sira siyahta (sporcuda)
        expect(fen.split(' ')[0]).not.toBe(
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',  // pozisyon degisti
        );
      },
      { timeout: 3000 },
    );
  });

  it('startFen verilirse oyun o pozisyondan başlar', async () => {
    // Beyazin e4 oynadigi, siranin SIYAHTA oldugu pozisyon; sporcu siyah
    // oldugu icin bot hamle yapmaz ve FEN aynen korunur.
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    render(<BotGame skillLevel={0} depth={1} studentColor="b" startFen={fen} onGameEnd={vi.fn()} />);
    await waitFor(() => {
      const shown = board().getAttribute('data-fen') ?? '';
      expect(shown.split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
    });
  });
});

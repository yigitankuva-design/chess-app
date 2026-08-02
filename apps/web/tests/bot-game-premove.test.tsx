import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/** bestMove KONTROLLU bir promise dondurur — boylece test "bot dusunuyor"
 *  penceresinde on-hamle verebilir. Gercek motor senkron cozulmez; anlik
 *  cozulen bir mock bu pencereyi test edilemez hale getirirdi. */
let resolveBestMove: ((uci: string) => void) | null = null;
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    bestMove() {
      return new Promise<string>((resolve) => { resolveBestMove = resolve; });
    }
    destroy() {}
  },
}));

/** Tahta stub'i: ust bilesenin verdigi ON-HAMLE geri cagrisini disari acar,
 *  boylece test rakip dusunurken hamle secebilir. */
let firePremove: ((from: string, to: string) => void) | null = null;
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, onPremove, onPieceDrop }: {
    fen: string;
    onPremove?: (f: string, t: string) => void;
    onPieceDrop?: (f: string, t: string) => boolean;
  }) => {
    firePremove = onPremove ?? null;
    return (
      <div data-testid="board" data-fen={fen}>
        <button type="button" onClick={() => onPieceDrop?.('e2', 'e4')}>oyna-e4</button>
      </div>
    );
  },
}));

import { BotGame } from '@/components/BotGame';

const board = () => screen.getByTestId('board');

beforeEach(() => {
  sessionStorage.clear();
  firePremove = null;
  resolveBestMove = null;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

describe('BotGame — ön-hamle (madde 5)', () => {
  it('bot düşünürken verilen ön-hamle, sıra gelince kendiliğinden oynanır', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    // Sporcu e4 oynar → bot dusunmeye baslar (bestMove promise ASKIDA kalir).
    (await screen.findByText('oyna-e4')).click();
    await waitFor(() => expect(resolveBestMove).not.toBeNull());
    // Bot hala dusunurken sporcu on-hamle verir: Af3.
    firePremove!('g1', 'f3');
    // Bot e5 oynayinca sira sporcuya gelir ve Af3 KENDILIGINDEN oynanir.
    resolveBestMove!('e7e5');
    await waitFor(() => {
      const fen = board().getAttribute('data-fen') ?? '';
      expect(fen).toContain('5N2');   // at f3'te
    }, { timeout: 3000 });
  });

  it('GEÇERSİZ ön-hamle sessizce iptal edilir, oyun devam eder', async () => {
    render(<BotGame skillLevel={0} depth={1} studentColor="w" onGameEnd={vi.fn()} />);
    (await screen.findByText('oyna-e4')).click();
    await waitFor(() => expect(resolveBestMove).not.toBeNull());
    firePremove!('a1', 'a8');   // kural disi
    resolveBestMove!('e7e5');
    await waitFor(() => {
      const fen = board().getAttribute('data-fen') ?? '';
      expect(fen).toContain(' w ');    // sira sporcuda, oyun kilitlenmedi
      expect(fen).not.toContain('R7');  // kale a8'e GITMEDI
    }, { timeout: 3000 });
  });
});

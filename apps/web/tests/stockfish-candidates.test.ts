import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StockfishEngine } from '@/lib/chess/stockfish';

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(cmd: string) {
    if (cmd === 'uci' || cmd === 'isready') return;
    if (cmd.startsWith('go depth')) {
      const lines = [
        'info depth 8 multipv 1 score cp 40 pv e2e4 e7e5',
        'info depth 8 multipv 2 score cp 20 pv d2d4 d7d5',
        'info depth 8 multipv 3 score cp -10 pv g1f3 g8f6',
        'bestmove e2e4',
      ];
      for (const line of lines) this.onmessage?.({ data: line } as MessageEvent);
    }
  }
  terminate() {}
}

beforeEach(() => {
  vi.stubGlobal('Worker', FakeWorker);
});

describe('StockfishEngine.bestMoveCandidates', () => {
  it('multipv sırasına göre aday hamle listesi döner', async () => {
    const eng = new StockfishEngine();
    await eng.init();
    const candidates = await eng.bestMoveCandidates('startpos', 8, 3);
    expect(candidates).toEqual(['e2e4', 'd2d4', 'g1f3']);
  });
});

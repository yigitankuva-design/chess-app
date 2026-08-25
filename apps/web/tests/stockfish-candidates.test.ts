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

/** "Konumu Analiz Et" (madde: 2026-08-22) — mat skoru veren sahte motor. */
class FakeMateWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(cmd: string) {
    if (cmd === 'uci' || cmd === 'isready') return;
    if (cmd.startsWith('go depth')) {
      const lines = [
        'info depth 20 score mate 2 pv f7f8q',
        'bestmove f7f8q',
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

describe('StockfishEngine.analyze (madde: 2026-08-22, "Konumu Analiz Et")', () => {
  it('cp skorunu ve en iyi hamleyi doğru parse eder', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const eng = new StockfishEngine();
    await eng.init();
    const result = await eng.analyze('startpos', 20);
    expect(result).toEqual({ bestMove: 'e2e4', scoreCp: -10, mate: null });
  });

  it('mat skorunu doğru parse eder (cp ile karışmaz)', async () => {
    vi.stubGlobal('Worker', FakeMateWorker);
    const eng = new StockfishEngine();
    await eng.init();
    const result = await eng.analyze('startpos', 20);
    expect(result).toEqual({ bestMove: 'f7f8q', scoreCp: null, mate: 2 });
  });
});

describe('StockfishEngine.analyzeMultiPv (Analiz Et sekmesi)', () => {
  it('her aday hamle için puan VE tam devam dizisi (pv) döner, multipv sırasına göre', async () => {
    const eng = new StockfishEngine();
    await eng.init();
    const result = await eng.analyzeMultiPv('startpos', 8, 3);
    expect(result).toEqual([
      { moveUci: 'e2e4', scoreCp: 40, mate: null, pvUci: ['e2e4', 'e7e5'] },
      { moveUci: 'd2d4', scoreCp: 20, mate: null, pvUci: ['d2d4', 'd7d5'] },
      { moveUci: 'g1f3', scoreCp: -10, mate: null, pvUci: ['g1f3', 'g8f6'] },
    ]);
  });

  it('mat skorunu satır bazında doğru parse eder', async () => {
    vi.stubGlobal('Worker', FakeMateWorker);
    const eng = new StockfishEngine();
    await eng.init();
    const result = await eng.analyzeMultiPv('startpos', 20, 1);
    expect(result).toEqual([{ moveUci: 'f7f8q', scoreCp: null, mate: 2, pvUci: ['f7f8q'] }]);
  });

  it('madde 2026-08-31 (1): motora derinlik İLE BİRLİKTE bir süre sınırı (movetime) da gönderilir', async () => {
    const sent: string[] = [];
    class SpyWorker extends FakeWorker {
      postMessage(cmd: string) { sent.push(cmd); super.postMessage(cmd); }
    }
    vi.stubGlobal('Worker', SpyWorker);
    const eng = new StockfishEngine();
    await eng.init();
    await eng.analyzeMultiPv('startpos', 14, 3, 700);
    expect(sent).toContain('go depth 14 movetime 700');
  });

  it('movetime verilmezse varsayılan (700ms) kullanılır', async () => {
    const sent: string[] = [];
    class SpyWorker extends FakeWorker {
      postMessage(cmd: string) { sent.push(cmd); super.postMessage(cmd); }
    }
    vi.stubGlobal('Worker', SpyWorker);
    const eng = new StockfishEngine();
    await eng.init();
    await eng.analyzeMultiPv('startpos', 14, 3);
    expect(sent).toContain('go depth 14 movetime 700');
  });
});

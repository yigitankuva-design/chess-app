import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StockfishEngine } from '@/lib/chess/stockfish';

/** Madde 2026-09-19 (bot hamle etmeme hatasi): motor hicbir zaman
 *  'bestmove' yollamayan bir worker'i simule eder — gercek dunyada
 *  worker cokmesi/WASM yuklenememesi durumunda olan budur. */
class HangingWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(_cmd: string) { /* hicbir zaman yanit vermez */ }
  terminate() {}
}

class CrashingWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(cmd: string) {
    if (cmd.startsWith('go depth')) {
      queueMicrotask(() => this.onerror?.());
    }
  }
  terminate() {}
}

describe('StockfishEngine — zaman aşımı güvencesi (madde 2026-09-19)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('bestMove: motor hiç yanıt vermezse timeoutMs sonunda "(none)" ile çözülür (sonsuza kadar beklemez)', async () => {
    vi.stubGlobal('Worker', HangingWorker);
    const eng = new StockfishEngine();
    await eng.init();

    const promise = eng.bestMove('startpos', 8, 5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    const mv = await promise;

    expect(mv).toBe('(none)');
    vi.unstubAllGlobals();
  });

  it('bestMoveCandidates: motor hiç yanıt vermezse timeoutMs sonunda boş dizi döner', async () => {
    vi.stubGlobal('Worker', HangingWorker);
    const eng = new StockfishEngine();
    await eng.init();

    const promise = eng.bestMoveCandidates('startpos', 8, 4, 5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    const candidates = await promise;

    expect(candidates).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('worker çökerse (onerror) bestMove timeout beklemeden "(none)" ile çözülür', async () => {
    vi.stubGlobal('Worker', CrashingWorker);
    const eng = new StockfishEngine();
    await eng.init();

    const mv = await eng.bestMove('startpos', 8, 15_000);
    expect(mv).toBe('(none)');
    vi.unstubAllGlobals();
  });

  it('analyze: motor hiç yanıt vermezse watchdogTimeoutMs sonunda null sonuçla çözülür (İpucu/Beraberlik butonları sonsuza kadar kilitlenmez)', async () => {
    vi.stubGlobal('Worker', HangingWorker);
    const eng = new StockfishEngine();
    await eng.init();

    const promise = eng.analyze('startpos', 20, undefined, 5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await promise;

    expect(result).toEqual({ bestMove: null, scoreCp: null, mate: null });
    vi.unstubAllGlobals();
  });
});

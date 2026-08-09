type Listener = (line: string) => void;

export class StockfishEngine {
  private worker: Worker | null = null;
  private listeners: Listener[] = [];

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    this.worker = new Worker('/stockfish/stockfish.js');
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : (e.data?.data ?? '');
      this.listeners.forEach((l) => l(line));
    };
    this.send('uci');
    this.send('isready');
  }

  send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  on(listener: Listener): void {
    this.listeners.push(listener);
  }

  setSkill(level: number): void {
    const clamped = Math.max(0, Math.min(20, level));
    this.send(`setoption name Skill Level value ${clamped}`);
  }

  /** Resolve best move (UCI) for a FEN. depth kept low for kid-friendly speed. */
  async bestMove(fen: string, depth = 8): Promise<string> {
    return new Promise((resolve) => {
      const listener = (line: string) => {
        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const mv = parts[1];
          this.listeners = this.listeners.filter((l) => l !== listener);
          resolve(mv);
        }
      };
      this.listeners.push(listener);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  /**
   * Stockfish'in MultiPV özelliğiyle birden fazla aday hamle ister.
   * Dönen dizi güç sırasına göredir (0. indeks = en iyi hamle).
   * Kasıtlı hata (blunder) mekanizması için kullanılır — bkz. lib/play/blunder.ts.
   */
  async bestMoveCandidates(fen: string, depth = 8, multiPv = 4): Promise<string[]> {
    return new Promise((resolve) => {
      const candidates = new Map<number, string>();
      const listener = (line: string) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          const mpvMatch = line.match(/multipv (\d+)/);
          const pvMatch = line.match(/ pv (\S+)/);
          if (mpvMatch && pvMatch) {
            candidates.set(Number(mpvMatch[1]), pvMatch[1]);
          }
        } else if (line.startsWith('bestmove')) {
          this.listeners = this.listeners.filter((l) => l !== listener);
          this.send('setoption name MultiPV value 1');
          const ordered = Array.from(candidates.keys())
            .sort((a, b) => a - b)
            .map((k) => candidates.get(k)!);
          if (ordered.length > 0) {
            resolve(ordered);
          } else {
            const mv = line.split(' ')[1];
            resolve(mv && mv !== '(none)' ? [mv] : []);
          }
        }
      };
      this.listeners.push(listener);
      this.send(`setoption name MultiPV value ${multiPv}`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  destroy(): void {
    try { this.worker?.terminate(); } catch { /* ignore */ }
    this.worker = null;
    this.listeners = [];
  }
}

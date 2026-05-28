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

  destroy(): void {
    try { this.worker?.terminate(); } catch { /* ignore */ }
    this.worker = null;
    this.listeners = [];
  }
}

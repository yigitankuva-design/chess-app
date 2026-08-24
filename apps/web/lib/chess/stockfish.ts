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

  /**
   * Admin'in dizdiği bir konumu tam güçte inceler (madde: 2026-08-22 —
   * "Konumu Analiz Et"). `bestMove`den farkı: skill kısıtlaması UYGULANMAZ
   * (çağıran taraf setSkill(20) ile en güçlü seviyeyi ayarlamalı) ve
   * değerlendirme puanı (cp/mat) da döner — sadece hamle değil.
   */
  async analyze(fen: string, depth = 20): Promise<{ bestMove: string | null; scoreCp: number | null; mate: number | null }> {
    return new Promise((resolve) => {
      let scoreCp: number | null = null;
      let mate: number | null = null;
      const listener = (line: string) => {
        if (line.startsWith('info') && line.includes(' score ')) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (mateMatch) { mate = Number(mateMatch[1]); scoreCp = null; }
          else if (cpMatch) { scoreCp = Number(cpMatch[1]); mate = null; }
        } else if (line.startsWith('bestmove')) {
          this.listeners = this.listeners.filter((l) => l !== listener);
          const mv = line.split(' ')[1];
          resolve({ bestMove: mv && mv !== '(none)' ? mv : null, scoreCp, mate });
        }
      };
      this.listeners.push(listener);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  /**
   * Analiz Et sekmesi — "Son Maçlarımı İncele" / "Kendi Konumumu Analiz Et" için:
   * MultiPV ile birden fazla aday hamleyi, HER BİRİNİN puanı (cp/mat) ve tam devam
   * dizisiyle (pv) birlikte döner. `bestMoveCandidates`'ten farkı: sadece ilk hamle
   * değil, puan + tüm devam hamleleri de gelir (görsel referans: lichess/chess.com
   * tarzı 3 satırlı analiz paneli). Sonuç multipv indeksine göre sıralıdır
   * (0. indeks = en iyi hamle).
   */
  async analyzeMultiPv(
    fen: string, depth = 20, multiPv = 3,
  ): Promise<{ moveUci: string; scoreCp: number | null; mate: number | null; pvUci: string[] }[]> {
    return new Promise((resolve) => {
      const candidates = new Map<number, { scoreCp: number | null; mate: number | null; pvUci: string[] }>();
      const listener = (line: string) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          const pvMatch = line.match(/ pv (.+)$/);
          if (!pvMatch) return;
          // "multipv" alanı MultiPV=1 iken motor tarafından hiç YAZILMAYABİLİR
          // (gerçek Stockfish'te de bazı sürümlerde olur) — yoksa 1. sıra kabul edilir.
          const mpvMatch = line.match(/multipv (\d+)/);
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          candidates.set(mpvMatch ? Number(mpvMatch[1]) : 1, {
            scoreCp: mateMatch ? null : (cpMatch ? Number(cpMatch[1]) : null),
            mate: mateMatch ? Number(mateMatch[1]) : null,
            pvUci: pvMatch[1].trim().split(' '),
          });
        } else if (line.startsWith('bestmove')) {
          this.listeners = this.listeners.filter((l) => l !== listener);
          this.send('setoption name MultiPV value 1');
          const ordered = Array.from(candidates.keys())
            .sort((a, b) => a - b)
            .map((k) => {
              const c = candidates.get(k)!;
              return { moveUci: c.pvUci[0], scoreCp: c.scoreCp, mate: c.mate, pvUci: c.pvUci };
            });
          resolve(ordered);
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

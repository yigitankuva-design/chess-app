'use client';
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { StockfishEngine } from '@/lib/chess/stockfish';

interface Props {
  /** Analiz edilecek konumun tam FEN'i (sıra dahil). */
  fen: string;
}

type Result =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'done'; sanMove: string | null; evalText: string; sideToMove: 'w' | 'b' };

/**
 * "Konumu Analiz Et" (madde: 2026-08-22) — Zafer Hoca'nın Kazanç Konumunu
 * Pratik Yap'ta dizdiği konumu kaydetmeden önce analiz motoruna gösterip
 * hatasız olduğundan (geçerli pozisyon, mantıklı bir değerlendirme) emin
 * olması için. Motor EN YÜKSEK güç seviyesinde çalışır (Skill Level 20,
 * derinlik 20) — sporcuya karşı oynayan zayıflatılmış motordan FARKLI,
 * burada "en iyi sonuç" isteniyor.
 */
export function PositionAnalysisPanel({ fen }: Props) {
  const engineRef = useRef<StockfishEngine | null>(null);
  const [result, setResult] = useState<Result>({ status: 'idle' });

  useEffect(() => () => { engineRef.current?.destroy(); }, []);

  async function analyze() {
    setResult({ status: 'loading' });
    let board: Chess;
    try {
      board = new Chess(fen);
    } catch {
      setResult({ status: 'invalid' });
      return;
    }

    if (!engineRef.current) {
      const eng = new StockfishEngine();
      await eng.init();
      engineRef.current = eng;
    }
    const engine = engineRef.current;
    engine.setSkill(20); // madde 2026-08-22: en yüksek güç seviyesi
    const { bestMove, scoreCp, mate } = await engine.analyze(fen, 20);

    let sanMove: string | null = null;
    if (bestMove && bestMove.length >= 4) {
      try {
        const mv = board.move({
          from: bestMove.slice(0, 2),
          to: bestMove.slice(2, 4),
          promotion: bestMove.length > 4 ? bestMove[4] : undefined,
        });
        sanMove = mv?.san ?? null;
      } catch {
        sanMove = null;
      }
    }

    const sideToMove: 'w' | 'b' = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    let evalText: string;
    if (mate !== null) {
      // Skor sıradaki tarafın açısından gelir — mate>0 ise sıradaki taraf mat ediyor.
      const winner = mate > 0 ? sideToMove : (sideToMove === 'w' ? 'b' : 'w');
      evalText = `${winner === 'w' ? 'Beyaz' : 'Siyah'} ${Math.abs(mate)} hamlede mat veriyor.`;
    } else if (scoreCp !== null) {
      const forWhite = sideToMove === 'w' ? scoreCp : -scoreCp;
      const sign = forWhite > 0 ? '+' : '';
      evalText = `Değerlendirme (Beyaz açısından): ${sign}${(forWhite / 100).toFixed(2)}`;
    } else {
      evalText = 'Değerlendirme alınamadı.';
    }

    setResult({ status: 'done', sanMove, evalText, sideToMove });
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/10 p-3">
      <button
        type="button"
        onClick={analyze}
        disabled={result.status === 'loading'}
        className="px-4 py-2 rounded-lg bg-violet-400/15 text-violet-200 border border-violet-400/50 hover:bg-violet-400/25 disabled:opacity-40 text-sm transition-colors"
      >
        {result.status === 'loading' ? 'Analiz ediliyor…' : '🔍 Konumu Analiz Et'}
      </button>

      {result.status === 'invalid' && (
        <p className="text-sm text-rose-300">
          Bu pozisyon geçersiz (örn. şah eksik/fazla) — motora gönderilemedi.
        </p>
      )}

      {result.status === 'done' && (
        <div className="text-sm n-text space-y-1">
          <p>{result.evalText}</p>
          {result.sanMove ? (
            <p className="n-muted text-xs">
              {result.sideToMove === 'w' ? 'Beyazın' : 'Siyahın'} en iyi hamlesi: <b>{result.sanMove}</b>
            </p>
          ) : (
            <p className="n-muted text-xs">Motor bir hamle önerisi bulamadı (mat/pat olabilir).</p>
          )}
        </div>
      )}
    </div>
  );
}

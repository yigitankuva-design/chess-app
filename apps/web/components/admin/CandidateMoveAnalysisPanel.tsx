'use client';
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { StockfishEngine } from '@/lib/chess/stockfish';
import { pvUciToSan, scoreForWhite } from '@/lib/chess/analysisFormat';

export interface CandidateMoveResult {
  moveUci: string;
  moveSan: string;
  scoreCp: number | null;
  mate: number | null;
}

interface Props {
  /** Analiz edilecek konumun tam FEN'i (sıra dahil). */
  fen: string;
  /** Analiz başarıyla bitince (en az 1 aday hamle bulununca) çağrılır —
   *  parent bu listeyi "Kaydet"e kadar tutar. */
  onAnalyzed: (candidates: CandidateMoveResult[]) => void;
}

type Result =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'done'; candidates: CandidateMoveResult[] };

/**
 * "Konumu Analiz Et" (Aday Hamle Pratiği, madde 2026-09-15) —
 * PositionAnalysisPanel'in TEK-hamle akışının aynısı, ama `analyzeMultiPv`
 * ile en güçlü 3 aday hamleyi sıralı bulur. Sonuç `onAnalyzed` ile yukarı
 * bildirilir; admin "Kaydet"e basınca bu 3 hamle pozisyona ait KALICI cevap
 * anahtarı olur — sporcu pratik yaparken motor BİR DAHA ÇALIŞMAZ, kayıtlı
 * listeyle hızlı karşılaştırma yapılır (o kısım ayrı bir round'da kurulur).
 * Motor EN YÜKSEK güç seviyesinde çalışır (Skill 20, derinlik 20, 5sn
 * sınırı) — PositionAnalysisPanel ile AYNI bütçe: bu tek seferlik bir admin
 * işlemi, hız değil doğruluk önceliklidir.
 */
export function CandidateMoveAnalysisPanel({ fen, onAnalyzed }: Props) {
  const engineRef = useRef<StockfishEngine | null>(null);
  const [result, setResult] = useState<Result>({ status: 'idle' });

  useEffect(() => () => { engineRef.current?.destroy(); }, []);

  // Pozisyon değiştiğinde önceki analiz geçersiz sayılır — böylece admin
  // konumu dizdikten SONRA değiştirirse, eski cevap anahtarı yeni pozisyona
  // yanlışlıkla kaydedilemez (Kaydet, yeniden "Analiz Et" istemeden açılmaz).
  useEffect(() => {
    setResult({ status: 'idle' });
  }, [fen]);

  async function analyze() {
    setResult({ status: 'loading' });
    try {
      new Chess(fen);
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
    engine.setSkill(20); // en yüksek güç seviyesi (PositionAnalysisPanel ile aynı)
    const raw = await engine.analyzeMultiPv(fen, 20, 3, 5000);

    const sideToMove: 'w' | 'b' = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    const candidates: CandidateMoveResult[] = raw
      .filter((c) => c.moveUci && c.moveUci.length >= 4)
      .map((c) => {
        const [san] = pvUciToSan(fen, [c.moveUci]);
        const white = scoreForWhite(c.scoreCp, c.mate, sideToMove);
        return { moveUci: c.moveUci, moveSan: san ?? c.moveUci, scoreCp: white.cp, mate: white.mate };
      });

    setResult({ status: 'done', candidates });
    if (candidates.length > 0) onAnalyzed(candidates);
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

      {result.status === 'done' && result.candidates.length === 0 && (
        <p className="n-muted text-xs">Motor bir hamle önerisi bulamadı (mat/pat olabilir).</p>
      )}

      {result.status === 'done' && result.candidates.length > 0 && (
        <div className="space-y-1 text-sm n-text">
          {result.candidates.map((c, i) => (
            <div key={c.moveUci} className="flex items-center gap-2">
              <span className="font-mono font-bold n-muted" style={{ minWidth: 18 }}>{i + 1}.</span>
              <b>{c.moveSan}</b>
              <span className="n-muted text-xs">
                {c.mate !== null
                  ? `#${c.mate > 0 ? '' : '-'}${Math.abs(c.mate)}`
                  : c.scoreCp !== null
                    ? `${c.scoreCp > 0 ? '+' : ''}${(c.scoreCp / 100).toFixed(2)}`
                    : '–'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

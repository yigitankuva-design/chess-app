'use client';
import { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { AnalysisBoard } from './AnalysisBoard';
import { NotationCard } from './NotationCard';
import { useMoveQualityEval } from '@/lib/chess/useMoveQualityEval';
import { applyMove, currentFen, stepView } from '@/lib/chess/variantMoves';
import type { PlayedMove, ActiveVariant } from '@/lib/chess/variantMoves';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * "Yeni Analiz" sayfası — madde 2026-09-02 (2): kayıtlı bir maça değil,
 * sıfırdan (başlangıç pozisyonu, ilk hamle) bir analize başlar. Sporcu
 * tahtada HER İKİ tarafı da kendisi oynatır (serbest keşif); her hamleden
 * sonra AnalysisBoard'un otomatik yeniden analiz mekanizması (fen prop'u
 * değiştikçe) devreye girer. Terfi HER ZAMAN vezire yapılır (basitlik için —
 * bir taş seçim penceresi bu ekranın kapsamı dışında).
 *
 * Madde 2026-09-05 (2): `history` (oynanan TÜM hamleler) ile `viewIndex`
 * (0..history.length, o an gösterilen konum) AYRI tutulur.
 *
 * Madde 2026-09-06 (7): ana hatta geri gidip FARKLI bir hamle denenirse artık
 * SONRASI SİLİNMEZ — o ply'a tek seviyeli bir varyant olarak eklenir (bkz.
 * lib/chess/variantMoves.ts). Aynı hamlenin tekrar oynanması dallanma
 * yaratmaz, sadece ilerler.
 */
export function FreePlayAnalysis() {
  const [history, setHistory] = useState<PlayedMove[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [activeVariant, setActiveVariant] = useState<ActiveVariant | null>(null);
  const [hideNotation, setHideNotation] = useState(false);
  const fen = currentFen(START_FEN, history, viewIndex, activeVariant);
  /** Madde 2026-09-05 (3): hamle kalitesi işaretleri — SADECE ana hat
   *  üzerinden hesaplanır (varyant hamleleri kapsam dışı). */
  const { evalByPly, progress } = useMoveQualityEval(START_FEN, history);

  function handlePieceDrop(from: Square, to: Square): boolean {
    try {
      const board = new Chess(fen);
      const mv = board.move({ from, to, promotion: 'q' });
      if (!mv) return false;
      const r = applyMove(history, viewIndex, activeVariant, { san: mv.san, fenAfter: board.fen() });
      setHistory(r.history);
      setViewIndex(r.viewIndex);
      setActiveVariant(r.activeVariant);
      return true;
    } catch {
      return false;
    }
  }

  /** Madde 2026-09-05 (2): fare tekerleğiyle oynanan hamleler ileri/geri alınır. */
  function handleWheelStep(delta: 1 | -1) {
    const r = stepView(history, viewIndex, activeVariant, delta);
    setViewIndex(r.viewIndex);
    setActiveVariant(r.activeVariant);
  }

  /** Madde 2026-09-05 (3): "Bu Hamleden Sonrasını Sil" — SADECE ana hatta uygulanır. */
  function handleDeleteAfter(afterPly: number) {
    setHistory((prev) => prev.filter((m) => m.ply <= afterPly));
    setViewIndex((v) => Math.min(v, afterPly));
    setActiveVariant(null);
  }

  function selectMainPly(ply: number) {
    setViewIndex(ply);
    setActiveVariant(null);
  }

  function selectVariantPly(atPly: number, index: number) {
    setActiveVariant({ atPly, index });
  }

  return (
    <div className="space-y-3">
      <AnalysisBoard fen={fen} interactive onPieceDrop={handlePieceDrop}
        onWheelStep={handleWheelStep} hideNotation={hideNotation} />
      <NotationCard
        moves={history} currentPly={viewIndex}
        onSelectPly={selectMainPly}
        hideNotation={hideNotation} onToggleHideNotation={() => setHideNotation((v) => !v)}
        onDeleteAfter={handleDeleteAfter}
        evalByPly={evalByPly} evalProgress={progress}
        activeVariant={activeVariant} onSelectVariantPly={selectVariantPly}
      />
    </div>
  );
}

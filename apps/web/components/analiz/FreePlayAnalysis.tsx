'use client';
import { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { AnalysisBoard } from './AnalysisBoard';
import { NotationCard } from './NotationCard';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface PlayedMove {
  ply: number;
  san: string;
  fenAfter: string;
}

/**
 * "Yeni Analiz" sayfası — madde 2026-09-02 (2): kayıtlı bir maça değil,
 * sıfırdan (başlangıç pozisyonu, ilk hamle) bir analize başlar. Sporcu
 * tahtada HER İKİ tarafı da kendisi oynatır (serbest keşif); her hamleden
 * sonra AnalysisBoard'un otomatik yeniden analiz mekanizması (fen prop'u
 * değiştikçe) devreye girer. Terfi HER ZAMAN vezire yapılır (basitlik için —
 * bir taş seçim penceresi bu ekranın kapsamı dışında).
 *
 * Madde 2026-09-05 (2): `history` (oynanan TÜM hamleler) ile `viewIndex`
 * (0..history.length, o an gösterilen konum) AYRI tutulur — fare tekerleği
 * `viewIndex`'i değiştirir (geri/ileri alma), tahtaya YENİ bir hamle
 * oynanınca `viewIndex`'ten SONRAKİ hamleler budanır (standart geri-al/
 * tekrarla/dallan davranışı).
 */
export function FreePlayAnalysis() {
  const [history, setHistory] = useState<PlayedMove[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [hideNotation, setHideNotation] = useState(false);
  const fen = viewIndex > 0 ? history[viewIndex - 1].fenAfter : START_FEN;

  function handlePieceDrop(from: Square, to: Square): boolean {
    try {
      const board = new Chess(fen);
      const mv = board.move({ from, to, promotion: 'q' });
      if (!mv) return false;
      setHistory((prev) => {
        const kept = prev.slice(0, viewIndex);
        return [...kept, { ply: kept.length + 1, san: mv.san, fenAfter: board.fen() }];
      });
      setViewIndex((v) => v + 1);
      return true;
    } catch {
      return false;
    }
  }

  /** Madde 2026-09-05 (2): fare tekerleğiyle oynanan hamleler ileri/geri alınır. */
  function handleWheelStep(delta: 1 | -1) {
    setViewIndex((v) => Math.max(0, Math.min(history.length, v + delta)));
  }

  /** Madde 2026-09-05 (3): "Bu Hamleden Sonrasını Sil". */
  function handleDeleteAfter(afterPly: number) {
    setHistory((prev) => prev.filter((m) => m.ply <= afterPly));
    setViewIndex((v) => Math.min(v, afterPly));
  }

  return (
    <div className="space-y-3">
      <AnalysisBoard fen={fen} interactive onPieceDrop={handlePieceDrop}
        onWheelStep={handleWheelStep} hideNotation={hideNotation} />
      <NotationCard
        moves={history} currentPly={viewIndex}
        onSelectPly={setViewIndex}
        hideNotation={hideNotation} onToggleHideNotation={() => setHideNotation((v) => !v)}
        onDeleteAfter={handleDeleteAfter}
      />
    </div>
  );
}

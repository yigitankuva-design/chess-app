'use client';
import { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { AnalysisBoard } from './AnalysisBoard';
import { MoveNotationGrid } from './MoveNotationGrid';

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
 * Madde 2026-09-03 (1): aday hamlelerin altına, o ana kadar oynanan
 * hamlelerin notasyonu da eklendi (MoveNotationGrid — Maçlarımın Analizi'yle
 * AYNI 3'lü grid görünümü).
 */
export function FreePlayAnalysis() {
  const [moves, setMoves] = useState<PlayedMove[]>([]);
  const fen = moves.length > 0 ? moves[moves.length - 1].fenAfter : START_FEN;

  function handlePieceDrop(from: Square, to: Square): boolean {
    try {
      const board = new Chess(fen);
      const mv = board.move({ from, to, promotion: 'q' });
      if (!mv) return false;
      setMoves((prev) => [...prev, { ply: prev.length + 1, san: mv.san, fenAfter: board.fen() }]);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div className="space-y-3">
      <AnalysisBoard fen={fen} interactive onPieceDrop={handlePieceDrop} />
      <MoveNotationGrid moves={moves} />
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { AnalysisBoard } from './AnalysisBoard';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * "Yeni Analiz" sayfası — madde 2026-09-02 (2): kayıtlı bir maça değil,
 * sıfırdan (başlangıç pozisyonu, ilk hamle) bir analize başlar. Sporcu
 * tahtada HER İKİ tarafı da kendisi oynatır (serbest keşif); her hamleden
 * sonra AnalysisBoard'un otomatik yeniden analiz mekanizması (fen prop'u
 * değiştikçe) devreye girer. Terfi HER ZAMAN vezire yapılır (basitlik için —
 * bir taş seçim penceresi bu ekranın kapsamı dışında).
 */
export function FreePlayAnalysis() {
  const [fen, setFen] = useState(START_FEN);

  function handlePieceDrop(from: Square, to: Square): boolean {
    try {
      const board = new Chess(fen);
      const mv = board.move({ from, to, promotion: 'q' });
      if (!mv) return false;
      setFen(board.fen());
      return true;
    } catch {
      return false;
    }
  }

  return <AnalysisBoard fen={fen} interactive onPieceDrop={handlePieceDrop} />;
}

'use client';
import { useState } from 'react';
import { Chess } from 'chess.js';

interface Props {
  /** PGN üretimi için oynanan TÜM SAN hamleleri (sırayla, maçın tamamı —
   *  o an tahtada görüntülenen pozisyondan BAĞIMSIZ). */
  sanMoves: string[];
  /** O an tahtada gösterilen pozisyonun FEN'i — hamle hamle gezinince değişir. */
  currentFen: string;
  /** Maçın başladığı konum standart DEĞİLSE (açılış pratiği vb.) — PGN
   *  başlığına doğru başlangıç yazılsın diye. */
  startFen?: string | null;
}

/**
 * Madde 2026-09-14 (3d): notasyonun ALTINDA görünür "PGN Kopyala"/"FEN
 * Kopyala" bloğu — Zafer'in isteği: motorun değerlendirmesini başka
 * satranç uygulamalarıyla karşılaştırabilmek. FEN kopyalama daha önce
 * SADECE NotationCard.tsx'te hamleye sağ tıklayınca açılan (gizli) menüde
 * vardı; bu, üç Analiz Et ekranının (BotGame özeti, Yeni Analiz,
 * Maçlarımın Analizi) HEPSİNDE görünür, paylaşılan bir bileşen.
 */
export function GameExportBlock({ sanMoves, currentFen, startFen }: Props) {
  const [copiedPgn, setCopiedPgn] = useState(false);
  const [copiedFen, setCopiedFen] = useState(false);

  async function copyPgn() {
    try {
      const chess = startFen ? new Chess(startFen) : new Chess();
      for (const san of sanMoves) {
        try { chess.move(san); } catch { break; } // bozuk kayıt — oynatılabildiği yere kadar
      }
      await navigator.clipboard.writeText(chess.pgn());
      setCopiedPgn(true);
      setTimeout(() => setCopiedPgn(false), 1500);
    } catch {
      /* pano erişimi yoksa sessizce yoksay — kritik olmayan bir kolaylık. */
    }
  }

  async function copyFen() {
    try {
      await navigator.clipboard.writeText(currentFen);
      setCopiedFen(true);
      setTimeout(() => setCopiedFen(false), 1500);
    } catch {
      /* pano erişimi yoksa sessizce yoksay. */
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" onClick={copyPgn}
        className="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
        style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)' }}>
        {copiedPgn ? 'PGN Kopyalandı ✓' : 'PGN Kopyala'}
      </button>
      <button type="button" onClick={copyFen}
        className="flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
        style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)' }}>
        {copiedFen ? 'FEN Kopyalandı ✓' : 'FEN Kopyala'}
      </button>
    </div>
  );
}

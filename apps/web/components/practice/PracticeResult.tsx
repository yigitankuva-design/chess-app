'use client';
import Link from 'next/link';
import { ChessBoard } from '@/components/ChessBoard';
import type { ResultHeadline } from '@/lib/practice/resultHeadline';

interface Props {
  correct: number;
  total: number;
  /** 0–100. Sunucu hesaplar; sunucuya ulaşılamazsa yerel scorePercent kullanılır. */
  score: number;
  /** Bu oturumda açılan kilidin adı, yoksa null. */
  unlocked: string | null;
  onRetry: () => void;
  /** Madde 7: arka planda matlaşan tahtanın gösterdiği konum. */
  boardFen: string;
  /** Madde 7: tahtanın üzerinde beliren büyük renkli mesaj. */
  headline: ResultHeadline;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Oturum sonu dökümü (madde 7). Saf sunum — puanlama/kilit kararı vermez.
 *
 * Tasarım: satranç tahtası renkleri MATLAŞIP beyazlaşır (grayscale +
 * brightness filtresi), üzerinde puan eşiğine göre kırmızı ("tekrar yap")
 * veya yeşil ("bir sonrakine geçebilirsin") büyük punto bir mesaj belirir.
 */
export function PracticeResult({
  correct, total, score, unlocked, onRetry, boardFen, headline,
}: Props) {
  const toneColor = headline.tone === 'success' ? '#16a34a' : '#dc2626';

  return (
    <div className="t-card-i p-5 text-center rounded-xl">
      {/* Matlaşan tahta + üzerindeki büyük mesaj */}
      <div className="relative mx-auto mb-4" style={{ maxWidth: 320 }}>
        <div
          aria-hidden="true"
          style={{ filter: 'grayscale(1) brightness(2.2) contrast(0.55)', opacity: 0.6, pointerEvents: 'none' }}
        >
          <ChessBoard fen={boardFen || START_FEN} interactive={false} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <p
            className="font-black leading-tight"
            style={{
              fontSize: 'clamp(1.05rem, 6vw, 1.6rem)',
              color: toneColor,
              textShadow: '0 1px 3px rgba(255,255,255,0.9), 0 0 14px rgba(255,255,255,0.9)',
            }}
          >
            {headline.text}
          </p>
        </div>
      </div>

      <p className="text-sm mb-1">
        <b style={{ color: 'var(--t-accent)' }}>{correct} / {total}</b> doğru
      </p>
      <p className="text-sm mb-3">
        Puanın: <b style={{ color: 'var(--t-accent)' }}>{score} / 100</b>
      </p>

      {unlocked && (
        <p className="text-sm font-bold mb-3 py-2 px-3 rounded-xl"
          style={{
            background: 'color-mix(in srgb, var(--t-accent) 12%, transparent)',
            border: '1px solid var(--t-accent)',
          }}>
          🔓 {unlocked} açıldı!
        </p>
      )}

      <div className="flex gap-2 justify-center">
        <button type="button" onClick={onRetry} className="t-btn px-5 py-2.5 text-sm">
          Tekrar Dene
        </button>
        <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}

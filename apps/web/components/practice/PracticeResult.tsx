'use client';
import Link from 'next/link';
import { thresholdMessage } from '@/lib/practice/scoring';

interface Props {
  correct: number;
  total: number;
  /** 0–100. Sunucu hesaplar; sunucuya ulaşılamazsa yerel scorePercent kullanılır. */
  score: number;
  /** Bu oturumda açılan kilidin adı, yoksa null. */
  unlocked: string | null;
  onRetry: () => void;
}

/** Oturum sonu dökümü. Saf sunum — puanlama/kilit kararı vermez. */
export function PracticeResult({ correct, total, score, unlocked, onRetry }: Props) {
  return (
    <div className="t-card-i p-5 text-center rounded-xl">
      <p className="text-3xl mb-2">🏁</p>
      <p className="font-extrabold text-base mb-1">{thresholdMessage(score)}</p>

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

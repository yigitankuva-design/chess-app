'use client';
import { formatClock, isLowTime } from '@/lib/play/clockFormat';

interface Props {
  name: string;
  /** Kalan sure (ms). null => saatsiz mac: saat HIC cizilmez. */
  ms: number | null;
  /** Sirasi bu oyuncuda mi. */
  active: boolean;
}

/** Bir oyuncunun satiri: ad + saat. Saat yoksa yalnizca ad. */
export function PlayerClock({ name, ms, active }: Props) {
  const low = ms !== null && isLowTime(ms);
  return (
    <div
      aria-label={`${name} saati`}
      data-active={active ? 'true' : 'false'}
      data-low={low ? 'true' : 'false'}
      className="t-card-i flex items-center gap-3 px-4 py-2"
      style={{
        border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
      }}
    >
      <span className="text-sm">{active ? '🟢' : '⚪'}</span>
      <span className="font-semibold text-sm flex-1 min-w-0 truncate">{name}</span>
      {ms !== null && (
        <span
          className="font-mono font-bold tabular-nums"
          style={{ fontSize: '1.35rem', color: low ? '#f87171' : 'var(--t-text)' }}
        >
          {formatClock(ms)}
        </span>
      )}
    </div>
  );
}

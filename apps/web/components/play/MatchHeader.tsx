'use client';
import { formatClock, isLowTime } from '@/lib/play/clockFormat';

interface Props {
  whiteName: string;
  blackName: string;
  /** Kalan sure (ms). null => saatsiz mac: kare cizilir ama sure yerine "—". */
  whiteMs: number | null;
  blackMs: number | null;
  whiteToMove: boolean;
  /** Mac bittiyse iki saat de sonuk gorunur. */
  running?: boolean;
}

function ClockBox({ name, ms, active }: { name: string; ms: number | null; active: boolean }) {
  const low = ms !== null && isLowTime(ms);
  return (
    <div
      aria-label={`${name} saati`}
      data-active={active ? 'true' : 'false'}
      data-low={low ? 'true' : 'false'}
      className="t-card-i flex items-center justify-center flex-shrink-0"
      style={{
        width: '5.5rem',
        height: '5.5rem',
        border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
      }}
    >
      <span
        className="font-mono font-bold tabular-nums"
        style={{ fontSize: '1.15rem', color: low ? '#f87171' : 'var(--t-text)' }}
      >
        {ms === null ? '—' : formatClock(ms)}
      </span>
    </div>
  );
}

/** Tahtanin USTUNDEKI uc kart (madde 3):
 *  kare (beyaz saati) — dikdortgen (isimler) — kare (siyah saati). */
export function MatchHeader({
  whiteName, blackName, whiteMs, blackMs, whiteToMove, running = true,
}: Props) {
  return (
    <div className="flex items-stretch gap-2 mb-2">
      <ClockBox name={whiteName} ms={whiteMs} active={running && whiteToMove} />

      <div className="t-card-i flex-1 min-w-0 flex flex-col items-center justify-center px-3 text-center">
        <p className="font-semibold text-sm truncate w-full">{whiteName}</p>
        <p className="text-xs t-muted my-0.5">–</p>
        <p className="font-semibold text-sm truncate w-full">{blackName}</p>
      </div>

      <ClockBox name={blackName} ms={blackMs} active={running && !whiteToMove} />
    </div>
  );
}

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
  /** Bu ekrani kim izliyor — "Sen" etiketi ve sira cumlesi buna gore yazilir.
   *  Bota karsi macta verilmez; o zaman sadece isimler gosterilir. */
  me?: 'white' | 'black';
}

function ClockBox({
  name, ms, active, symbol, colorLabel,
}: {
  name: string; ms: number | null; active: boolean;
  symbol: string; colorLabel: string;
}) {
  const low = ms !== null && isLowTime(ms);
  return (
    <div
      aria-label={`${name} saati`}
      data-active={active ? 'true' : 'false'}
      data-low={low ? 'true' : 'false'}
      className="t-card-i flex flex-col items-center justify-center gap-0.5 flex-shrink-0"
      style={{
        width: '5.5rem',
        height: '5.5rem',
        border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
        background: active ? 'var(--t-surface-2)' : undefined,
      }}
    >
      {/* Hangi saatin kime ait oldugu KARENIN USTUNDE yazar. */}
      <span className="text-lg leading-none" aria-hidden="true">{symbol}</span>
      <span className="text-[10px] font-semibold t-muted uppercase tracking-wide">
        {colorLabel}
      </span>
      <span
        className="font-mono font-bold tabular-nums"
        style={{ fontSize: '1.05rem', color: low ? '#f87171' : 'var(--t-text)' }}
      >
        {ms === null ? '—' : formatClock(ms)}
      </span>
    </div>
  );
}

/** Tahtanin USTUNDEKI uc kart (madde 3):
 *  kare (beyaz saati) — dikdortgen (isimler + sira) — kare (siyah saati). */
export function MatchHeader({
  whiteName, blackName, whiteMs, blackMs, whiteToMove, running = true, me,
}: Props) {
  const turnName = whiteToMove ? whiteName : blackName;
  const myTurn = me !== undefined && (me === 'white') === whiteToMove;

  const turnLine = !running
    ? 'Maç bitti'
    : me === undefined
      ? `Sıra: ${turnName}`
      : myTurn
        ? 'Sıra sende'
        : `Sıra rakipte: ${turnName}`;

  const tag = (side: 'white' | 'black') => (me === side ? ' (Sen)' : '');

  return (
    <div className="flex items-stretch gap-2 mb-2">
      <ClockBox
        name={whiteName} ms={whiteMs} active={running && whiteToMove}
        symbol="♔" colorLabel="Beyaz"
      />

      <div className="t-card-i flex-1 min-w-0 flex flex-col items-center justify-center px-3 text-center gap-0.5">
        <p className="font-semibold text-sm truncate w-full">
          ♔ {whiteName}{tag('white')}
        </p>
        <p className="font-semibold text-sm truncate w-full">
          ♚ {blackName}{tag('black')}
        </p>
        <p
          className="text-xs font-bold mt-1 truncate w-full"
          style={{ color: running ? 'var(--t-accent)' : 'var(--t-muted)' }}
        >
          {turnLine}
        </p>
      </div>

      <ClockBox
        name={blackName} ms={blackMs} active={running && !whiteToMove}
        symbol="♚" colorLabel="Siyah"
      />
    </div>
  );
}

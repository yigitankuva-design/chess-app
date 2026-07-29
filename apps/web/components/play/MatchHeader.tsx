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
      className="t-card-i gap-0.5 flex-shrink-0"
      style={{
        /* .t-card-i "display: block" veriyor ve Tailwind'in flex/flex-col
           siniflarini eziyor (olculdu: kutu icindeki uc oge yan yana dizilip
           ekrandan tasiyordu). Satir ici stil her zaman kazanir. */
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        /* Madde 11: kucuk telefonlarda kareler daralir, isim kartina yer kalir. */
        width: 'clamp(3.9rem, 17vw, 5.5rem)',
        height: 'clamp(3.9rem, 17vw, 5.5rem)',
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
    // Madde 2: uc kart bulundugu alanda ORTALANIR (mx-auto + justify-center)
    // ve tahtayla ayni genislikte kalir.
    <div className="flex items-stretch justify-center gap-2 mb-2 mx-auto w-full max-w-[600px]">
      <ClockBox
        name={whiteName} ms={whiteMs} active={running && whiteToMove}
        symbol="♔" colorLabel="Beyaz"
      />

      {/* Madde 2: isimler ALT ALTA degil YAN YANA — "Zafer Dinç – Hasan Yiğit" */}
      <div className="t-card-i flex-1 min-w-0 overflow-hidden px-2 text-center gap-1"
        style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
        {/* min-w-0 SART: truncate yazilar daralamazsa orta kart sisip sagdaki
            saati ekranin DISINA itiyordu (olculdu: telefonda 17px yatay tasma). */}
        <p className="font-semibold text-sm flex items-center justify-center gap-1 flex-wrap max-w-full">
          <span className="truncate min-w-0">♔ {whiteName}{tag('white')}</span>
          <span className="t-muted flex-shrink-0">–</span>
          <span className="truncate min-w-0">♚ {blackName}{tag('black')}</span>
        </p>
        <p
          className="text-xs font-bold truncate w-full"
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

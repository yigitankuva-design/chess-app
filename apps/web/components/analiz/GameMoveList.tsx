import type { GameMoveDto } from '@/lib/analiz/analizApi';
import { toTurkishSan } from '@/lib/chess/analysisFormat';

interface Props {
  moves: GameMoveDto[];
  /** 0 = başlangıç konumu (henüz hamle yok); N = moves[N-1]'in fen_after'ı. */
  currentPly: number;
  onSelectPly: (ply: number) => void;
  /** Tahtayı çevirir (madde 2026-08-30/3). */
  onFlipBoard: () => void;
}

type IconType = 'flip' | 'first' | 'prev' | 'next' | 'last';

/** Madde 2026-08-31 (3b): 5 kontrol de AYNI SVG viewBox/boyutunda — Unicode
 *  sembollerin (⏮◀▶⏭) yazı tipine göre farklı görünen boyutları yerine
 *  garanti eşit büyüklük. */
function NavIcon({ type }: { type: IconType }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24' } as const;
  if (type === 'flip') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
      </svg>
    );
  }
  if (type === 'prev') {
    return <svg {...common} fill="currentColor"><polygon points="15,5 15,19 6,12" /></svg>;
  }
  if (type === 'next') {
    return <svg {...common} fill="currentColor"><polygon points="9,5 9,19 18,12" /></svg>;
  }
  if (type === 'first') {
    return (
      <svg {...common} fill="currentColor">
        <rect x="4" y="5" width="2.4" height="14" />
        <polygon points="19,5 19,19 9,12" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="currentColor">
      <polygon points="5,5 5,19 15,12" />
      <rect x="17.6" y="5" width="2.4" height="14" />
    </svg>
  );
}

/** Madde 2026-08-30 (3) + 2026-08-31 (3a): oynatma kartları — dikdörtgen,
 *  kalın çerçeveli; madde 2026-08-31'de %20 küçültülüp (72×54 → 58×43) 5'i
 *  aynı satırda yan yana sığacak şekilde ayarlandı. */
const NavBtn = ({
  label, icon, onClick, disabled,
}: { label: string; icon: IconType; onClick: () => void; disabled?: boolean }) => (
  <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
    className="flex items-center justify-center rounded-xl t-muted border-2 border-white/20 disabled:opacity-30 hover:bg-white/5 transition-colors flex-shrink-0"
    style={{ width: 58, height: 43 }}>
    <NavIcon type={icon} />
  </button>
);

/**
 * Analiz Et sekmesi — "Son Maçlarımı İncele": oynatma kontrolleri
 * (çevir/⏮/◀/▶/⏭) + hamle numaralı SAN listesi. Bir hamleye tıklayınca o
 * pozisyona atlar.
 */
export function GameMoveList({ moves, currentPly, onSelectPly, onFlipBoard }: Props) {
  const total = moves.length;

  const pairs: { moveNumber: number; white?: GameMoveDto; black?: GameMoveDto }[] = [];
  moves.forEach((m) => {
    const moveNumber = Math.ceil(m.ply / 2);
    let pair = pairs.find((p) => p.moveNumber === moveNumber);
    if (!pair) { pair = { moveNumber }; pairs.push(pair); }
    if (m.ply % 2 === 1) pair.white = m; else pair.black = m;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2">
        <NavBtn label="Tahtayı çevir" icon="flip" onClick={onFlipBoard} />
        <NavBtn label="Başa git" icon="first" onClick={() => onSelectPly(0)} disabled={currentPly === 0} />
        <NavBtn label="Geri" icon="prev" onClick={() => onSelectPly(Math.max(0, currentPly - 1))} disabled={currentPly === 0} />
        <NavBtn label="İleri" icon="next" onClick={() => onSelectPly(Math.min(total, currentPly + 1))} disabled={currentPly === total} />
        <NavBtn label="Sona git" icon="last" onClick={() => onSelectPly(total)} disabled={currentPly === total} />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-mono t-card-i p-2">
        {pairs.length === 0 && <p className="text-xs t-muted">Hamle yok.</p>}
        {pairs.map((p) => (
          <span key={p.moveNumber} className="whitespace-nowrap">
            <span className="t-muted">{p.moveNumber}.</span>{' '}
            {p.white && (
              <button type="button" onClick={() => onSelectPly(p.white!.ply)}
                className="rounded px-1"
                style={{ background: currentPly === p.white.ply ? 'rgba(34,211,238,0.25)' : undefined }}>
                {toTurkishSan(p.white.san)}
              </button>
            )}
            {p.black && (
              <>
                {' '}
                <button type="button" onClick={() => onSelectPly(p.black!.ply)}
                  className="rounded px-1"
                  style={{ background: currentPly === p.black.ply ? 'rgba(34,211,238,0.25)' : undefined }}>
                  {toTurkishSan(p.black.san)}
                </button>
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

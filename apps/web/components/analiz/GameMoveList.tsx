import type { GameMoveDto } from '@/lib/analiz/analizApi';

interface Props {
  moves: GameMoveDto[];
  /** 0 = başlangıç konumu (henüz hamle yok); N = moves[N-1]'in fen_after'ı. */
  currentPly: number;
  onSelectPly: (ply: number) => void;
  /** Tahtayı çevirir (madde 2026-08-30/3). */
  onFlipBoard: () => void;
}

const NAV_ICONS: Record<string, string> = {
  'Tahtayı çevir': '⇅', 'Başa git': '⏮', 'Geri': '◀', 'İleri': '▶', 'Sona git': '⏭',
};

/** Madde 2026-08-30 (3): oynatma kartları %50 büyütüldü (36px → 54px yükseklik)
 *  ve dikdörtgen kart görünümüne çevrildi (genişlik yükseklikten belirgin
 *  şekilde fazla), çerçeve kalınlaştırıldı (1px → 2px). */
const NavBtn = ({
  label, onClick, disabled,
}: { label: string; onClick: () => void; disabled?: boolean }) => (
  <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
    className="flex items-center justify-center rounded-xl t-muted border-2 border-white/20 disabled:opacity-30 hover:bg-white/5 transition-colors text-lg"
    style={{ width: 72, height: 54 }}>
    {NAV_ICONS[label]}
  </button>
);

/**
 * Analiz Et sekmesi — "Son Maçlarımı İncele": oynatma kontrolleri (⏮◀▶⏭) +
 * hamle numaralı SAN listesi. Bir hamleye tıklayınca o pozisyona atlar.
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
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <NavBtn label="Tahtayı çevir" onClick={onFlipBoard} />
        <NavBtn label="Başa git" onClick={() => onSelectPly(0)} disabled={currentPly === 0} />
        <NavBtn label="Geri" onClick={() => onSelectPly(Math.max(0, currentPly - 1))} disabled={currentPly === 0} />
        <NavBtn label="İleri" onClick={() => onSelectPly(Math.min(total, currentPly + 1))} disabled={currentPly === total} />
        <NavBtn label="Sona git" onClick={() => onSelectPly(total)} disabled={currentPly === total} />
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
                {p.white.san}
              </button>
            )}
            {p.black && (
              <>
                {' '}
                <button type="button" onClick={() => onSelectPly(p.black!.ply)}
                  className="rounded px-1"
                  style={{ background: currentPly === p.black.ply ? 'rgba(34,211,238,0.25)' : undefined }}>
                  {p.black.san}
                </button>
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

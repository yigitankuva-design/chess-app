import type { GameMoveDto } from '@/lib/analiz/analizApi';

interface Props {
  moves: GameMoveDto[];
  /** 0 = başlangıç konumu (henüz hamle yok); N = moves[N-1]'in fen_after'ı. */
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

const NavBtn = ({
  label, onClick, disabled,
}: { label: string; onClick: () => void; disabled: boolean }) => (
  <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
    className="w-9 h-9 flex items-center justify-center rounded-lg t-muted border border-white/15 disabled:opacity-30 hover:bg-white/5 transition-colors">
    {label === 'Başa git' ? '⏮' : label === 'Geri' ? '◀' : label === 'İleri' ? '▶' : '⏭'}
  </button>
);

/**
 * Analiz Et sekmesi — "Son Maçlarımı İncele": oynatma kontrolleri (⏮◀▶⏭) +
 * hamle numaralı SAN listesi. Bir hamleye tıklayınca o pozisyona atlar.
 */
export function GameMoveList({ moves, currentPly, onSelectPly }: Props) {
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

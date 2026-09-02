'use client';
import { PIECE_SET_ORDER, PIECE_SET_NAMES } from '@/lib/pieceSets';
import { useBoardPrefs } from '@/lib/board-prefs-context';

export function PieceSetSelector() {
  const { pieceSetId, setPieceSetId } = useBoardPrefs();

  return (
    <div className="grid gap-2">
      {PIECE_SET_ORDER.map((id) => {
        // pieceSetId hiç seçilmediyse (null) fiilen "cburnett" aktif kabul edilir —
        // bu, kişisel tercih yapılmadan önceki gerçek varsayılan davranışla eşleşir.
        const active = pieceSetId === id || (pieceSetId === null && id === 'cburnett');
        return (
          <button
            key={id}
            type="button"
            onClick={() => setPieceSetId(id === 'cburnett' ? null : id)}
            className={[
              't-card-i flex items-center gap-3 px-3 py-3 transition-all text-left w-full',
              active ? 'ring-2' : '',
            ].join(' ')}
            style={active ? { '--tw-ring-color': 'var(--t-accent)' } as React.CSSProperties : {}}
            aria-pressed={active}
          >
            <div className="flex gap-1 w-14 h-14 flex-shrink-0 items-center justify-center rounded" style={{ background: 'var(--t-surface-2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/pieces/${id}/wK.svg`} alt="" width={24} height={24} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/pieces/${id}/wN.svg`} alt="" width={24} height={24} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm">{PIECE_SET_NAMES[id]}</span>
              {active && <span className="ml-2 t-tag-ac text-xs px-2 py-0.5">Aktif</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

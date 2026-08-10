'use client';
import { useState } from 'react';
import { PositionPoolFields } from './PositionPoolFields';
import { OYUNSONU_CATEGORIES, KATEGORISIZ, groupByCategory } from '@/lib/customTabs/pratikYap';

interface PoolPosition {
  id: string;
  fen: string;
  category?: string | null;
}

interface Props {
  fen: string;
  turn: 'w' | 'b';
  onFenChange: (fen: string) => void;
  onTurnChange: (t: 'w' | 'b') => void;
  /** Konumu kaydeder. İkinci alan, konumun hangi kategoriye ait olduğudur. */
  onSavePosition: (fen: string | undefined, category: string) => void;
  pool: PoolPosition[];
  onDeletePosition: (id: string) => void;
  onUpdatePosition: (id: string, next: PoolPosition) => void;
}

/**
 * "Oyunsonu Pratiği Yap" alt sekmesinin kategori kabuğu: 5 açılır kart, her biri
 * kendi konum havuzunu tutar. Konum ekleme ekranının kendisi DEĞİŞMEZ —
 * `PositionPoolFields` her kategori için yeniden kullanılır (elle dizme + FEN).
 *
 * Kategorisi olmayan eski konumlar için ek bir "Kategorisiz" grubu yalnızca
 * böyle konum VARSA gösterilir.
 */
export function CategorizedPositionPool({
  fen, turn, onFenChange, onTurnChange, onSavePosition, pool, onDeletePosition, onUpdatePosition,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = groupByCategory(pool);

  const kategoriler: string[] = [...OYUNSONU_CATEGORIES];
  if (groups[KATEGORISIZ].length > 0) kategoriler.push(KATEGORISIZ);

  return (
    <div className="space-y-2">
      {kategoriler.map((cat) => {
        const acik = open === cat;
        const adet = groups[cat].length;
        return (
          <div key={cat} className="rounded-lg border border-white/10 bg-white/[0.03]">
            <button type="button"
              onClick={() => setOpen((p) => (p === cat ? null : cat))}
              aria-expanded={acik}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
              <span className="text-sm font-semibold n-text flex-1">{cat}</span>
              <span className="text-xs n-muted px-2 py-0.5 rounded-full border border-white/15">
                {adet}
              </span>
              <span className="text-xs n-muted">{acik ? '▴' : '▾'}</span>
            </button>

            {acik && (
              <div className="px-3 pb-3">
                <PositionPoolFields
                  fen={fen} turn={turn}
                  onFenChange={onFenChange} onTurnChange={onTurnChange}
                  onSavePosition={(f) => onSavePosition(f, cat)}
                  pool={groups[cat]}
                  onDeletePosition={onDeletePosition}
                  onUpdatePosition={onUpdatePosition}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

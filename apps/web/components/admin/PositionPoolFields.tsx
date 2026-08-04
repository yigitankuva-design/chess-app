'use client';
import { BoardEditor } from '@/components/BoardEditor';
import { SavedPositionBoard } from './SavedPositionBoard';

interface PoolPosition {
  id: string;
  fen: string;
}

interface Props {
  /** Dizme aşamasındaki FEN (havuza eklenmeden önce). */
  fen: string;
  turn: 'w' | 'b';
  onFenChange: (fen: string) => void;
  onTurnChange: (t: 'w' | 'b') => void;
  /** "Konumu Kaydet" — mevcut `fen`'i havuza ekler. */
  onSavePosition: () => void;
  pool: PoolPosition[];
  onDeletePosition: (id: string) => void;
}

/**
 * Pratik Yap alt sekmeleri için bot-pratiği konum havuzu girişi.
 *
 * "Taşı Oynat" (move_piece) akışının aksine hamle dizisi KAYDEDİLMEZ —
 * yalnızca konum (taşlar + hamle sırası, FEN içinde) havuza eklenir.
 */
export function PositionPoolFields({
  fen, turn, onFenChange, onTurnChange, onSavePosition, pool, onDeletePosition,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs n-muted text-center">
        Sporcunun bota karşı pratik yapacağı konumu diz, sırayı belirle, kaydet.
      </p>
      <BoardEditor fen={fen} turn={turn} onChange={onFenChange} onTurnChange={onTurnChange} />
      <button type="button" onClick={onSavePosition}
        className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
        Konumu Kaydet
      </button>

      <div className="pt-2 border-t border-white/10">
        <p className="text-xs font-bold n-muted uppercase tracking-widest mb-2">
          Konum Havuzu ({pool.length})
        </p>
        {pool.length === 0 ? (
          <p className="text-sm n-muted">Henüz konum eklenmedi.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {pool.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <SavedPositionBoard fen={p.fen} marked={[]} />
                <button type="button" onClick={() => onDeletePosition(p.id)}
                  className="text-xs text-rose-300 hover:text-rose-200">
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { SavedPositionBoard } from '@/components/admin/SavedPositionBoard';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import type { PoolPosition } from '@/components/admin/PositionPoolView';

interface Props {
  pool: PoolPosition[];
}

/** Bir yatay satırda kaç kod dairesi durur — admin'deki POOL_ROW_SIZE ile AYNI. */
const ROW_SIZE = 12;

function satirlaraBol<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Antrenörün Hızlı Erişim/Antrenör/Dersler/.../Alt Konu'da kaydettiği konum
 * havuzunu SIRAYLA öğrencileriyle paylaşması için salt-okunur görüntüleyici
 * — madde: 2026-08-24. Admin panelindeki PositionPoolView ile AYNI kod
 * numaralama mantığı (assignExerciseCodes) kullanılır — bir koda tıklanınca
 * o konum tahtada açılır; düzenleme/silme burada YOKTUR.
 */
export function PositionPoolViewer({ pool }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (pool.length === 0) {
    return <p className="t-muted text-sm">Henüz konum eklenmedi.</p>;
  }

  const kodlar = assignExerciseCodes(pool);
  const satirlar = satirlaraBol(pool.map((p, i) => ({ p, kod: kodlar[i] })), ROW_SIZE);
  const current = pool.find((p) => p.id === selectedId);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {satirlar.map((satir, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            {satir.map(({ p, kod }) => {
              const secili = selectedId === p.id;
              return (
                <button key={p.id} type="button"
                  aria-label={`Konum ${kod}`}
                  aria-pressed={secili}
                  onClick={() => setSelectedId((prev) => (prev === p.id ? null : p.id))}
                  className="flex items-center justify-center rounded-full font-mono font-bold text-xs transition-colors"
                  style={{
                    width: 40, height: 40,
                    border: secili ? '2px solid rgb(34 211 238)' : '1px solid rgba(255,255,255,0.15)',
                    background: secili ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.03)',
                    color: secili ? 'rgb(165 243 252)' : undefined,
                  }}>
                  {kod}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {current && (
        <div className="flex justify-center">
          <SavedPositionBoard fen={current.fen} marked={[]} />
        </div>
      )}
    </div>
  );
}

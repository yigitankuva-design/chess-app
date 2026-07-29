'use client';
import { useEffect, useRef } from 'react';
import { toMoveRows, parseFenStart } from '@/lib/play/moveList';

interface Props {
  /** Oynanan hamleler (SAN), sirasiyla. */
  san: string[];
  /** Macin basladigi konum — acilis pratiginde standart degildir. */
  startFen?: string | null;
}

/** Tahtanin ALTINDA duran hamle notasyonu (madde 1).
 *  Uzun maclarda sayfa buyumesin diye kendi icinde kayar; son hamle
 *  otomatik gorunur kalir. */
export function MoveList({ san, startFen }: Props) {
  const rows = toMoveRows(san, parseFenStart(startFen));
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [san.length]);

  return (
    <section aria-label="Hamleler" className="t-card-i mt-3 p-3">
      <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-2">
        Hamleler
      </p>
      {rows.length === 0 ? (
        <p className="text-sm t-muted">Henüz hamle yapılmadı.</p>
      ) : (
        <div ref={boxRef} className="max-h-40 overflow-y-auto">
          <ol className="text-sm font-mono space-y-0.5">
            {rows.map((r) => (
              <li key={r.no} className="flex gap-3">
                <span className="t-muted w-8 flex-shrink-0 text-right">{r.no}.</span>
                <span className="w-16">{r.white ?? '…'}</span>
                <span className="w-16">{r.black ?? ''}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

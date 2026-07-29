'use client';
import { useEffect, useRef } from 'react';
import { parseFenStart } from '@/lib/play/moveList';
import { turkishMovePairs } from '@/lib/play/sanTr';

interface Props {
  /** Oynanan hamleler (SAN, chess.js'ten İngilizce gelir). */
  san: string[];
  /** Macin basladigi konum — acilis pratiginde standart degildir. */
  startFen?: string | null;
}

/** Tahtanin ALTINDA duran hamle notasyonu (madde 1/3).
 *  Hamleler YAN YANA akar, satir bitince alt satirdan devam eder:
 *  "1. e4 – e5, 2. Af3 – Ac6, 3. Fc4 – Fc5 …"  Yazim TURKCEDIR. */
export function MoveList({ san, startFen }: Props) {
  const pairs = turkishMovePairs(san, parseFenStart(startFen));
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [san.length]);

  return (
    <section aria-label="Hamleler"
      /* Genislik TAHTAYLA AYNI: notasyon tahta hizasini gecmez. */
      className="t-card-i mt-3 p-3 w-full max-w-[600px] mx-auto">
      <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-2">
        Hamleler
      </p>
      {pairs.length === 0 ? (
        <p className="text-sm t-muted">Henüz hamle yapılmadı.</p>
      ) : (
        <div ref={boxRef} className="max-h-32 overflow-y-auto overflow-x-hidden">
          {/* Akici yazi: satir dolunca kendiliginden alt satira gecer. */}
          <p className="text-sm font-mono leading-relaxed break-words">
            {pairs.map((p, i) => (
              <span key={p.no}>
                <span className="whitespace-nowrap">
                  <span className="t-muted">{p.no}.</span> {p.text}
                  {i < pairs.length - 1 ? ',' : ''}
                </span>
                {/* Ayirici bosluk nowrap DISINDA ve GERCEK bosluk:
                    once bolunmez bosluk (U+00A0) vardi, bu yuzden satir
                    hic bolunmuyor ve yazi yatay akiyordu. */}
                {i < pairs.length - 1 ? ' ' : ''}
              </span>
            ))}
          </p>
        </div>
      )}
    </section>
  );
}

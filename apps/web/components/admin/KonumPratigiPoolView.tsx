'use client';
import { useState } from 'react';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import { POOL_ROW_SIZE } from './PositionPoolView';
import { KonumPratigiFields } from './KonumPratigiFields';
import type { KonumPratigiQuestion } from '@/lib/customTabsApi';

interface Props {
  pool: KonumPratigiQuestion[];
  onAddQuestion: (q: KonumPratigiQuestion) => Promise<void>;
  onUpdateQuestion: (id: string, next: KonumPratigiQuestion) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
}

function satirlaraBol<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * a) Konum Pratiği'nin soru havuzu — Zafer'in isteğiyle "Kazanç Konumunu
 * Pratik Yap"taki Konum Havuzu (bkz. PositionPoolView.tsx) ile AYNI görünüm
 * ve etkileşim: kapalı/açık "Konum Havuzu" kartı, açılınca kodlar yuvarlak
 * düğmeler halinde 12'li satırlarda listelenir, bir koda tıklayınca o soru
 * DÜZENLEMEYE açılır (KonumPratigiFields initial-dolu render edilir), Sil
 * düzenleme başlığının yanında.
 */
export function KonumPratigiPoolView({ pool, onAddQuestion, onUpdateQuestion, onDeleteQuestion }: Props) {
  const [acik, setAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);

  const kodlar = assignExerciseCodes(pool.map((p) => ({ code: p.code ?? undefined })));
  const satirlar = satirlaraBol(pool.map((p, i) => ({ p, kod: p.code ?? kodlar[i] })), POOL_ROW_SIZE);

  return (
    <div className="space-y-3">
      <KonumPratigiFields onSubmit={onAddQuestion} />

      <div className="space-y-2 pt-2 border-t border-white/10">
        <button type="button" onClick={() => { setAcik((v) => !v); setDuzenlenen(null); }}
          aria-expanded={acik}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/5 text-left transition-colors">
          <span className="text-sm font-bold n-text flex-1">Konum Havuzu</span>
          <span className="text-xs n-muted px-2 py-0.5 rounded-full border border-white/15">
            {pool.length}
          </span>
          <span className="text-xs n-muted">{acik ? '▴' : '▾'}</span>
        </button>

        {acik && pool.length === 0 && (
          <p className="text-sm n-muted">Henüz soru eklenmedi.</p>
        )}

        {acik && pool.length > 0 && (
          <div className="space-y-2">
            {satirlar.map((satir, i) => (
              <div key={i} data-testid="kod-satiri" className="flex flex-wrap gap-2">
                {satir.map(({ p, kod }) => {
                  const secili = duzenlenen === p.id;
                  return (
                    <button key={p.id} type="button"
                      aria-label={`Soru ${kod}`}
                      onClick={() => setDuzenlenen((v) => (v === p.id ? null : p.id))}
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

            {satirlar.flat().map(({ p, kod }) => (
              duzenlenen === p.id && (
                <div key={`edit-${p.id}`} className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-xs n-muted">
                      <span className="font-mono font-bold">{kod}</span> numaralı soruyu düzenliyorsun.
                    </p>
                    <button type="button" onClick={() => { onDeleteQuestion(p.id); setDuzenlenen(null); }}
                      aria-label={`${kod} kodlu Konum Pratiği sorusunu sil`}
                      className="px-3 py-1.5 rounded-lg text-xs text-rose-300 border border-rose-400/40 hover:bg-rose-500/10 transition-colors">
                      Sil
                    </button>
                  </div>
                  <KonumPratigiFields
                    initial={p}
                    onSubmit={async (q) => { await onUpdateQuestion(p.id, q); setDuzenlenen(null); }}
                    onCancel={() => setDuzenlenen(null)}
                  />
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

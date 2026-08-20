'use client';
import { useState } from 'react';

export interface OpeningVariant { id: number; name: string; start_fen: string }
export interface Opening { id: number; name: string; variants: OpeningVariant[] }
export interface OpeningTypeDef { id: number; name: string; openings: Opening[] }

interface Props {
  types: OpeningTypeDef[] | null;
  /** Varyant secilince cagirilir — seceni tasiyan tur ve acilis da birlikte gider. */
  onPicked: (args: { type: OpeningTypeDef; opening: Opening; variant: OpeningVariant }) => void;
}

/**
 * Sporcu tarafinda açılış seçimi: Tür → Açılış İsmi → Varyant TEK bir iç
 * içe akordiyonda (madde: 2026-08-20, güncelleme — admin'in
 * OpeningCategoryCards'ıyla AYNI drill-down deseni, salt-okunur/seçim
 * amaçlı). Önceki "3 ayrı numaralı adım" yapısının yerini alır.
 */
export function OpeningPicker({ types, onPicked }: Props) {
  const [openTypeId, setOpenTypeId] = useState<number | null>(null);
  const [openOpeningId, setOpenOpeningId] = useState<number | null>(null);

  if (types === null) return <p className="text-sm t-muted">Yükleniyor…</p>;
  if (types.length === 0) return <p className="text-sm t-muted">Henüz açılış türü yok.</p>;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-border)' }}>
      {types.map((t, i) => {
        const typeOpen = openTypeId === t.id;
        return (
          <div key={t.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--t-border)' }}>
            <button type="button"
              onClick={() => { setOpenTypeId((p) => (p === t.id ? null : t.id)); setOpenOpeningId(null); }}
              aria-expanded={typeOpen}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              style={{ background: 'var(--t-surface)' }}>
              <span className="font-medium text-sm flex-1">{t.name}</span>
              <span className="text-xs t-muted" aria-hidden="true">{typeOpen ? '▴' : '▾'}</span>
            </button>

            {typeOpen && (
              <div style={{ borderTop: '1px solid var(--t-border)' }}>
                {t.openings.length === 0 && (
                  <p className="text-sm t-muted px-4 py-3">Bu türde henüz açılış yok.</p>
                )}
                {t.openings.map((o, j) => {
                  const openingOpen = openOpeningId === o.id;
                  return (
                    <div key={o.id} style={{ borderTop: j === 0 ? 'none' : '1px solid var(--t-border)' }}>
                      <button type="button"
                        onClick={() => setOpenOpeningId((p) => (p === o.id ? null : o.id))}
                        aria-expanded={openingOpen}
                        className="w-full flex items-center gap-3 pl-8 pr-4 py-3 text-left"
                        style={{ background: 'var(--t-surface-2)' }}>
                        <span className="text-xl">📖</span>
                        <span className="font-medium text-sm flex-1">{o.name}</span>
                        <span className="text-xs t-muted" aria-hidden="true">{openingOpen ? '▴' : '▾'}</span>
                      </button>

                      {openingOpen && (
                        <div style={{ borderTop: '1px solid var(--t-border)' }}>
                          {o.variants.length === 0 && (
                            <p className="text-sm t-muted pl-12 py-3">Bu açılışta henüz varyant yok.</p>
                          )}
                          {o.variants.map((v, k) => (
                            <button key={v.id} type="button"
                              onClick={() => onPicked({ type: t, opening: o, variant: v })}
                              className="w-full flex items-center gap-3 pl-12 pr-4 py-3 text-left"
                              style={{
                                background: 'var(--t-surface)',
                                borderTop: k === 0 ? 'none' : '1px solid var(--t-border)',
                              }}>
                              <span className="text-xl">♟️</span>
                              <span className="font-medium text-sm flex-1">{v.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

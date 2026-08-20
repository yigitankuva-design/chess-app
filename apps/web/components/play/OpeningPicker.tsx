'use client';
import { useState } from 'react';
import { PathNode, Branch } from '@/components/ui/neumorphic';

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
 * içe patika (Dersler ekranındaki Düzey → Ders → Alt Konu ile AYNI
 * PathNode+Branch — dairesel ikon + kesikli dal çizgisi — görsel dili,
 * madde: 2026-08-20, güncelleme). Önceki kutulu/çerçeveli liste tasarımının
 * yerini alır — salt-okunur/seçim amaçlı.
 */
export function OpeningPicker({ types, onPicked }: Props) {
  const [openTypeId, setOpenTypeId] = useState<number | null>(null);
  const [openOpeningId, setOpenOpeningId] = useState<number | null>(null);

  if (types === null) return <p className="text-sm t-muted">Yükleniyor…</p>;
  if (types.length === 0) return <p className="text-sm t-muted">Henüz açılış türü yok.</p>;

  return (
    <div className="grid gap-2.5">
      {types.map((t) => {
        const typeOpen = openTypeId === t.id;
        return (
          <div key={t.id}>
            <PathNode
              icon="📖"
              label={t.name}
              active={typeOpen}
              size={30}
              onClick={() => { setOpenTypeId((p) => (p === t.id ? null : t.id)); setOpenOpeningId(null); }}
            />
            {typeOpen && (
              <Branch offset={15}>
                {t.openings.length === 0 && (
                  <p className="text-xs t-muted py-1">Bu türde henüz açılış yok.</p>
                )}
                {t.openings.map((o) => {
                  const openingOpen = openOpeningId === o.id;
                  return (
                    <div key={o.id}>
                      <PathNode
                        icon="📖"
                        label={o.name}
                        active={openingOpen}
                        size={26}
                        onClick={() => setOpenOpeningId((p) => (p === o.id ? null : o.id))}
                      />
                      {openingOpen && (
                        <Branch offset={13}>
                          {o.variants.length === 0 && (
                            <p className="text-xs t-muted py-1">Bu açılışta henüz varyant yok.</p>
                          )}
                          {o.variants.map((v) => (
                            <PathNode
                              key={v.id}
                              icon="♟️"
                              label={v.name}
                              active={false}
                              size={24}
                              onClick={() => onPicked({ type: t, opening: o, variant: v })}
                            />
                          ))}
                        </Branch>
                      )}
                    </div>
                  );
                })}
              </Branch>
            )}
          </div>
        );
      })}
    </div>
  );
}

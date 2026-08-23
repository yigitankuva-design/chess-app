'use client';
import { useState } from 'react';
import { PathNode, Branch } from '@/components/ui/neumorphic';
import type { CustomTabSection } from '@/lib/customTabsApi';

interface Props {
  /** Sekmenin TÜM bölümleri (düz liste) — her çağrı kendi çocuklarını burada filtreler. */
  sections: CustomTabSection[];
  /** Bu düzeyde hangi bölümlerin gösterileceği — null = sekmenin en üst seviyesi. */
  parentId: number | null;
  /** İç içelik derinliği — dairesel ikon boyutu ve dal girintisini belirler. */
  depth: number;
  /** Sekmenin kart rengi — yalnızca EN ÜST seviyedeki başlıklara uygulanır
   *  (Açılış Pratiği'ndeki desenle AYNI: iç seviyeler beyaz kalır). */
  accentColor?: string;
}

/**
 * Bir özel sekmenin alt sekmelerini İÇ İÇE (sınırsız derinlikte) gösterir —
 * madde: 2026-08-22, "Antrenör" sekmesi/"Sınıflar" ihtiyacı. Açılış
 * Pratiği'ndeki tür→isim→varyant akordiyonuyla AYNI görsel dil (PathNode +
 * Branch — dairesel ikon + kesikli dal çizgisi), salt-okunur (başlık + yazı
 * + görsel).
 */
export function NestedSectionAccordion({ sections, parentId, depth, accentColor }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const children = sections
    .filter((s) => (s.parent_id ?? null) === parentId)
    .sort((a, b) => a.order_index - b.order_index);

  if (children.length === 0) return null;

  const size = Math.max(24, 40 - depth * 6);
  const offset = Math.max(10, 20 - depth * 3);

  return (
    <div className="grid gap-2.5">
      {children.map((s) => {
        const open = openId === s.id;
        return (
          <div key={s.id}>
            <PathNode
              icon={s.emoji || '🎯'}
              label={s.title}
              active={open}
              size={size}
              tint={depth === 0 ? accentColor : '#fff'}
              onClick={() => setOpenId((p) => (p === s.id ? null : s.id))}
            />
            {open && (
              <Branch offset={offset}>
                <div className="space-y-3">
                  {s.body && <p className="t-muted whitespace-pre-wrap text-sm">{s.body}</p>}
                  {s.images.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {s.images.map((uri, i) => (
                        <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                          className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
                      ))}
                    </div>
                  )}
                  <NestedSectionAccordion
                    sections={sections} parentId={s.id} depth={depth + 1} accentColor={accentColor}
                  />
                </div>
              </Branch>
            )}
          </div>
        );
      })}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PathNode, Branch } from '@/components/ui/neumorphic';
import type { CustomTabSection } from '@/lib/customTabsApi';

/** Madde 2026-08-24: admin tarafındaki NestedSectionTree ile AYNI kural —
 *  "Antrenör/Dersler" alt sekmesi ve altındaki Düzey/Konu/Alt Konu
 *  düğümlerinde, en derin seviye (Alt Konu, 3. derinlik) kendi alt
 *  bölümleri yerine hocanın kaydettiği soruları gösterir. Madde 2026-08-25:
 *  bu artık AKORDİYON İÇİNDE değil, AYRI bir sayfada (kod numarasına göre
 *  sıralı İleri/Geri gezinme ile) açılır — bkz. AltKonuWalkthrough. */
const DERSLER_TITLE = 'Dersler';
const ALT_KONU_DEPTH = 3;

interface Props {
  /** Ayrı sayfaya (alt-konu/[sectionId]) yönlendirmek için gereken sekme id'si. */
  tabId: number;
  /** Sekmenin TÜM bölümleri (düz liste) — her çağrı kendi çocuklarını burada filtreler. */
  sections: CustomTabSection[];
  /** Bu düzeyde hangi bölümlerin gösterileceği — null = sekmenin en üst seviyesi. */
  parentId: number | null;
  /** İç içelik derinliği — dairesel ikon boyutu ve dal girintisini belirler. */
  depth: number;
  /** Sekmenin kart rengi — yalnızca EN ÜST seviyedeki başlıklara uygulanır
   *  (Açılış Pratiği'ndeki desenle AYNI: iç seviyeler beyaz kalır). */
  accentColor?: string;
  /** Bu çağrı "Dersler" alt sekmesinin İÇİNDE mi? — admin tarafındaki
   *  NestedSectionTree'deki inDersler ile AYNI mantık. */
  inDersler?: boolean;
}

/**
 * Bir özel sekmenin alt sekmelerini İÇ İÇE (sınırsız derinlikte) gösterir —
 * madde: 2026-08-22, "Antrenör" sekmesi/"Sınıflar" ihtiyacı. Açılış
 * Pratiği'ndeki tür→isim→varyant akordiyonuyla AYNI görsel dil (PathNode +
 * Branch — dairesel ikon + kesikli dal çizgisi), salt-okunur (başlık + yazı
 * + görsel).
 */
export function NestedSectionAccordion({
  tabId, sections, parentId, depth, accentColor, inDersler = false,
}: Props) {
  const router = useRouter();
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
        const childInDersler = inDersler || s.title === DERSLER_TITLE;
        const isAltKonu = inDersler && depth === ALT_KONU_DEPTH;
        return (
          <div key={s.id}>
            <PathNode
              icon={s.emoji || '🎯'}
              label={s.title}
              active={open}
              size={size}
              tint={depth === 0 ? accentColor : '#fff'}
              onClick={() => (
                isAltKonu
                  ? router.push(`/custom/${tabId}/alt-konu/${s.id}`)
                  : setOpenId((p) => (p === s.id ? null : s.id))
              )}
            />
            {open && !isAltKonu && (
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
                    tabId={tabId} sections={sections} parentId={s.id} depth={depth + 1}
                    accentColor={accentColor} inDersler={childInDersler}
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

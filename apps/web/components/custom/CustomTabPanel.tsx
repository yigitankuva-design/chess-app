'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import { OpeningPractice } from '@/components/play/OpeningPractice';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import {
  sectionEmoji, sortPratikSections, OYUNSONU_SECTION, OYUNSONU_CATEGORIES, groupByCategory,
} from '@/lib/customTabs/pratikYap';
import { PathNode, Branch } from '@/components/ui/neumorphic';

interface Props {
  tab: CustomTabDetail;
  /** Sekmenin ana ekrandaki kartının rengiyle AYNI — alt sekme cümleleri
   *  bu renkte gösterilir (madde 2, 2026-08-19). Verilmezse (örn.
   *  /custom/[id] sayfasından erişilirse) etiketler varsayılan renkte kalır. */
  accentColor?: string;
}

/**
 * Bir özel sekmenin alt sekme listesi (akordiyon). Hem sporcu ana sayfasında
 * (kutucuk açılınca yerinde) hem /custom/[id] sayfasında AYNI bileşen kullanılır —
 * iki yerde iki farklı ekran olmaz.
 *
 * "Pratik Yap" sekmesi özeldir: en üstte sabit Açılış Pratiği Yap satırı durur ve
 * alt sekmeleri yazı/görsel yerine bota karşı pratik kriterlerini gösterir.
 * Pratik Yap'ın tasarımı Maç Yap/Dersler'le AYNI (yuvarlak kabartma ikon
 * düğüm + kesikli bağlantı çizgisi, bkz. components/ui/neumorphic.tsx) —
 * 2026-08-19 kararı. Pratik Yap OLMAYAN özel sekmeler (yazı/görsel içeren
 * sıradan sekmeler) eski köşeli kart tasarımını korur.
 * Açılış Pratiği Yap, DİĞER alt sekmeler gibi seçim adımlarını (tür/açılış/
 * düzey) AYNI SAYFADA gösterir — ama Kazanç Konumu ve Oyunsonu'nda olduğu
 * gibi, "Pratiğe Başla"ya basılınca ASIL MAÇ /play sayfasına yönlendirilir
 * (OpeningPractice'in onReadyToStart prop'u).
 * "Oyunsonu Pratiği Yap" ayrıca özeldir: kriter ekranından önce sporcu 5
 * kategoriden birini seçer — kategorisiz (eski) konumlar sporcuya gösterilmez.
 */
export function CustomTabPanel({ tab, accentColor }: Props) {
  const router = useRouter();
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);
  /** Açılış Pratiği Yap satırı diğer alt sekmelerle AYNI akordiyona katılır
   *  (biri açılınca öbürü kapanır) ama numaralı bir bölüm id'si taşımaz. */
  const [openOpening, setOpenOpening] = useState(false);
  /** "Oyunsonu Pratiği Yap" içinde seçilen kategori — null = kategori listesi gösterilir. */
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const isPratikYap = tab.label === 'Pratik Yap';

  if (!isPratikYap) {
    return (
      <div className="space-y-2">
        {tab.sections.length === 0 && <p className="t-muted">Henüz içerik eklenmedi</p>}
        {tab.sections.map((s) => {
          const open = openSectionId === s.id;
          return (
            <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--t-surface-2)' }}>
              <button type="button"
                onClick={() => setOpenSectionId((p) => (p === s.id ? null : s.id))}
                aria-expanded={open}
                className="w-full flex items-center justify-between px-4 py-3 text-left">
                <span className="text-lg font-bold t-premium flex items-center gap-2">{s.title}</span>
                <span className="t-muted">{open ? '▴' : '▾'}</span>
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-3">
                  {s.body && <p className="t-muted whitespace-pre-wrap">{s.body}</p>}
                  {s.images.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {s.images.map((uri, i) => (
                        <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                          className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <PathNode
          icon="📖"
          label="Açılış Pratiği Yap"
          active={openOpening}
          size={40}
          tint={accentColor}
          onClick={() => { setOpenOpening((p) => !p); setOpenSectionId(null); setOpenCategory(null); }}
        />
        {openOpening && (
          <Branch offset={20}>
            <OpeningPractice
              tint={accentColor}
              onReadyToStart={(opening, v) => {
                router.push(
                  `/play?mode=opening&opening=${opening.id}`
                  + `&skill=${v.level.level}`
                  + `&tc=${encodeURIComponent(v.timeControl.label)}`
                  + `&color=${v.colorChoice}`,
                );
              }}
            />
          </Branch>
        )}
      </div>

      {sortPratikSections(tab.sections).map((s) => {
        const open = !openOpening && openSectionId === s.id;
        const emoji = sectionEmoji(s.title) ?? '🎯';
        return (
          <div key={s.id}>
            <PathNode
              icon={emoji}
              label={s.title}
              active={open}
              size={40}
              tint={accentColor}
              onClick={() => {
                setOpenSectionId((p) => (p === s.id ? null : s.id));
                setOpenCategory(null);
                setOpenOpening(false);
              }}
            />
            {open && (
              <Branch offset={20}>
                {s.title === OYUNSONU_SECTION ? (
                  openCategory === null ? (
                    <div className="grid gap-2.5">
                      {OYUNSONU_CATEGORIES.map((cat) => {
                        const count = groupByCategory(s.practice_positions)[cat].length;
                        return (
                          <PathNode
                            key={cat}
                            icon="🏁"
                            label={cat}
                            active={false}
                            size={34}
                            tint={accentColor}
                            onClick={() => setOpenCategory(cat)}
                            trailing={<span className="t-muted text-xs">{count}</span>}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button type="button" onClick={() => setOpenCategory(null)}
                        className="text-xs t-muted">
                        ← Kategorilere dön
                      </button>
                      {(() => {
                        const filtered = groupByCategory(s.practice_positions)[openCategory];
                        return filtered.length === 0 ? (
                          <p className="t-muted text-sm">Bu kategoride henüz konum yok.</p>
                        ) : (
                          <MatchCriteria
                            startLabel="Pratiğe Başla"
                            simplifiedLevels
                            onStart={(v) => {
                              router.push(
                                `/play?mode=pool&tab=${tab.id}&section=${s.id}`
                                + `&category=${encodeURIComponent(openCategory)}`
                                + `&skill=${v.level.level}`
                                + `&tc=${encodeURIComponent(v.timeControl.label)}`
                                + `&color=${v.colorChoice}`,
                              );
                            }}
                          />
                        );
                      })()}
                    </div>
                  )
                ) : s.practice_positions.length === 0 ? (
                  <p className="t-muted text-sm">Henüz konum eklenmedi.</p>
                ) : (
                  <MatchCriteria
                    startLabel="Pratiğe Başla"
                    simplifiedLevels
                    onStart={(v) => {
                      router.push(
                        `/play?mode=pool&tab=${tab.id}&section=${s.id}`
                        + `&skill=${v.level.level}`
                        + `&tc=${encodeURIComponent(v.timeControl.label)}`
                        + `&color=${v.colorChoice}`,
                      );
                    }}
                  />
                )}
              </Branch>
            )}
          </div>
        );
      })}
    </div>
  );
}

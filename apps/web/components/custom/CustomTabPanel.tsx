'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import { OpeningPractice } from '@/components/play/OpeningPractice';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import {
  sectionEmoji, sortPratikSections, OYUNSONU_SECTION, OYUNSONU_CATEGORIES, groupByCategory,
} from '@/lib/customTabs/pratikYap';

interface Props {
  tab: CustomTabDetail;
}

/**
 * Bir özel sekmenin alt sekme listesi (akordiyon). Hem sporcu ana sayfasında
 * (kutucuk açılınca yerinde) hem /custom/[id] sayfasında AYNI bileşen kullanılır —
 * iki yerde iki farklı ekran olmaz.
 *
 * "Pratik Yap" sekmesi özeldir: en üstte sabit Açılış Pratiği Yap satırı durur ve
 * alt sekmeleri yazı/görsel yerine bota karşı pratik kriterlerini gösterir.
 * Açılış Pratiği Yap, DİĞER alt sekmeler gibi seçim adımlarını (tür/açılış/
 * düzey) AYNI SAYFADA gösterir (2026-08-18 kararı) — ama Kazanç Konumu ve
 * Oyunsonu'nda olduğu gibi, "Pratiğe Başla"ya basılınca ASIL MAÇ /play
 * sayfasına yönlendirilir (OpeningPractice'in onReadyToStart prop'u, 2026-08-19).
 * "Oyunsonu Pratiği Yap" ayrıca özeldir: kriter ekranından önce sporcu 5
 * kategoriden birini seçer — kategorisiz (eski) konumlar sporcuya gösterilmez.
 */
export function CustomTabPanel({ tab }: Props) {
  const router = useRouter();
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);
  /** Açılış Pratiği Yap satırı diğer alt sekmelerle AYNI akordiyona katılır
   *  (biri açılınca öbürü kapanır) ama numaralı bir bölüm id'si taşımaz. */
  const [openOpening, setOpenOpening] = useState(false);
  /** "Oyunsonu Pratiği Yap" içinde seçilen kategori — null = kategori listesi gösterilir. */
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const isPratikYap = tab.label === 'Pratik Yap';

  return (
    <div className="space-y-2">
      {isPratikYap && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--t-surface-2)' }}>
          <button type="button"
            onClick={() => { setOpenOpening((p) => !p); setOpenSectionId(null); setOpenCategory(null); }}
            aria-expanded={openOpening}
            className="w-full flex items-center gap-3 px-4 py-3 text-left">
            <span className="text-xl leading-none">📖</span>
            <span className="font-bold t-premium flex-1">Açılış Pratiği Yap</span>
            <span className="t-muted">{openOpening ? '▴' : '▾'}</span>
          </button>
          {openOpening && (
            <div className="px-4 pb-4">
              <OpeningPractice
                onReadyToStart={(opening, v) => {
                  router.push(
                    `/play?mode=opening&opening=${opening.id}`
                    + `&skill=${v.level.level}`
                    + `&tc=${encodeURIComponent(v.timeControl.label)}`
                    + `&color=${v.colorChoice}`,
                  );
                }}
              />
            </div>
          )}
        </div>
      )}

      {tab.sections.length === 0 && !isPratikYap && (
        <p className="t-muted">Henüz içerik eklenmedi</p>
      )}

      {(isPratikYap ? sortPratikSections(tab.sections) : tab.sections).map((s) => {
        const open = !openOpening && openSectionId === s.id;
        const emoji = isPratikYap ? sectionEmoji(s.title) : null;
        return (
          <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--t-surface-2)' }}>
            <button type="button"
              onClick={() => {
                setOpenSectionId((p) => (p === s.id ? null : s.id));
                setOpenCategory(null);
                setOpenOpening(false);
              }}
              aria-expanded={open}
              className="w-full flex items-center justify-between px-4 py-3 text-left">
              <span className="text-lg font-bold t-premium flex items-center gap-2">
                {emoji && <span className="leading-none">{emoji}</span>}
                {s.title}
              </span>
              <span className="t-muted">{open ? '▴' : '▾'}</span>
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-3">
                {isPratikYap ? (
                  s.title === OYUNSONU_SECTION ? (
                    openCategory === null ? (
                      <div className="space-y-2">
                        {OYUNSONU_CATEGORIES.map((cat) => {
                          const count = groupByCategory(s.practice_positions)[cat].length;
                          return (
                            <button key={cat} type="button"
                              onClick={() => setOpenCategory(cat)}
                              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left"
                              style={{ background: 'var(--t-surface-3)' }}>
                              <span className="font-semibold text-sm t-premium">{cat}</span>
                              <span className="t-muted text-xs">{count}</span>
                            </button>
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
                  )
                ) : (
                  <>
                    {s.body && <p className="t-muted whitespace-pre-wrap">{s.body}</p>}
                    {s.images.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {s.images.map((uri, i) => (
                          <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                            className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

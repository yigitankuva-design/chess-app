'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import { OpeningPractice } from '@/components/play/OpeningPractice';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import {
  sectionEmoji, sortPratikSections, OPENING_KIND, OYUNSONU_KIND, OYUNSONU_CATEGORIES, groupByCategory,
} from '@/lib/customTabs/pratikYap';
import { renderSectionIcon } from '@/lib/customTabs/levelBadge';
import { PathNode, Branch } from '@/components/ui/neumorphic';
import { NestedSectionAccordion } from './NestedSectionAccordion';
import { readAndClearPendingOpenPath } from '@/lib/customTabs/pendingOpenPath';

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
 * "Pratik Yap" sekmesi özeldir: alt sekmeleri yazı/görsel yerine bota karşı
 * pratik kriterlerini gösterir. Pratik Yap'ın tasarımı Maç Yap/Dersler'le
 * AYNI (yuvarlak kabartma ikon düğüm + kesikli bağlantı çizgisi, bkz.
 * components/ui/neumorphic.tsx) — 2026-08-19 kararı. Pratik Yap OLMAYAN özel
 * sekmeler (yazı/görsel içeren sıradan sekmeler) eski köşeli kart tasarımını
 * korur.
 * Madde 2026-09-02 (1): Açılış Pratiği Yap, Kazanç Konumu ve Oyunsonu ile
 * AYNI listede, AYNI order_index mantığıyla sıralanır (admin Yukarı/Aşağı
 * ile üçünü de serbestçe sıralayabilir — bkz. lib/customTabs/pratikYap.ts).
 * Madde 2026-09-02 (2): admin bunların BAŞLIĞINI da değiştirebilir/
 * silebilir — bu yüzden hangi satırın "Açılış" olduğu artık section_kind'e
 * bakılarak anlaşılır, title'a DEĞİL. Tek fark İÇERİĞİ: bu satır açılınca
 * normal yazı/konum havuzu yerine OpeningPractice (açılış seç → kriter →
 * maç) gösterilir; "Pratiğe Başla"ya basılınca ASIL MAÇ /play sayfasına
 * yönlendirilir (onReadyToStart).
 * "Oyunsonu Pratiği Yap" ayrıca özeldir: kriter ekranından önce sporcu 5
 * kategoriden birini seçer — kategorisiz (eski) konumlar sporcuya gösterilmez.
 */
export function CustomTabPanel({ tab, accentColor }: Props) {
  const router = useRouter();
  /** Madde 2026-08-25: bkz. lib/customTabs/pendingOpenPath.ts — tek seferlik,
   *  yalnızca Alt Konu sayfasından "Geri" ile dönülünce dolu gelir. */
  const [initialOpenPath] = useState<number[] | undefined>(() => readAndClearPendingOpenPath(tab.id));
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);
  /** "Oyunsonu Pratiği Yap" içinde seçilen kategori — null = kategori listesi gösterilir. */
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const isPratikYap = tab.label === 'Pratik Yap';

  if (!isPratikYap) {
    return (
      <div className="space-y-2">
        {tab.sections.length === 0 && <p className="t-muted">Henüz içerik eklenmedi</p>}
        {/* Madde 2026-08-22: Açılış Pratiği'ndeki PathNode+Branch akordiyonuyla
            AYNI görsel dil — bölümlerin kendi alt bölümleri olabilir (iç içe,
            sınırsız derinlik). Eski köşeli düz-liste tasarımı kaldırıldı. */}
        <NestedSectionAccordion
          tabId={tab.id} sections={tab.sections} parentId={null} depth={0} accentColor={accentColor}
          initialOpenPath={initialOpenPath}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sortPratikSections(tab.sections).map((s) => {
        const open = openSectionId === s.id;
        // Madde 3 (2026-08-19): admin ikon havuzundan seçtiyse (s.emoji) o
        // kullanılır; seçmediyse eski varsayılana düşer (Açılış/Kazanç/Oyunsonu
        // 📖/🏆/🏁, diğerleri 🎯). Madde 2026-09-02: section_kind'e göre —
        // admin başlığı değiştirse bile doğru ikon.
        const emoji = s.emoji || sectionEmoji(s.section_kind) || '🎯';
        return (
          <div key={s.id}>
            <PathNode
              icon={renderSectionIcon(emoji)}
              label={s.title}
              active={open}
              size={40}
              tint={accentColor}
              onClick={() => {
                setOpenSectionId((p) => (p === s.id ? null : s.id));
                setOpenCategory(null);
              }}
            />
            {open && (
              <Branch offset={20}>
                {/* Madde 4 (2026-08-19): Oyunsonu'nun 5 kategorisi BEYAZ
                    kalsın diye tint BİLEREK geçilmez. */}
                {s.section_kind === OPENING_KIND ? (
                  <OpeningPractice
                    onReadyToStart={(variant, v) => {
                      router.push(
                        `/play?mode=opening&variant=${variant.id}`
                        + `&skill=${v.level.level}`
                        + `&tc=${encodeURIComponent(v.timeControl.label)}`
                        + `&color=${v.colorChoice}`,
                      );
                    }}
                  />
                ) : s.section_kind === OYUNSONU_KIND ? (
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
                            showColor={false}
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
                    showColor={false}
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

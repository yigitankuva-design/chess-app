'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import { sectionEmoji, sortPratikSections } from '@/lib/customTabs/pratikYap';

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
 */
export function CustomTabPanel({ tab }: Props) {
  const router = useRouter();
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);
  const isPratikYap = tab.label === 'Pratik Yap';

  return (
    <div className="space-y-2">
      {isPratikYap && (
        <Link href="/play?mode=opening"
          className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ textDecoration: 'none', background: 'var(--t-surface-2)' }}>
          <span className="text-xl leading-none">📖</span>
          <span className="font-bold t-premium">Açılış Pratiği Yap</span>
        </Link>
      )}

      {tab.sections.length === 0 && !isPratikYap && (
        <p className="t-muted">Henüz içerik eklenmedi</p>
      )}

      {(isPratikYap ? sortPratikSections(tab.sections) : tab.sections).map((s) => {
        const open = openSectionId === s.id;
        const emoji = isPratikYap ? sectionEmoji(s.title) : null;
        return (
          <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--t-surface-2)' }}>
            <button type="button"
              onClick={() => setOpenSectionId((p) => (p === s.id ? null : s.id))}
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
                  s.practice_positions.length === 0 ? (
                    <p className="t-muted text-sm">Henüz konum eklenmedi.</p>
                  ) : (
                    <MatchCriteria
                      startLabel="Pratiğe Başla"
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

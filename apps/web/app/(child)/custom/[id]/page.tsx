'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import { PositionPoolPractice } from '@/components/play/PositionPoolPractice';

export default function CustomTabViewPage() {
  const params = useParams();
  const router = useRouter();
  const tabId = Number(params.id);
  const [tab, setTab] = useState<CustomTabDetail | null | undefined>(undefined);
  /** Tek seferde bir alt sekme açık — akordiyon. */
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);

  useEffect(() => {
    getCustomTab(tabId).then(setTab);
  }, [tabId]);

  if (tab === undefined) return <p className="t-muted p-4">Yükleniyor...</p>;
  if (tab === null) return <p className="text-rose-400 p-4">Sayfa bulunamadı</p>;

  const isPratikYap = tab.label === 'Pratik Yap';

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="text-sm t-muted">← Geri</button>
      <h1 className="text-2xl font-extrabold t-premium flex items-center gap-2">
        <span>{tab.emoji}</span> <span>{tab.label}</span>
      </h1>

      {isPratikYap && (
        <Link href="/play?mode=opening"
          className="flex items-center gap-3 p-4 rounded-2xl" style={{ textDecoration: 'none', background: 'var(--t-surface-2)' }}>
          <span className="text-xl leading-none">📖</span>
          <span className="font-bold t-premium">Açılış Pratiği Yap</span>
        </Link>
      )}

      {tab.sections.length === 0 ? (
        !isPratikYap && <p className="t-muted">Henüz içerik eklenmedi</p>
      ) : (
        <div className="space-y-2">
          {tab.sections.map((s) => {
            const open = openSectionId === s.id;
            return (
              <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--t-surface-2)' }}>
                <button type="button"
                  onClick={() => setOpenSectionId((p) => (p === s.id ? null : s.id))}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <span className="text-lg font-bold t-premium">{s.title}</span>
                  <span className="t-muted">{open ? '▴' : '▾'}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-3">
                    {isPratikYap ? (
                      <PositionPoolPractice positions={s.practice_positions} />
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
      )}
    </main>
  );
}

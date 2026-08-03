'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail } from '@/lib/customTabsApi';

export default function CustomTabViewPage() {
  const params = useParams();
  const router = useRouter();
  const tabId = Number(params.id);
  const [tab, setTab] = useState<CustomTabDetail | null | undefined>(undefined);

  useEffect(() => {
    getCustomTab(tabId).then(setTab);
  }, [tabId]);

  if (tab === undefined) return <p className="t-muted p-4">Yükleniyor...</p>;
  if (tab === null) return <p className="text-rose-400 p-4">Sayfa bulunamadı</p>;

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="text-sm t-muted">← Geri</button>
      <h1 className="text-2xl font-extrabold t-premium flex items-center gap-2">
        <span>{tab.emoji}</span> <span>{tab.label}</span>
      </h1>

      {tab.sections.length === 0 ? (
        <p className="t-muted">Henüz içerik eklenmedi</p>
      ) : (
        <div className="space-y-8">
          {tab.sections.map((s) => (
            <section key={s.id}>
              <h2 className="text-lg font-bold t-premium mb-2">{s.title}</h2>
              {s.body && <p className="t-muted whitespace-pre-wrap mb-3">{s.body}</p>}
              {s.images.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {s.images.map((uri, i) => (
                    <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                      className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import { CustomTabPanel } from '@/components/custom/CustomTabPanel';

export default function CustomTabViewPage() {
  const params = useParams();
  const tabId = Number(params.id);
  const [tab, setTab] = useState<CustomTabDetail | null | undefined>(undefined);

  useEffect(() => {
    getCustomTab(tabId).then(setTab);
  }, [tabId]);

  if (tab === undefined) return <p className="t-muted p-4">Yükleniyor...</p>;
  if (tab === null) return <p className="text-rose-400 p-4">Sayfa bulunamadı</p>;

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-6">
      {/* Madde 2026-09-04 (4): kendi "geri" linki kaldırıldı — AppNav'ın
       *  üst bar'ındaki TEK buton bu sayfada da geri gitmeyi sağlıyor. */}
      <h1 className="text-2xl font-extrabold t-premium flex items-center gap-2">
        <span>{tab.emoji}</span> <span>{tab.label}</span>
      </h1>
      <CustomTabPanel tab={tab} />
    </main>
  );
}

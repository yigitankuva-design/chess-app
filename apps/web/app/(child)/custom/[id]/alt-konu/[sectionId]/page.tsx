'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail, CustomTabSection } from '@/lib/customTabsApi';
import { AltKonuWalkthrough } from '@/components/custom/AltKonuWalkthrough';
import { writePendingOpenPath } from '@/lib/customTabs/pendingOpenPath';

/**
 * Madde 2026-08-25: Antrenör/Dersler/Düzey/Konu/Alt Konu'ya tıklanınca havuza
 * yüklenmiş sorular artık AYNI SAYFADA (akordiyon içinde) değil, bu AYRI
 * sayfada açılır — görsel referansa göre: solda numaralı açıklama kartları,
 * sağ üstte Konum Havuzu için İleri/Geri, altta notasyon alanı.
 */
export default function AltKonuPage() {
  const params = useParams();
  const router = useRouter();
  const tabId = Number(params.id);
  const sectionId = Number(params.sectionId);
  const [tab, setTab] = useState<CustomTabDetail | null | undefined>(undefined);

  useEffect(() => {
    getCustomTab(tabId).then(setTab);
  }, [tabId]);

  if (tab === undefined) return <p className="t-muted p-4">Yükleniyor...</p>;
  if (tab === null) return <p className="text-rose-400 p-4">Sayfa bulunamadı</p>;

  const section: CustomTabSection | undefined = tab.sections.find((s) => s.id === sectionId);
  if (!section) return <p className="text-rose-400 p-4">Bölüm bulunamadı</p>;

  /** Madde 2026-08-25: "Geri" Ana Menü'ye döner ama Antrenör/Dersler/Düzey/
   *  Konu zinciri AÇIK kalsın diye — üst bölümlerin (Alt Konu'nun KENDİSİ
   *  hariç) id zincirini kökten aşağı çıkarıp sessionStorage'a yazar. */
  function goBack() {
    const ancestorPath: number[] = [];
    let current = section;
    while (current?.parent_id != null) {
      const parent = tab?.sections.find((s) => s.id === current!.parent_id);
      if (!parent) break;
      ancestorPath.unshift(parent.id);
      current = parent;
    }
    writePendingOpenPath({ tabId, path: ancestorPath });
    router.push('/home');
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={goBack} aria-label="Geri"
          className="flex items-center justify-center rounded-full border border-white/15 t-muted flex-shrink-0"
          style={{ width: 36, height: 36 }}>
          ←
        </button>
        <h1 className="text-xl font-extrabold t-premium">{section.title}</h1>
      </div>
      {section.body && <p className="t-muted whitespace-pre-wrap text-sm">{section.body}</p>}
      {section.images.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {section.images.map((uri, i) => (
            <img key={i} src={uri} alt={`${section.title} görseli ${i + 1}`}
              className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
          ))}
        </div>
      )}
      <AltKonuWalkthrough pool={section.position_pool ?? []} />
    </main>
  );
}

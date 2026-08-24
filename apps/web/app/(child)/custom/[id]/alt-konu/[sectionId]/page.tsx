'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail, CustomTabSection } from '@/lib/customTabsApi';
import { AltKonuWalkthrough } from '@/components/custom/AltKonuWalkthrough';

/**
 * Madde 2026-08-25: Antrenör/Dersler/Düzey/Konu/Alt Konu'ya tıklanınca havuza
 * yüklenmiş sorular artık AYNI SAYFADA (akordiyon içinde) değil, bu AYRI
 * sayfada açılır — kod numarasına göre SIRALI İleri/Geri gezinme ile.
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

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-6">
      {/* Madde 2026-08-25: ana sayfaya değil, sekmenin kendi sayfasına döner
          — antrenör oradan Dersler→Düzey→Konu→Alt Konu'ya tekrar erişir. */}
      <button onClick={() => router.push(`/custom/${tabId}`)} className="text-sm t-muted">← Geri</button>
      {/* Madde 2026-08-25: başlığın solunda ikon/avatar YOK — sadece metin. */}
      <h1 className="text-2xl font-extrabold t-premium">{section.title}</h1>
      {section.body && <p className="t-muted whitespace-pre-wrap text-sm">{section.body}</p>}
      {section.images.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {section.images.map((uri, i) => (
            <img key={i} src={uri} alt={`${section.title} görseli ${i + 1}`}
              className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
          ))}
        </div>
      )}
      <AltKonuWalkthrough positions={section.practice_positions} exercises={section.board_exercises ?? []} />
    </main>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail, CustomTabSection } from '@/lib/customTabsApi';
import { AltKonuWalkthrough } from '@/components/custom/AltKonuWalkthrough';
import { writePendingOpenPath } from '@/lib/customTabs/pendingOpenPath';
import { useBackOverride } from '@/lib/nav/backOverride';
import { useAuth } from '@/lib/auth-context';

/**
 * Madde 2026-08-25: Antrenör/Dersler/Düzey/Konu/Alt Konu'ya tıklanınca havuza
 * yüklenmiş sorular artık AYNI SAYFADA (akordiyon içinde) değil, bu AYRI
 * sayfada açılır — görsel referansa göre: solda numaralı açıklama kartları,
 * sağ üstte Konum Havuzu için İleri/Geri, altta notasyon alanı.
 */
export default function AltKonuPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const tabId = Number(params.id);
  const sectionId = Number(params.sectionId);
  const [tab, setTab] = useState<CustomTabDetail | null | undefined>(undefined);
  /** Madde 2026-09-09 (görsel referans): "1/1 — Konum Havuzu 001" sayacı
   *  artık başlığın YANINDA — AltKonuWalkthrough'un KENDİ İÇİNDEKİ Konum
   *  Havuzu durumundan (grup/adım) hesaplanır, buraya callback ile bildirilir
   *  (bkz. AltKonuWalkthrough.tsx: Props.onPoolLabelChange). */
  const [poolLabel, setPoolLabel] = useState<string | null>(null);

  useEffect(() => {
    getCustomTab(tabId).then(setTab);
  }, [tabId]);

  const section: CustomTabSection | undefined = tab?.sections.find((s) => s.id === sectionId);

  /** Madde 2026-08-25: "Geri" Ana Menü'ye döner ama Antrenör/Dersler/Düzey/
   *  Konu zinciri AÇIK kalsın diye — üst bölümlerin (Alt Konu'nun KENDİSİ
   *  hariç) id zincirini kökten aşağı çıkarıp sessionStorage'a yazar. Madde
   *  2026-09-04 (4): bu sayfa ARTIK kendi geri butonunu ÇİZMİYOR — bu özel
   *  mantık `useBackOverride` ile AppNav'ın TEK butonuna kaydedilir. */
  function goBack() {
    if (!section) return;
    const ancestorPath: number[] = [];
    let current: CustomTabSection | undefined = section;
    while (current?.parent_id != null) {
      const parent = tab?.sections.find((s) => s.id === current!.parent_id);
      if (!parent) break;
      ancestorPath.unshift(parent.id);
      current = parent;
    }
    writePendingOpenPath({ tabId, path: ancestorPath });
    // Madde 2026-09-07 (Antrenör Paneli, 4): antrenör bu sayfaya /coach
    // üzerinden geldiyse "Geri" onu /home'a (sporcu sayfası) DEĞİL, kendi
    // /coach sayfasına döndürür.
    router.push(role === 'teacher' ? '/coach' : '/home');
  }

  // Hook'lar KOŞULSUZ çağrılmalı — erken return'lerden ÖNCE. Bölüm henüz
  // yüklenmediyse override devre dışı (AppNav'ın /custom varsayılanına düşer).
  useBackOverride(section ? goBack : null);

  if (tab === undefined) return <p className="t-muted p-4">Yükleniyor...</p>;
  if (tab === null) return <p className="text-rose-400 p-4">Sayfa bulunamadı</p>;
  if (!section) return <p className="text-rose-400 p-4">Bölüm bulunamadı</p>;

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-4">
      {/* Madde 2026-09-11 (Görsel Turu A/1): başlık ORTALANDI, Konum Havuzu
          sayacı başlığın ALTINA (ortalı, küçük) taşındı, ayırıcı çizgi
          KALDIRILDI — Zafer'in mobil görseli. Eski düzende (başlık solda,
          sayaç sağda, altta çizgi) sayaç yan yer kapladığı için başlık
          telefonda iki satıra kırılıyordu. Sayaç, sadece bir Konum Havuzu
          varken gösterilir. */}
      <div className="text-center">
        <h1 className="text-xl font-extrabold t-premium">{section.title}</h1>
        {poolLabel && (
          <p className="text-xs t-muted mt-0.5" style={{ fontWeight: 600 }}>{poolLabel}</p>
        )}
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
      {/* Madde 2026-09-07 (GRUP D): antrenör "Ödev Gönder" ikonunu görebilsin
          diye bu bölümün id/başlığı geçiriliyor — AltKonuWalkthrough bunu
          SADECE role === 'teacher' iken kullanır (çocuk görmez).
          Madde 2026-09-09: onPoolLabelChange ile Konum Havuzu sayacı artık
          yukarıdaki başlık satırında gösteriliyor (bkz. Props açıklaması). */}
      <AltKonuWalkthrough
        pool={section.position_pool ?? []}
        sourceSectionId={section.id}
        sourceSectionTitle={section.title}
        sourceTabId={tabId}
        linkedLessonStepId={section.linked_lesson_step_id ?? null}
        onPoolLabelChange={setPoolLabel}
      />
    </main>
  );
}

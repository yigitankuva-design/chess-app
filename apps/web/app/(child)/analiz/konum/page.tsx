'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { useSettings } from '@/lib/settings/settings-context';
import { CustomPositionAnalysis } from '@/components/analiz/CustomPositionAnalysis';

/** Madde 2026-09-02 (5): "Konum Analizi" — ayrı sayfa (konum ekleme + analiz
 *  hep bu sayfada). */
export default function KonumAnalizPage() {
  useTabGuard('analiz');
  const router = useRouter();
  const { settings } = useSettings();
  useEffect(() => {
    if (settings.analizFeatures.position === false) router.replace('/home');
  }, [settings.analizFeatures.position, router]);

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      {/* Madde 2026-09-04 (4): kendi "geri" butonu kaldırıldı — AppNav'ın
       *  üst bar'ındaki TEK buton bu sayfada da geri gitmeyi sağlıyor. */}
      <h1 className="text-xl font-extrabold t-premium text-center">Konum Analizi</h1>
      <hr className="t-line" />
      <CustomPositionAnalysis />
    </main>
  );
}

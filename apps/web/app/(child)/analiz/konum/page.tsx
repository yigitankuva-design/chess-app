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
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/home')} aria-label="Geri"
          className="flex items-center justify-center rounded-full border border-white/15 t-premium flex-shrink-0"
          style={{ width: 36, height: 36, fontSize: '1.35rem', fontWeight: 700 }}>
          ←
        </button>
        <h1 className="text-xl font-extrabold t-premium">Konum Analizi</h1>
      </div>
      <CustomPositionAnalysis />
    </main>
  );
}

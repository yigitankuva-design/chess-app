'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { useSettings } from '@/lib/settings/settings-context';
import { FreePlayAnalysis } from '@/components/analiz/FreePlayAnalysis';
import { AnalizPageHeader } from '@/components/analiz/AnalizPageHeader';

/** Madde 2026-09-02 (1/2/3): "Yeni Analiz" — ayrı sayfa, kayıtlı maç YOK,
 *  sıfırdan/ilk hamleden serbest analiz. */
export default function YeniAnalizPage() {
  useTabGuard('analiz');
  const router = useRouter();
  const { settings } = useSettings();
  // Madde 2026-09-05 (3): admin bu özelliği kapattıysa doğrudan URL ile
  // girişi de /home'a yönlendirir (analiz sekmesindeki toggle deseninin aynısı).
  useEffect(() => {
    if (settings.analizFeatures.freePlay === false) router.replace('/home');
  }, [settings.analizFeatures.freePlay, router]);

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <AnalizPageHeader title="Yeni Analiz" onBack={() => router.push('/home')} />
      <FreePlayAnalysis />
    </main>
  );
}

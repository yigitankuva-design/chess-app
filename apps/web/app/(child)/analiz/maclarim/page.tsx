'use client';
import { useRouter } from 'next/navigation';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { GameAnalysisSection } from '@/components/analiz/GameAnalysisSection';
import { AnalizPageHeader } from '@/components/analiz/AnalizPageHeader';

/** Madde 2026-09-02 (4): "Maçlarımın Analizi" — ayrı sayfa (maç listesi +
 *  seçilen maçın incelemesi hep bu sayfada). */
export default function MaclarimAnalizPage() {
  useTabGuard('analiz');
  const router = useRouter();

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <AnalizPageHeader title="Maçlarımın Analizi" onBack={() => router.push('/home')} />
      <GameAnalysisSection />
    </main>
  );
}

'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { useSettings } from '@/lib/settings/settings-context';
import { GameAnalysisSection } from '@/components/analiz/GameAnalysisSection';
import { AnalizPageHeader } from '@/components/analiz/AnalizPageHeader';

/** Madde 2026-09-02 (4): "Maçlarımın Analizi" — ayrı sayfa (maç listesi +
 *  seçilen maçın incelemesi hep bu sayfada). */
export default function MaclarimAnalizPage() {
  useTabGuard('analiz');
  const router = useRouter();
  const { settings } = useSettings();
  const searchParams = useSearchParams();
  // Madde 2026-09-03 (2): BotGame'in "Analiz Et" özet kartındaki CTA'sından
  // ?gameId= ile gelinince, listeye bakmadan doğrudan o maç açılır.
  const gameIdParam = searchParams.get('gameId');
  const initialGameId = gameIdParam ? Number(gameIdParam) : null;
  useEffect(() => {
    if (settings.analizFeatures.matches === false) router.replace('/home');
  }, [settings.analizFeatures.matches, router]);

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <AnalizPageHeader title="Maçlarımın Analizi" onBack={() => router.push('/home')} />
      <GameAnalysisSection initialGameId={initialGameId} />
    </main>
  );
}

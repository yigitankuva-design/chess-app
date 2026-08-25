'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { AnalysisBoard } from '@/components/analiz/AnalysisBoard';
import { AnalizPageHeader } from '@/components/analiz/AnalizPageHeader';

/** Madde 2026-09-03 (7): "Konum Analizi"nde Analiz Et'e basınca konum ekleme
 *  ekranıyla AYNI sayfada DEĞİL, buraya (ayrı bir sayfaya) gelinir — FEN
 *  adres parametresiyle taşınır. */
function KonumSonucInner() {
  useTabGuard('analiz');
  const router = useRouter();
  const fen = useSearchParams().get('fen');

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <AnalizPageHeader title="Konum Analizi" onBack={() => router.push('/analiz/konum')} />
      {fen ? <AnalysisBoard fen={fen} /> : <p className="text-sm t-muted">Analiz edilecek bir konum bulunamadı.</p>}
    </main>
  );
}

export default function KonumAnalizSonucPage() {
  return (
    <Suspense fallback={<main className="px-4 pt-5 max-w-lg mx-auto"><p className="text-sm t-muted">Yükleniyor...</p></main>}>
      <KonumSonucInner />
    </Suspense>
  );
}

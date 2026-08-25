'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { AnalysisBoard } from '@/components/analiz/AnalysisBoard';

/** Madde 2026-09-03 (7): "Konum Analizi"nde Analiz Et'e basınca konum ekleme
 *  ekranıyla AYNI sayfada DEĞİL, buraya (ayrı bir sayfaya) gelinir — FEN
 *  adres parametresiyle taşınır. */
function KonumSonucInner() {
  useTabGuard('analiz');
  const router = useRouter();
  const fen = useSearchParams().get('fen');

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/analiz/konum')} aria-label="Geri"
          className="flex items-center justify-center rounded-full border border-white/15 t-premium flex-shrink-0"
          style={{ width: 36, height: 36, fontSize: '1.35rem', fontWeight: 700 }}>
          ←
        </button>
        <h1 className="text-xl font-extrabold t-premium">Konum Analizi</h1>
      </div>
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

'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OdevGonderInner } from '@/components/OdevGonderInner';

/** Route sayfası: `section` query param'ını okuyup gerçek görünüm
 *  bileşenine (`components/OdevGonderInner.tsx`) prop olarak iletir —
 *  bkz. o dosyadaki Faz C açıklaması. */
export default function OdevGonderPage() {
  return (
    <Suspense fallback={<main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Yükleniyor…</p></main>}>
      <OdevGonderRouteInner />
    </Suspense>
  );
}

function OdevGonderRouteInner() {
  const params = useSearchParams();
  return <OdevGonderInner sectionId={Number(params.get('section'))} />;
}

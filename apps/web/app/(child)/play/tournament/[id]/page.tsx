'use client';
import { use } from 'react';
import { TournamentDetailView } from '@/components/play/TournamentDetailView';

/** Canlı turnuva sayfası — Lichess Arena modeli: round yok, geri sayım +
 *  sıralama + "rakip aranıyor" kuyruğu (bkz. TournamentDetailView).
 *
 *  DİKKAT: page.tsx yalnızca `default` (ve Next'in izin verdiği birkaç ad)
 *  export edebilir. Görünüm bileşeni bu yüzden components/ altında durur —
 *  buradan export edilirse ÜRETİM DERLEMESİ KIRILIR (2026-08-28 Vercel hatası);
 *  play/online/[gameId]/page.tsx'teki LiveGame deseniyle AYNI. */
export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TournamentDetailView tournamentId={Number(id)} />;
}

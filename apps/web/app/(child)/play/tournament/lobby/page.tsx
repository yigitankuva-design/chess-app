'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listTournaments, joinTournament } from '@/lib/tournamentsApi';
import type { TournamentSummary } from '@/lib/tournamentsApi';

const STATUS_LABEL: Record<TournamentSummary['status'], string> = {
  upcoming: 'Başlamadı',
  active: 'Devam ediyor',
  finished: 'Bitti',
};

function tempoLabel(baseMs: number | null, incrementMs: number | null): string {
  if (baseMs == null) return 'Süresiz';
  const min = Math.round(baseMs / 60000);
  const inc = incrementMs ? Math.round(incrementMs / 1000) : 0;
  return `${min}+${inc}`;
}

/** "Turnuvaya Katıl" lobisi — Lichess Arena modeli (2026-09-05): başka
 *  sporcuların (aynı hocaya bağlı) oluşturduğu turnuvaları listeler, "Katıl"
 *  ile otomatik katılım sağlar. Kart tasarımı Zafer'in göndereceği görsele
 *  göre İNCELTİLECEK — şimdilik işlevsel, mevcut t-card-i dilinde. */
export default function TournamentLobbyPage() {
  const router = useRouter();
  const [list, setList] = useState<TournamentSummary[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { listTournaments().then(setList); }, []);

  async function join(id: number) {
    setBusyId(id); setMsg(null);
    const ok = await joinTournament(id);
    setBusyId(null);
    if (!ok) { setMsg('Katılamadın, tekrar dene.'); return; }
    router.push(`/play/tournament/${id}`);
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <p className="font-semibold text-sm">🔎 Turnuvaya Katıl</p>

      {list === null ? (
        <p className="text-sm t-muted">Yükleniyor...</p>
      ) : list.length === 0 ? (
        <div className="t-card-i p-5 text-center space-y-2">
          <p className="text-3xl">🏆</p>
          <p className="text-sm t-muted">Şu anda katılabileceğin bir turnuva yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <div key={t.id} className="t-card-i p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs t-muted mt-0.5">
                  {STATUS_LABEL[t.status]} · {t.duration_minutes} dk · {tempoLabel(t.base_ms, t.increment_ms)}
                  {t.rated && <> · 🏆 Puanlı</>}
                </p>
              </div>
              {t.joined ? (
                <button type="button" onClick={() => router.push(`/play/tournament/${t.id}`)}
                  className="t-btn-ghost px-3 py-2 text-xs flex-shrink-0">
                  Aç
                </button>
              ) : t.status !== 'finished' ? (
                <button type="button" disabled={busyId === t.id} onClick={() => join(t.id)}
                  className="t-btn px-3 py-2 text-xs flex-shrink-0">
                  {busyId === t.id ? '...' : 'Katıl'}
                </button>
              ) : (
                <span className="text-xs t-muted flex-shrink-0">Bitti</span>
              )}
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-sm" style={{ color: 'var(--t-accent)' }}>{msg}</p>}
    </main>
  );
}

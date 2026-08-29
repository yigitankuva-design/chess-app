'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listTournaments, joinTournament } from '@/lib/tournamentsApi';
import type { TournamentSummary } from '@/lib/tournamentsApi';
import { useSettings } from '@/lib/settings/settings-context';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "15:45" — Zafer'in düzeltmesi: saat+dakika, "15" tek başına değil. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatTempo(baseMs: number | null): string {
  if (baseMs == null) return 'Süresiz';
  return `${Math.round(baseMs / 60000)} dk`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} saat` : `${h} saat ${m} dk`;
}

function formatRemaining(seconds: number): string {
  return `${Math.max(0, Math.round(seconds / 60))} dk kaldı`;
}

const rowStyle: React.CSSProperties = { background: '#1c1c1e', color: '#fff' };

interface TableProps {
  rows: TournamentSummary[];
  showRemaining: boolean;
  actionColumnLabel: string;
  mode: 'joinable' | 'finished';
  busyId: number | null;
  onJoin: (id: number) => void;
  onOpen: (id: number) => void;
}

function TournamentTable({ rows, showRemaining, actionColumnLabel, mode, busyId, onJoin, onOpen }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          {/* Madde 2026-09-08 (4b): başlıklar ortalı, sadece baş harf büyük. */}
          <tr className="text-center">
            <th className="px-3 py-2 text-xs font-semibold t-muted tracking-wide">{actionColumnLabel}</th>
            <th className="px-3 py-2 text-xs font-semibold t-muted tracking-wide">Saat</th>
            <th className="px-3 py-2 text-xs font-semibold t-muted tracking-wide">Turnuva ismi</th>
            <th className="px-3 py-2 text-xs font-semibold t-muted tracking-wide">Tempo</th>
            <th className="px-3 py-2 text-xs font-semibold t-muted tracking-wide">Toplam süre</th>
            {showRemaining && (
              <th className="px-3 py-2 text-xs font-semibold t-muted tracking-wide">Kalan süre</th>
            )}
            <th className="px-3 py-2 text-xs font-semibold t-muted tracking-wide">Katılımcı sayısı</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.id} style={{ ...rowStyle, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.12)' : undefined }}>
              {/* Madde 2026-09-08 (4a): aksiyon sütunu tablonun BAŞINA taşındı. */}
              <td className="px-3 py-3">
                {mode === 'finished' ? (
                  <button type="button" onClick={() => onOpen(t.id)}
                    className="px-4 py-2 rounded-md text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
                    Görüntüle
                  </button>
                ) : t.joined ? (
                  <button type="button" onClick={() => onOpen(t.id)}
                    className="px-4 py-2 rounded-md text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
                    Aç
                  </button>
                ) : (
                  <button type="button" disabled={busyId === t.id} onClick={() => onJoin(t.id)}
                    className="px-4 py-2 rounded-md text-xs font-bold disabled:opacity-50"
                    style={{ background: 'var(--t-accent)', color: '#fff' }}>
                    {busyId === t.id ? '...' : 'Katıl'}
                  </button>
                )}
              </td>
              <td className="px-3 py-3">{formatTime(t.starts_at)}</td>
              <td className="px-3 py-3 font-semibold">{t.name}</td>
              <td className="px-3 py-3" style={{ opacity: 0.8 }}>{formatTempo(t.base_ms)}</td>
              <td className="px-3 py-3" style={{ opacity: 0.8 }}>{formatDuration(t.duration_minutes)}</td>
              {showRemaining && (
                <td className="px-3 py-3" style={{ opacity: 0.8 }}>{formatRemaining(t.seconds_remaining)}</td>
              )}
              <td className="px-3 py-3" style={{ opacity: 0.8 }}>{t.participant_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Turnuvaya Katıl" lobisi — Zafer'in gönderdiği tablo görseline göre.
 *  Madde 2026-09-07: 3 ayrı bölüm — Aktif (görseldeki AYNI tablo), Yaklaşan
 *  (henüz başlamamış, "Kalan Süre" sütunu yok, hâlâ katılınabilir) ve Biten
 *  (salt-okunur, "Görüntüle" ile sıralamaya bakılabilir). İkon YOK (madde 2);
 *  saat "15:45" formatında (madde 1); Tempo kutusu filtre görevi görür
 *  (madde 3) — üç bölümü de AYNI anda filtreler. */
export default function TournamentLobbyPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const timeGroups = settings.play.timeGroups;
  const [list, setList] = useState<TournamentSummary[] | null>(null);
  const [search, setSearch] = useState('');
  const [tempoFilter, setTempoFilter] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { listTournaments().then(setList); }, []);

  const matches = (t: TournamentSummary) => {
    const matchesSearch = t.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesTempo = !tempoFilter || t.tempo === tempoFilter;
    return matchesSearch && matchesTempo;
  };
  const active = useMemo(() => (list ?? []).filter((t) => t.status === 'active' && matches(t)),
    [list, search, tempoFilter]);
  const upcoming = useMemo(() => (list ?? []).filter((t) => t.status === 'upcoming' && matches(t)),
    [list, search, tempoFilter]);
  const finished = useMemo(() => (list ?? []).filter((t) => t.status === 'finished' && matches(t)),
    [list, search, tempoFilter]);

  async function join(id: number) {
    setBusyId(id); setMsg(null);
    const ok = await joinTournament(id);
    setBusyId(null);
    if (!ok) { setMsg('Katılamadın, tekrar dene.'); return; }
    router.push(`/play/tournament/${id}`);
  }

  function open(id: number) {
    router.push(`/play/tournament/${id}`);
  }

  const nothingToShow = list !== null && active.length === 0 && upcoming.length === 0 && finished.length === 0;

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text)' }}>Aktif Turnuvalar</h1>
        <div className="mt-2" style={{ borderTop: '3px solid var(--t-text)' }} />
      </div>

      <div className="flex gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara"
          className="flex-1 px-4 py-2.5 rounded-lg text-sm"
          style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text)' }} />
        <select value={tempoFilter} onChange={(e) => setTempoFilter(e.target.value)}
          aria-label="Tempo"
          className="px-4 py-2.5 rounded-lg text-sm font-bold"
          style={{ border: '2px solid var(--t-text)', background: 'var(--t-surface)', color: 'var(--t-text)' }}>
          <option value="">Tempo</option>
          {timeGroups.map((g) => <option key={g.cat} value={g.cat}>{g.cat}</option>)}
        </select>
      </div>

      {list === null ? (
        <p className="text-sm t-muted">Yükleniyor...</p>
      ) : nothingToShow ? (
        <div className="t-card-i p-5 text-center space-y-2">
          <p className="text-3xl">🏆</p>
          <p className="text-sm t-muted">Şu anda görebileceğin bir turnuva yok.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <TournamentTable rows={active} showRemaining actionColumnLabel="Katılım isteği"
              mode="joinable" busyId={busyId} onJoin={join} onOpen={open} />
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--t-text)' }}>Yaklaşan Turnuvalar</h2>
              <TournamentTable rows={upcoming} showRemaining={false} actionColumnLabel="Katılım isteği"
                mode="joinable" busyId={busyId} onJoin={join} onOpen={open} />
            </div>
          )}

          {finished.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--t-text)' }}>Biten Turnuvalar</h2>
              <TournamentTable rows={finished} showRemaining={false} actionColumnLabel="Sonuç"
                mode="finished" busyId={busyId} onJoin={join} onOpen={open} />
            </div>
          )}
        </>
      )}
      {msg && <p className="text-sm" style={{ color: 'var(--t-accent)' }}>{msg}</p>}
    </main>
  );
}

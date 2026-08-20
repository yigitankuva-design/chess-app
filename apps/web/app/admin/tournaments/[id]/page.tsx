'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Standing { child_id: number; display_name: string; score: number }
interface Pairing {
  id: number; white_child_id: number; white_name: string;
  black_child_id: number | null; black_name: string | null;
  game_id: number | null; result: string | null;
}
interface TournamentDetail {
  id: number; name: string; rounds_total: number;
  base_ms: number | null; increment_ms: number | null;
  status: 'upcoming' | 'active' | 'finished'; current_round: number | null;
  standings: Standing[];
  pairings_by_round: Record<string, Pairing[]>;
}

export default function AdminTournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [t, setT] = useState<TournamentDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/tournaments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 404) { setNotFound(true); return; }
    if (r.ok) setT(await r.json());
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  async function post(path: string) {
    setBusy(true); setMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/tournaments/${id}${path}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(typeof d.detail === 'string' ? d.detail : 'İşlem başarısız');
        setBusy(false);
        return;
      }
      await refresh();
    } catch {
      setMsg('İşlem başarısız');
    }
    setBusy(false);
  }

  if (notFound) return <p className="text-rose-400">Turnuva bulunamadı.</p>;
  if (!t) return <p className="n-muted">Yükleniyor...</p>;

  const currentRoundPairings = t.current_round !== null ? t.pairings_by_round[String(t.current_round)] ?? [] : [];
  const currentRoundDone = currentRoundPairings.length > 0 && currentRoundPairings.every((p) => p.result);
  const rounds = Object.keys(t.pairings_by_round).map(Number).sort((a, b) => b - a);

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-1 n-text">{t.name}</h1>
      <p className="text-sm n-muted mb-6">
        {t.rounds_total} tur · {t.base_ms ? `${Math.round(t.base_ms / 60000)}+${Math.round((t.increment_ms ?? 0) / 1000)}` : 'Süresiz'} ·{' '}
        {t.status === 'upcoming' && 'Katılım bekleniyor'}
        {t.status === 'active' && `${t.current_round}. tur devam ediyor`}
        {t.status === 'finished' && 'Turnuva bitti'}
      </p>

      {msg && <p className="text-sm text-rose-400 mb-4">{msg}</p>}

      {t.status === 'upcoming' && (
        <div className="neon-card neon-green p-5 mb-6">
          <p className="font-bold n-text mb-2">{t.standings.length} sporcu katıldı</p>
          <p className="text-xs n-muted mb-3">Sporcular kendi ekranlarından turnuvaya katılır. En az 2 kişi katılınca başlatabilirsin.</p>
          <button onClick={() => post('/start')} disabled={busy || t.standings.length < 2}
            className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50 transition-colors text-sm">
            Turnuvayı Başlat
          </button>
        </div>
      )}

      {t.status === 'active' && (
        <div className="neon-card neon-amber p-5 mb-6">
          <p className="font-bold n-text mb-2">
            {currentRoundDone ? 'Bu turun tüm eşleşmeleri sonuçlandı' : `${currentRoundPairings.filter((p) => !p.result).length} eşleşme bekleniyor`}
          </p>
          <button onClick={() => post('/next-round')} disabled={busy || !currentRoundDone}
            className="px-4 py-2 rounded-lg bg-amber-400/15 text-amber-200 border border-amber-400/50 hover:bg-amber-400/25 disabled:opacity-50 transition-colors text-sm">
            {t.current_round === t.rounds_total ? 'Turnuvayı Bitir' : 'Sonraki Tur'}
          </button>
        </div>
      )}

      <div className="neon-card neon-cyan p-5 mb-6">
        <h2 className="font-bold mb-3 n-text">Sıralama</h2>
        {t.standings.length === 0 ? (
          <p className="text-sm n-muted">Henüz katılımcı yok.</p>
        ) : (
          <div className="space-y-1.5">
            {t.standings.map((s, i) => (
              <div key={s.child_id} className="flex items-center gap-3 text-sm">
                <span className="n-muted w-6 text-right">{i + 1}.</span>
                <span className="flex-1 n-text">{s.display_name}</span>
                <span className="font-semibold n-text">{s.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {rounds.map((round) => (
        <div key={round} className="neon-card neon-purple p-5 mb-4">
          <h2 className="font-bold mb-3 n-text">{round}. Tur</h2>
          <div className="space-y-2">
            {t.pairings_by_round[String(round)].map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 n-text">
                  {p.white_name} {p.black_name ? `— ${p.black_name}` : '(bay geçti)'}
                </span>
                <span className={p.result ? 'neon-pill neon-green' : 'neon-pill neon-amber'}>
                  {p.result ?? 'Bekliyor'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

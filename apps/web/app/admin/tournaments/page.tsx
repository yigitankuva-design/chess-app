'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';
import { TIME_GROUPS } from '@/lib/play/levels';
import type { TimeControl } from '@/components/BotGame';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface TournamentRow {
  id: number;
  name: string;
  rounds_total: number;
  base_ms: number | null;
  increment_ms: number | null;
  status: 'upcoming' | 'active' | 'finished';
  current_round: number | null;
  rated: boolean;
  tempo: string | null;
}

const STATUS_LABEL: Record<TournamentRow['status'], string> = {
  upcoming: 'Bekliyor', active: 'Devam ediyor', finished: 'Bitti',
};
const STATUS_PILL: Record<TournamentRow['status'], string> = {
  upcoming: 'neon-amber', active: 'neon-green', finished: 'neon-purple',
};

export default function AdminTournamentsPage() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState('4');
  const [tc, setTc] = useState<TimeControl | null>(null);
  const [rated, setRated] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/tournaments`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setRows(await r.json());
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function create() {
    if (name.trim().length < 1 || !tc) return;
    const roundsNum = Number(rounds);
    if (!Number.isInteger(roundsNum) || roundsNum < 1) { setMsg('Tur sayısı 1 veya daha büyük olmalı'); return; }
    setBusy(true); setMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(), rounds_total: roundsNum,
          base_ms: tc.base * 1000, increment_ms: tc.increment * 1000,
          rated,
        }),
      });
      if (!r.ok) { setMsg('Turnuva oluşturulamadı'); setBusy(false); return; }
      setName(''); setRounds('4'); setTc(null); setRated(true);
      await refresh();
      setMsg('Turnuva oluşturuldu');
    } catch {
      setMsg('Turnuva oluşturulamadı');
    }
    setBusy(false);
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const pill = (active: boolean) => `py-2.5 rounded-lg text-sm font-bold transition-all border ${
    active
      ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200'
      : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
  }`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 n-text">Turnuvalar</h1>

      <div className="neon-card neon-cyan p-5 mb-6">
        <h2 className="font-bold mb-3 n-text">Yeni turnuva oluştur</h2>
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Turnuva adı (örn. Yaz Turnuvası)" className="neon-input sm:col-span-2" />
          <div>
            <label className="text-xs n-muted block mb-1">Tur sayısı</label>
            <input type="number" min={1} value={rounds} onChange={(e) => setRounds(e.target.value)}
              className="neon-input w-full" />
          </div>
        </div>

        <div className="space-y-3 mb-3">
          <p className="text-xs n-muted uppercase tracking-wide">Tempo ve Süre</p>
          {TIME_GROUPS.map((g) => (
            <div key={g.cat} className="space-y-1.5">
              <p className="text-xs n-muted flex items-center gap-1.5">
                <span>{g.emoji}</span> {g.cat}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map((item) => (
                  <button key={item.label} type="button" onClick={() => setTc(item)}
                    className={pill(tc?.label === item.label)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <p className="text-xs n-muted uppercase tracking-wide mb-1.5">Oyun Modu</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRated(true)} className={pill(rated)}>
              🏆 Puanlı
            </button>
            <button type="button" onClick={() => setRated(false)} className={pill(!rated)}>
              Puansız
            </button>
          </div>
          {rated && (
            <p className="text-xs n-muted mt-1.5">
              Bu turnuvadaki maçlar sporcuların Performans Puanını (seçilen tempo türünde) etkiler.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={create} disabled={busy || name.trim().length < 1 || !tc}
            className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 transition-colors text-sm">
            {busy ? 'Oluşturuluyor...' : 'Turnuva oluştur'}
          </button>
          {msg && <span className="text-sm n-muted">{msg}</span>}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="n-muted">Henüz turnuva yok.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((t) => (
            <Link key={t.id} href={`/admin/tournaments/${t.id}`} className="neon-card neon-purple p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold n-text">{t.name}</p>
                <p className="text-xs n-muted mt-0.5">
                  {t.rounds_total} tur · {t.base_ms ? `${Math.round(t.base_ms / 60000)}+${Math.round((t.increment_ms ?? 0) / 1000)}` : 'Süresiz'}
                  {t.rated && ' · 🏆 Puanlı'}
                  {t.status === 'active' && t.current_round !== null && ` · ${t.current_round}. tur`}
                </p>
              </div>
              <span className={`neon-pill ${STATUS_PILL[t.status]}`}>{STATUS_LABEL[t.status]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

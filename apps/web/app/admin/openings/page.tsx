'use client';
import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Opening { id: number; name: string; start_fen: string }

export default function AdminOpeningsPage() {
  const [list, setList] = useState<Opening[]>([]);
  const [name, setName] = useState('');
  const [fen, setFen] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/openings`);
      setList(r.ok ? await r.json() : []);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    setErr(null); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/admin/openings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, start_fen: fen }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setErr(body.detail ?? 'Eklenemedi');
        return;
      }
      setName(''); setFen(''); setMsg('Açılış eklendi');
      await load();
    } catch {
      setErr('Eklenemedi');
    }
  }

  async function remove(id: number) {
    try {
      await fetch(`${API_BASE}/admin/openings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await load();
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-bold n-text text-lg">Açılış Listesi</h2>
      <p className="text-xs n-muted">
        Sporcuların &ldquo;Açılışı Pratiği Yap&rdquo; bölümünde seçeceği açılışlar.
        FEN, açılışın oynanacağı başlangıç pozisyonudur.
      </p>

      <div className="neon-card neon-green p-5 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Açılış adı (örn. İtalyan Açılışı)" className="neon-input" />
        <input value={fen} onChange={(e) => setFen(e.target.value)}
          placeholder="Başlangıç FEN'i" className="neon-input" />
        {err && <p className="text-rose-400 text-sm">{err}</p>}
        {msg && <p className="text-green-300 text-sm">{msg}</p>}
        <button type="button" onClick={add}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm">
          Açılış ekle
        </button>
      </div>

      <div className="space-y-2">
        {list.length === 0 && <p className="text-xs n-muted">Henüz açılış eklenmedi.</p>}
        {list.map((o) => (
          <div key={o.id} className="neon-card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm n-text">{o.name}</p>
              <p className="text-xs n-muted break-all">{o.start_fen}</p>
            </div>
            <button type="button" onClick={() => remove(o.id)}
              className="px-3 py-1.5 rounded-lg text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40">
              Sil
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ModuleRow { id: number; order_index: number; name: string; lesson_count: number; }

export default function AdminContentPage() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/content`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function downloadContent() {
    setMsg(null);
    setBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/admin/content/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setMsg('İndirme başarısız'); setBusy(false); return; }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agep-icerik-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('İçerik indirildi');
    } catch {
      setMsg('İndirme başarısız');
    }
    setBusy(false);
  }

  async function uploadContent(file: File) {
    setMsg(null);
    if (!confirm('Bu işlem mevcut içeriği günceller (hiçbir şey silinmez). Devam?')) return;
    setBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const token = getToken();
      const res = await fetch(`${API_BASE}/admin/content/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version: json.version, modules: json.modules }),
      });
      if (!res.ok) { setMsg('Yükleme başarısız'); setBusy(false); return; }
      const r = await res.json();
      setMsg(
        `${r.modules_updated} modül güncellendi, ${r.modules_created} eklendi · ` +
        `${r.lessons_updated} ders güncellendi, ${r.lessons_created} eklendi · ` +
        `${r.steps_updated} adım güncellendi, ${r.steps_created} eklendi`
      );
      const fresh = await fetch(`${API_BASE}/admin/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fresh.ok) setRows(await fresh.json());
    } catch {
      setMsg('Yükleme başarısız (dosya geçersiz olabilir)');
    }
    setBusy(false);
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const accents = ['neon-cyan', 'neon-purple', 'neon-green', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 n-text">İçerik (Modüller)</h1>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button onClick={downloadContent} disabled={busy}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 transition-colors text-sm">
          İçeriği indir
        </button>
        <label className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 transition-colors text-sm cursor-pointer">
          İçerik yükle
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadContent(f);
              e.target.value = '';
            }}
          />
        </label>
        {msg && <span className="text-sm n-muted">{msg}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="n-muted">Modül bulunamadı.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((m, i) => {
            const accent = accents[i % accents.length];
            return (
              <Link
                key={m.id}
                href={`/admin/content/${m.id}`}
                className={`neon-card neon-card-i ${accent} flex items-center gap-4 p-4`}
              >
                <span className={`neon-avatar ${accent} w-11 h-11 text-sm shrink-0`}>
                  {m.order_index}
                </span>
                <p className="font-semibold n-text flex-1">{m.name}</p>
                <span className={`neon-pill ${accent}`}>{m.lesson_count} ders →</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

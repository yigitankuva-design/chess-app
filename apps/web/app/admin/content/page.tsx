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
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  async function refresh() {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/content`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setRows(await r.json());
  }

  async function addModule() {
    if (newName.trim().length < 1) return;
    setAdding(true);
    setMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), description: '', icon: 'default' }),
      });
      if (!r.ok) { setMsg('Düzey eklenemedi'); setAdding(false); return; }
      setNewName('');
      await refresh();
      setMsg('Düzey eklendi');
    } catch {
      setMsg('Düzey eklenemedi');
    }
    setAdding(false);
  }

  async function deleteModule(id: number, name: string) {
    if (!confirm(`"${name}" düzeyini silmek istiyor musun?`)) return;
    setMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/modules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 409) { setMsg('Bu düzeyde ders var. Önce dersleri taşıyın veya silin.'); return; }
      if (!r.ok) { setMsg('Silinemedi'); return; }
      await refresh();
      setMsg('Düzey silindi');
    } catch {
      setMsg('Silinemedi');
    }
  }

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

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Yeni düzey adı (örn. İleri Düzey)"
          className="neon-input max-w-xs"
        />
        <button onClick={addModule} disabled={adding || newName.trim().length < 1}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 transition-colors text-sm">
          {adding ? 'Ekleniyor...' : 'Düzey ekle'}
        </button>
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
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteModule(m.id, m.name); }}
                  aria-label={`${m.name} düzeyini sil`}
                  className="ml-2 px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs transition-colors"
                >
                  Sil
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

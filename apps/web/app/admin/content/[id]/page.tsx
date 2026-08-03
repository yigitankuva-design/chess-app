'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { InlineTitleEdit } from '@/components/admin/InlineTitleEdit';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface LessonRow {
  id: number;
  module_id: number;
  order_index: number;
  title: string;
  estimated_minutes: number;
  published: boolean;
  step_count: number;
}

interface ModuleRow { id: number; order_index: number; name: string; lesson_count: number; }

export default function AdminModuleLessonsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/modules/${id}/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 404) { setNotFound(true); setLoading(false); return; }
    if (r.ok) setRows(await r.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    const token = getToken();
    fetch(`${API_BASE}/admin/content`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setModules(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [refresh]);

  async function addLesson() {
    if (newTitle.trim().length < 1) return;
    setBusy(true); setMsg(null);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/modules/${id}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim(), estimated_minutes: 10 }),
      });
      if (!r.ok) { setMsg('Ders eklenemedi'); setBusy(false); return; }
      setNewTitle('');
      await refresh();
      setMsg('Ders eklendi (taslak)');
    } catch { setMsg('Ders eklenemedi'); }
    setBusy(false);
  }

  async function togglePublish(les: LessonRow) {
    setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${les.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ published: !les.published }),
    });
    if (!r.ok) { setMsg('İşlem başarısız'); return; }
    await refresh();
  }

  async function moveLesson(les: LessonRow, moduleId: number) {
    setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${les.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ module_id: moduleId }),
    });
    if (!r.ok) { setMsg('Taşınamadı'); return; }
    await refresh();
    setMsg('Ders taşındı');
  }

  async function renameLesson(les: LessonRow, title: string): Promise<boolean> {
    const token = getToken();
    try {
      const r = await fetch(`${API_BASE}/admin/lessons/${les.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title }),
      });
      if (!r.ok) return false;
      await refresh();
      return true;
    } catch {
      return false;
    }
  }

  async function deleteLesson(les: LessonRow) {
    if (!confirm(`"${les.title}" dersini silmek istiyor musun?`)) return;
    setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${les.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 409) {
      setMsg('Bu derse ait çocuk ilerlemesi var. Silinemez — yayından kaldırabilirsin.');
      return;
    }
    if (!r.ok) { setMsg('Silinemedi'); return; }
    await refresh();
    setMsg('Ders silindi');
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;
  if (notFound) return <p className="text-rose-400">Düzey bulunamadı.</p>;

  const accents = ['neon-cyan', 'neon-purple', 'neon-green', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div>
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-4 n-text">Dersler</h1>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Yeni ders başlığı"
          className="neon-input max-w-xs"
        />
        <button onClick={addLesson} disabled={busy || newTitle.trim().length < 1}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 transition-colors text-sm">
          Ders ekle
        </button>
        {msg && <span className="text-sm n-muted">{msg}</span>}
      </div>

      {rows.length === 0 ? (
        <p className="n-muted">Bu düzeyde henüz ders yok.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((les, i) => {
            const accent = accents[i % accents.length];
            return (
              <div key={les.id} className={`neon-card ${accent} flex flex-wrap items-center gap-3 p-4`}>
                <span className={`neon-avatar ${accent} w-11 h-11 text-sm shrink-0`}>{les.order_index}</span>
                <div className="flex-1 min-w-0">
                  <InlineTitleEdit
                    value={les.title}
                    onSave={(next) => renameLesson(les, next)}
                    ariaLabel={`${les.title} ders başlığını düzenle`}
                    textClassName="font-semibold n-text truncate"
                  />
                  <p className="text-xs n-muted">{les.estimated_minutes} dk · {les.step_count} adım</p>
                </div>
                <span className={les.published ? 'neon-pill neon-green' : 'neon-pill neon-amber'}>
                  {les.published ? 'Yayında' : 'Taslak'}
                </span>
                <Link href={`/admin/content/lesson/${les.id}`}
                  className="px-3 py-1.5 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-xs transition-colors">
                  İçeriği düzenle
                </Link>
                <button onClick={() => togglePublish(les)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-xs transition-colors">
                  {les.published ? 'Yayından kaldır' : 'Yayınla'}
                </button>
                <select
                  value={les.module_id}
                  onChange={(e) => moveLesson(les, Number(e.target.value))}
                  aria-label={`${les.title} dersini taşı`}
                  className="neon-input py-1.5 text-xs max-w-[10rem]"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button onClick={() => deleteLesson(les)}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs transition-colors">
                  Sil
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

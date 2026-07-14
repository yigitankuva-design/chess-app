'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { avatarEmoji } from '@/lib/avatars';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ChildRow { id: number; display_name: string; age: number; avatar: string; completed_lessons: number; }
interface ParentDetail { id: number; name: string; email: string; created_at: string; children: ChildRow[]; }

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminParentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<ParentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [newPass, setNewPass] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/parents/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function resetPassword() {
    setResetMsg(null);
    if (newPass.length < 8) { setResetMsg('Şifre en az 8 karakter olmalı'); return; }
    setResetting(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/admin/parents/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_password: newPass }),
      });
      setResetMsg(res.ok ? 'Şifre güncellendi ✓' : 'İşlem başarısız');
      if (res.ok) setNewPass('');
    } catch {
      setResetMsg('İşlem başarısız');
    }
    setResetting(false);
  }

  async function deleteParent() {
    setDeleting(true);
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/admin/parents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { router.replace('/admin/parents'); return; }
    } catch { /* ignore */ }
    setDeleting(false);
    setConfirmDelete(false);
  }

  if (loading) return <p>Yükleniyor...</p>;
  if (!data) return <p className="text-red-600">Veli bulunamadı.</p>;

  return (
    <div className="max-w-2xl">
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>

      <div className="neon-card neon-cyan p-6 mb-5">
        <h1 className="text-2xl font-bold n-text">{data.name}</h1>
        <p className="n-muted">{data.email}</p>
        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="n-muted text-xs block">Üyelik tarihi</span>
            <span className="n-text">{formatDateTime(data.created_at)}</span>
          </div>
          <div>
            <span className="n-muted text-xs block">Sporcu / çocuk sayısı</span>
            <span className="n-text">{data.children.length}</span>
          </div>
        </div>
      </div>

      <div className="neon-card neon-purple p-6 mb-5">
        <h2 className="font-bold mb-3 n-text">Çocuklar</h2>
        {data.children.length === 0 ? (
          <p className="n-muted text-sm">Çocuk yok.</p>
        ) : (
          <div className="space-y-2">
            {data.children.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-2xl">{avatarEmoji(c.avatar)}</span>
                <div className="flex-1">
                  <p className="font-semibold n-text">{c.display_name}</p>
                  <p className="text-xs n-muted">{c.age} yaşında · {c.completed_lessons} ders tamamlandı</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="neon-card neon-green p-6 mb-5">
        <h2 className="font-bold mb-3 n-text">Şifre Sıfırla</h2>
        <div className="flex gap-2 items-start">
          <input
            type="text"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Yeni şifre (min 8)"
            className="neon-input flex-1"
          />
          <button
            onClick={resetPassword}
            disabled={resetting}
            className="px-4 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 transition-colors shrink-0"
          >
            {resetting ? '...' : 'Sıfırla'}
          </button>
        </div>
        {resetMsg && <p className="text-sm mt-2 n-muted">{resetMsg}</p>}
      </div>

      <div className="neon-card p-6" style={{ ['--glow' as string]: '244,63,94' }}>
        <h2 className="font-bold mb-3 text-rose-400">Veliyi Sil</h2>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="neon-btn-danger">
            Veliyi Sil
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm n-muted">
              <strong className="n-text">{data.name}</strong> ve tüm çocuk profilleri silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2">
              <button
                onClick={deleteParent}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-500 text-white font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Siliniyor...' : 'Evet, sil'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

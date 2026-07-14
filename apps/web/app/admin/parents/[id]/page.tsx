'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { avatarEmoji } from '@/lib/avatars';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ChildRow { id: number; display_name: string; age: number; avatar: string; completed_lessons: number; }
interface ParentDetail { id: number; name: string; email: string; created_at: string; children: ChildRow[]; }

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
      <button onClick={() => router.back()} className="text-sm underline opacity-70 mb-4">← Geri</button>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p className="opacity-60">{data.email}</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="font-bold mb-3">Çocuklar</h2>
        {data.children.length === 0 ? (
          <p className="opacity-60 text-sm">Çocuk yok.</p>
        ) : (
          <div className="space-y-2">
            {data.children.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-2xl">{avatarEmoji(c.avatar)}</span>
                <div className="flex-1">
                  <p className="font-semibold">{c.display_name}</p>
                  <p className="text-xs opacity-60">{c.age} yaşında · {c.completed_lessons} ders tamamlandı</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="font-bold mb-3">Şifre Sıfırla</h2>
        <div className="flex gap-2 items-start">
          <input
            type="text"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Yeni şifre (min 8)"
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={resetPassword}
            disabled={resetting}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {resetting ? '...' : 'Sıfırla'}
          </button>
        </div>
        {resetMsg && <p className="text-sm mt-2">{resetMsg}</p>}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 border border-red-100">
        <h2 className="font-bold mb-3 text-red-700">Veliyi Sil</h2>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
          >
            Veliyi Sil
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <strong>{data.name}</strong> ve tüm çocuk profilleri silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2">
              <button
                onClick={deleteParent}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Evet, sil'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 bg-gray-200 rounded"
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

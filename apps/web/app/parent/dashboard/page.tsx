'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { avatarEmoji } from '@/lib/avatars';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Child { id: number; display_name: string; age: number; avatar: string; }

export default function ParentDashboardPage() {
  const router = useRouter();
  const auth = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/parent-login'); return; }
    fetch(`${API_BASE}/children`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setChildren(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  async function deleteChild(id: number) {
    const token = getToken();
    if (!token) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/children/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setChildren((prev) => prev.filter((c) => c.id !== id));
      }
    } catch { /* ignore */ }
    setDeletingId(null);
    setConfirmId(null);
  }

  return (
    <main id="main-content" className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Çocuklarım</h1>
        <button onClick={() => { auth.logout(); router.push('/parent-login'); }} className="text-sm underline opacity-70">
          Çıkış
        </button>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {children.map((c) => (
              <div key={c.id} className="relative">
                <Link href={`/parent/child/${c.id}`}>
                  <div className="p-4 pr-12 bg-white rounded-2xl shadow flex items-center gap-3 cursor-pointer hover:shadow-lg transition-shadow">
                    <span className="text-4xl">{avatarEmoji(c.avatar)}</span>
                    <div>
                      <p className="font-bold">{c.display_name}</p>
                      <p className="text-sm opacity-60">{c.age} yaşında</p>
                    </div>
                  </div>
                </Link>
                {/* Delete button */}
                <button
                  onClick={() => setConfirmId(c.id)}
                  aria-label={`${c.display_name} profilini sil`}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>

                {/* Confirm overlay */}
                {confirmId === c.id && (
                  <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center gap-2 p-3 shadow-lg border border-red-200">
                    <p className="text-sm font-semibold text-center">
                      {c.display_name} profilini silmek istediğine emin misin?
                    </p>
                    <p className="text-xs text-center opacity-60">
                      Tüm ilerleme, rozet ve oyunlar silinir. Bu işlem geri alınamaz.
                    </p>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => deleteChild(c.id)}
                        disabled={deletingId === c.id}
                        className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                      >
                        {deletingId === c.id ? 'Siliniyor...' : 'Evet, sil'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-4 py-1.5 rounded-lg bg-gray-200 text-sm font-medium"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/parent/add-child" className="block text-center bg-blue-600 text-white py-3 rounded-lg">
              + Çocuk Ekle
            </Link>
            {children.length > 0 && (
              <Link href="/child-login" className="block text-center bg-green-600 text-white py-3 rounded-lg">
                🎮 Çocuk Moduna Geç
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}

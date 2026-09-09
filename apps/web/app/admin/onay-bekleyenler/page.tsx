'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 3): "Tier A" onay
 * ekranı — kendi kaydolan ANTRENÖR başvuruları burada listelenir, admin
 * (Zafer) kimlik/iletişim bilgisini gözden geçirip Onayla/Reddet ile
 * karar verir. Onaylanana kadar hesap giriş yapamaz (bkz.
 * apps/api/chess_api/dependencies/auth.py). Madde (devam 4): Zafer'in
 * kararıyla sporcu tarafı (18+ dahil) bu onaya TABİ DEĞİL — çocuklarla
 * doğrudan çalışacak rol antrenör olduğu için onay SADECE bu tarafta.
 */
interface PendingMember {
  id: number;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  province: string | null;
  lichess_username: string | null;
  created_at: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR');
}

export default function AdminPendingMembersPage() {
  const [rows, setRows] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    const token = getToken();
    setLoading(true);
    fetch(`${API_BASE}/admin/pending-members`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function decide(id: number, action: 'approve' | 'reject') {
    setError(null);
    setBusyId(id);
    try {
      const token = getToken();
      const r = await fetch(`${API_BASE}/admin/pending-members/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('İşlem başarısız');
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch {
      setError('İşlem başarısız oldu, tekrar dene.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 n-text">Onay Bekleyenler</h1>
      <p className="n-muted text-sm mb-4">
        Kendi kaydolan antrenör başvuruları — onaylamadan giriş yapamazlar.
      </p>

      {error && <p className="text-rose-400 text-sm mb-3">{error}</p>}

      {rows.length === 0 ? (
        <p className="n-muted">Onay bekleyen başvuru yok.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((m) => (
            <div key={m.id} className="neon-card neon-card-i neon-cyan p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold n-text">{m.name}</p>
                  <p className="text-xs n-muted">Başvuru: {formatDate(m.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => decide(m.id, 'approve')}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-emerald-100 bg-emerald-400/15 border border-emerald-400/40 hover:bg-emerald-400/25 transition-all disabled:opacity-40"
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => decide(m.id, 'reject')}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-rose-100 bg-rose-400/15 border border-rose-400/40 hover:bg-rose-400/25 transition-all disabled:opacity-40"
                  >
                    Reddet
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <p className="text-xs n-muted">Kullanıcı Adı</p>
                  <p className="n-text">{m.username ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs n-muted">Telefon</p>
                  <p className="n-text">{m.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs n-muted">Şehir</p>
                  <p className="n-text">{m.province ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs n-muted">Lichess</p>
                  <p className="n-text">{m.lichess_username ?? '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs n-muted">E-posta</p>
                <p className="n-text text-sm">{m.email}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ParentRow {
  id: number;
  name: string;
  email: string;
  created_at: string;
  child_count: number;
}

export default function AdminParentsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/parents`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.email.toLowerCase().includes(q.toLowerCase()),
  );

  if (loading) return <p>Yükleniyor...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Kullanıcılar</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ad veya e-posta ara..."
        className="w-full max-w-sm p-2 border rounded mb-4"
      />
      {filtered.length === 0 ? (
        <p className="opacity-60">Kullanıcı bulunamadı.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow divide-y">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/admin/parents/${p.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm opacity-60">{p.email}</p>
              </div>
              <span className="text-sm opacity-60">{p.child_count} çocuk</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

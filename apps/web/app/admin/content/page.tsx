'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ModuleRow { id: number; order_index: number; name: string; lesson_count: number; }

export default function AdminContentPage() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/content`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Yükleniyor...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">İçerik (Modüller)</h1>
      {rows.length === 0 ? (
        <p className="opacity-60">Modül bulunamadı.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow divide-y">
          {rows.map((m) => (
            <Link
              key={m.id}
              href={`/admin/content/${m.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-semibold">{m.order_index}. {m.name}</p>
              </div>
              <span className="text-sm opacity-60">{m.lesson_count} ders →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

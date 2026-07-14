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

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const accents = ['neon-cyan', 'neon-purple', 'neon-green', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 n-text">İçerik (Modüller)</h1>
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

'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface LessonRow {
  id: number;
  order_index: number;
  title: string;
  estimated_minutes: number;
  step_count: number;
}

export default function AdminModuleLessonsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/modules/${id}/lessons`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return []; }
        return r.ok ? r.json() : [];
      })
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const accents = ['neon-cyan', 'neon-purple', 'neon-green', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div>
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-6 n-text">Dersler</h1>
      {notFound ? (
        <p className="text-rose-400">Modül bulunamadı.</p>
      ) : rows.length === 0 ? (
        <p className="n-muted">Bu modülde henüz ders yok.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((les, i) => {
            const accent = accents[i % accents.length];
            return (
              <div key={les.id} className={`neon-card ${accent} flex items-center gap-4 p-4`}>
                <span className={`neon-avatar ${accent} w-11 h-11 text-sm shrink-0`}>
                  {les.order_index}
                </span>
                <div className="flex-1">
                  <p className="font-semibold n-text">{les.title}</p>
                  <p className="text-xs n-muted">{les.estimated_minutes} dk · {les.step_count} adım</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

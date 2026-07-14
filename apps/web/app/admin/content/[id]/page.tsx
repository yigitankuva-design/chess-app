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

  if (loading) return <p>Yükleniyor...</p>;

  return (
    <div>
      <button onClick={() => router.back()} className="text-sm underline opacity-70 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-6">Dersler</h1>
      {notFound ? (
        <p className="text-red-600">Modül bulunamadı.</p>
      ) : rows.length === 0 ? (
        <p className="opacity-60">Bu modülde henüz ders yok.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow divide-y">
          {rows.map((les) => (
            <div key={les.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{les.order_index}. {les.title}</p>
                <p className="text-xs opacity-60">{les.estimated_minutes} dk · {les.step_count} adım</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

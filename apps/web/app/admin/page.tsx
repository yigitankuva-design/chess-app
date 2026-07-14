'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Overview { total_parents: number; total_children: number; total_teachers: number; }

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/overview`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Yükleniyor...</p>;
  if (!data) return <p className="text-red-600">Veri yüklenemedi.</p>;

  const cards = [
    { label: 'Veli', value: data.total_parents },
    { label: 'Çocuk', value: data.total_children },
    { label: 'Öğretmen', value: data.total_teachers },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Genel Bakış</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl shadow p-6">
            <p className="text-3xl font-bold">{c.value}</p>
            <p className="text-sm opacity-60">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

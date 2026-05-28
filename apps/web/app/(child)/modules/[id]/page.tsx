'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';

interface LessonSummary {
  id: number;
  order_index: number;
  title: string;
  estimated_minutes: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ModuleLessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/modules/${id}/lessons`)
      .then((r) => r.json())
      .then((data) => {
        setLessons(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="p-6">Yükleniyor...</main>;

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <Link href="/home" className="text-blue-600 underline text-sm">← Modüller</Link>
      <h1 className="text-2xl font-bold my-6">Dersler</h1>
      {lessons.length === 0 ? (
        <p className="opacity-75">Bu modüle henüz ders eklenmedi.</p>
      ) : (
        <div className="space-y-3">
          {lessons.map((l) => (
            <Link
              key={l.id}
              href={`/lesson/${l.id}`}
              className="block p-4 bg-white rounded-xl shadow hover:shadow-md transition"
            >
              <span className="font-bold">{l.order_index}. {l.title}</span>
              <span className="text-sm opacity-50 ml-2">~{l.estimated_minutes} dk</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

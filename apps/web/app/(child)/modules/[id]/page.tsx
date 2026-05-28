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

const ChevronRight = () => (
  <svg className="flex-shrink-0 t-muted" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

export default function ModuleLessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/modules/${id}/lessons`)
      .then((r) => r.json())
      .then((data) => { setLessons(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto">
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map((i) => <div key={i} className="t-skel h-16" />)}
        </div>
      ) : lessons.length === 0 ? (
        <p className="t-muted text-sm">Bu modüle henüz ders eklenmedi.</p>
      ) : (
        <div className="space-y-2">
          {lessons.map((l) => (
            <Link key={l.id} href={`/lesson/${l.id}`}
              className="t-card-i flex items-center gap-3 px-4 py-3"
            >
              <div
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: 'var(--t-surface-2)', color: 'var(--t-accent)' }}
              >
                {l.order_index}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{l.title}</p>
                <p className="text-xs t-muted mt-0.5">~{l.estimated_minutes} dakika</p>
              </div>
              <ChevronRight />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

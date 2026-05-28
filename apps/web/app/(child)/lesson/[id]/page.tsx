'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { LessonPlayer } from '@/components/LessonPlayer';
import type { LessonStep } from '@/lib/stores/lesson-store';

interface LessonDetail {
  id: number;
  module_id: number;
  title: string;
  estimated_minutes: number;
  steps: LessonStep[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/lessons/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setLesson(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="p-8">Yükleniyor...</main>;
  if (!lesson) return <main className="p-8">Ders bulunamadı.</main>;

  const handleComplete = async () => {
    const token = getToken();
    try {
      await fetch(`${API_BASE}/lessons/${lesson.id}/complete`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // ignore
    }
    router.push(`/modules/${lesson.module_id}`);
  };

  return (
    <main>
      <h1 className="text-2xl font-bold p-4 text-center">{lesson.title}</h1>
      <LessonPlayer
        lessonId={lesson.id}
        initialSteps={lesson.steps}
        onComplete={handleComplete}
      />
    </main>
  );
}

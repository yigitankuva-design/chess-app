'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ComingSoon } from '@/components/ComingSoon';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Admin'deki 3 pratik modu → adım içeriğindeki soru listesi alanı */
const MODES: Record<string, { emoji: string; title: string; field: string; timed: boolean; scored: boolean }> = {
  suresiz: { emoji: '♾️', title: 'Süresiz Pratik Yap', field: 'board_exercises',       timed: false, scored: false },
  sureli:  { emoji: '⏱️', title: 'Süreli Pratik Yap',  field: 'board_exercises_timed', timed: true,  scored: false },
  test:    { emoji: '📝', title: 'Kendini Test Et',    field: 'board_exercises_test',  timed: false, scored: true  },
};

const TIMED_SECONDS = 300; // Süreli mod: 5 dakika

interface StepRow { id: number; type: string; content_json?: Record<string, unknown> }

export default function PratikPage() {
  return (
    <Suspense fallback={<main className="px-4 pt-5 max-w-lg mx-auto"><p className="text-sm t-muted">Yükleniyor...</p></main>}>
      <PratikInner />
    </Suspense>
  );
}

function PratikInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.mode ?? '');
  const mode = MODES[slug];

  const konu = searchParams.get('konu');
  const stepId = Number(searchParams.get('step'));
  const lessonId = Number(searchParams.get('ders'));

  const [exercises, setExercises] = useState<BoardExerciseConfig[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [solved, setSolved] = useState(0);
  const [left, setLeft] = useState(TIMED_SECONDS);
  const [timeUp, setTimeUp] = useState(false);

  // Admin'de bu alt konu + mod için yazılan soruları çek
  useEffect(() => {
    if (!mode || !lessonId || !stepId) { setLoading(false); return; }
    fetch(`${API_BASE}/lessons/${lessonId}`)
      .then((r) => (r.ok ? r.json() : { steps: [] }))
      .then((d) => {
        const step = (d.steps as StepRow[] | undefined)?.find((s) => s.id === stepId);
        const list = (step?.content_json?.[mode.field] as BoardExerciseConfig[] | undefined) ?? [];
        setExercises(Array.isArray(list) ? list : []);
        setLoading(false);
      })
      .catch(() => { setExercises([]); setLoading(false); });
  }, [mode, lessonId, stepId]);

  // Süreli mod sayacı
  useEffect(() => {
    if (!mode?.timed || loading || !exercises?.length || timeUp) return;
    if (left <= 0) { setTimeUp(true); return; }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, loading, exercises, left, timeUp]);

  if (!mode) {
    return <ComingSoon emoji="🎯" title="Pratik" description="Bu içerik hazırlanıyor." />;
  }

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-2xl leading-none">{mode.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold t-premium text-lg leading-tight">{mode.title}</p>
        {konu && <p className="text-xs t-muted mt-0.5 truncate">{konu}</p>}
      </div>
      {mode.timed && exercises && exercises.length > 0 && (
        <span className="font-extrabold text-sm px-3 py-1.5 rounded-xl"
          style={{
            background: 'color-mix(in srgb, var(--t-accent) 12%, transparent)',
            border: '1px solid var(--t-accent)',
            color: left <= 30 ? '#f87171' : 'var(--t-accent)',
          }}>
          {String(Math.floor(Math.max(left, 0) / 60)).padStart(2, '0')}:
          {String(Math.max(left, 0) % 60).padStart(2, '0')}
        </span>
      )}
    </div>
  );

  // Alt konu bağlamı gelmemişse (doğrudan URL) yönlendir
  if (!lessonId || !stepId) {
    return (
      <ComingSoon
        emoji={mode.emoji}
        title={mode.title}
        description="Bu pratiği başlatmak için Hızlı Erişim → Dersler'den bir alt konu seç."
      />
    );
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto">
      {header}

      {loading && <p className="text-sm t-muted">Sorular yükleniyor...</p>}

      {!loading && exercises?.length === 0 && (
        <div className="t-card-i p-5 text-center rounded-xl">
          <p className="text-3xl mb-2">📭</p>
          <p className="font-bold text-sm mb-1">Bu bölümde henüz soru yok</p>
          <p className="text-xs t-muted mb-4">
            Öğretmenin bu alt konu için “{mode.title}” sorularını hazırladığında burada görünecek.
          </p>
          <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">Ana Sayfaya Dön</Link>
        </div>
      )}

      {!loading && exercises && exercises.length > 0 && timeUp && (
        <div className="t-card-i p-5 text-center rounded-xl">
          <p className="text-3xl mb-2">⏰</p>
          <p className="font-bold text-sm mb-1">Süre doldu!</p>
          <p className="text-xs t-muted mb-4">{exercises.length} sorudan {solved} tanesini çözdün.</p>
          <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">Ana Sayfaya Dön</Link>
        </div>
      )}

      {!loading && exercises && exercises.length > 0 && !timeUp && (
        <>
          {mode.scored && (
            <p className="text-xs t-muted mb-2">
              Puan: <b style={{ color: 'var(--t-accent)' }}>{solved}</b> / {exercises.length}
            </p>
          )}
          <BoardExercise
            exercises={exercises}
            done={false}
            onCorrect={() => setSolved((s) => Math.min(s + 1, exercises.length))}
          />
        </>
      )}
    </main>
  );
}

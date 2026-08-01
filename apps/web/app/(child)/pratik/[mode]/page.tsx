'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ComingSoon } from '@/components/ComingSoon';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';
import { sessionKey, loadSession, saveSession, clearSession } from '@/lib/play/practiceSession';
import { pickWeighted, UNTIMED_MIX, TIMED_MIX, TEST_MIX } from '@/lib/play/questionPicker';
import type { DifficultyBucket } from '@/lib/play/questionPicker';
import { loadPreviousCodes, saveShownCodes } from '@/lib/play/practiceHistory';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import { PracticeResult } from '@/components/practice/PracticeResult';
import { scorePercent } from '@/lib/practice/scoring';
import { isModeUnlocked, unlockedLabel, UNLOCK_THRESHOLD } from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap } from '@/lib/practice/unlock';
import { fetchLessonScores, submitPracticeResult } from '@/lib/practice/practiceApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Admin'deki 3 pratik modu → adım içeriğindeki soru listesi alanı */
const MODES: Record<string, {
  emoji: string; title: string; field: string; timed: boolean; scored: boolean;
  /** Havuzdan rastgele kaç soru seçilsin (0 = hepsi, sırayla) */
  randomPick: number;
  /** Zorluk dağılımı (madde 4/5/6) — randomPick 0 ise kullanılmaz. */
  mix: DifficultyBucket;
}> = {
  suresiz: { emoji: '♾️', title: 'Süresiz Pratik Yap', field: 'board_exercises',       timed: false, scored: false, randomPick: 20, mix: UNTIMED_MIX },
  sureli:  { emoji: '⏱️', title: 'Süreli Pratik Yap',  field: 'board_exercises_timed', timed: true,  scored: false, randomPick: 20, mix: TIMED_MIX },
  test:    { emoji: '📝', title: 'Kendini Test Et',    field: 'board_exercises_test',  timed: false, scored: true,  randomPick: 20, mix: TEST_MIX },
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
  const [poolSize, setPoolSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [solved, setSolved] = useState(0);
  const [left, setLeft] = useState(TIMED_SECONDS);
  const [timeUp, setTimeUp] = useState(false);
  /** null = kilit sistemi uygulanmıyor (token yok / sunucuya ulaşılamadı). */
  const [scores, setScores] = useState<ScoreMap | null>(null);
  const [orderedStepIds, setOrderedStepIds] = useState<number[]>([]);
  const [finished, setFinished] = useState<{ correct: number; total: number; score: number } | null>(null);
  const [unlockedNow, setUnlockedNow] = useState<string | null>(null);
  /** Tekrar Dene: BoardExercise'ı sıfırdan kurmak için artan sayaç. */
  const [runId, setRunId] = useState(0);
  /** Yenilemeden sonra kalinan soru sirasi (madde 4/9). */
  const [startIndex, setStartIndex] = useState(0);

  // Admin'de bu alt konu + mod için yazılan soruları çek
  useEffect(() => {
    if (!mode || !lessonId || !stepId) { setLoading(false); return; }
    fetch(`${API_BASE}/lessons/${lessonId}`)
      .then((r) => (r.ok ? r.json() : { steps: [] }))
      .then((d) => {
        const step = (d.steps as StepRow[] | undefined)?.find((s) => s.id === stepId);
        const raw = (step?.content_json?.[mode.field] as BoardExerciseConfig[] | undefined) ?? [];
        const rawPool = Array.isArray(raw) ? raw : [];
        setPoolSize(rawPool.length);
        // Alt konu sırası: başlıklı explanation adımları — home/page.tsx:270 ile aynı kural.
        const ordered = (d.steps as StepRow[] | undefined ?? [])
          .filter((s) => s.type === 'explanation' && (s.content_json as { title?: string } | undefined)?.title)
          .map((s) => s.id);
        setOrderedStepIds(ordered);
        // Kodlar ADMİN'DEKİ SIRAYA göre (havuz karıştırılmadan önce) hesaplanır — yoksa
        // öğrenciye gösterilen kod, admin panelindeki dairesel kartla eşleşmez.
        const codes = assignExerciseCodes(rawPool);
        const pool = rawPool.map((ex, i) => ({ ...ex, code: ex.code ?? codes[i] }));
        // Sayfa YENILENDIYSE ayni soru setiyle ve ayni sirada devam edilir
        // (madde 4 ve 9); yeni oturumda havuzdan yeniden secilir.
        const key = sessionKey(stepId, slug);
        const saved = loadSession<BoardExerciseConfig>(key);
        if (saved) {
          setExercises(saved.items);
          setStartIndex(saved.index);
          setLoading(false);
          return;
        }
        // Havuzdan zorluk dagilimina gore secim (madde 4/5/6): mumkunse
        // bir onceki turda gosterilen sorulardan farkli.
        const previousCodes = loadPreviousCodes(stepId, slug);
        const picked = mode.randomPick > 0
          ? pickWeighted(
              pool, mode.mix,
              (ex) => (ex as { difficulty?: number }).difficulty,
              (ex) => ex.code ?? '',
              previousCodes,
            )
          : pool;
        setExercises(picked);
        setStartIndex(0);
        saveSession(key, { items: picked, index: 0 });
        if (mode.randomPick > 0) {
          saveShownCodes(stepId, slug, picked.map((ex) => ex.code ?? '').filter(Boolean));
        }
        setLoading(false);
      })
      .catch(() => { setExercises([]); setLoading(false); });
  }, [mode, lessonId, stepId]);

  // Kilit durumu (token yoksa null döner → kilit uygulanmaz)
  useEffect(() => {
    if (!lessonId) return;
    let alive = true;
    fetchLessonScores(lessonId).then((m) => { if (alive) setScores(m); });
    return () => { alive = false; };
  }, [lessonId]);

  // Süreli mod sayacı
  useEffect(() => {
    if (!mode?.timed || loading || !exercises?.length || timeUp) return;
    if (left <= 0) { setTimeUp(true); return; }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, loading, exercises, left, timeUp]);

  // Süre dolunca oturum biter — o ana kadarki doğrular puanlanır.
  // Kasten yalnızca `timeUp`e bağlı: diğer değerler değiştiğinde tekrar
  // tetiklenirse aynı oturum iki kez kaydedilir.
  useEffect(() => {
    if (!timeUp || finished) return;
    void handleFinish({ correct: solved, total: exercises?.length ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  const modeKey = slug as PracticeMode;

  /** Oturum bitti: puanı sunucuya yaz, sonuç ekranını hazırla. */
  async function handleFinish(r: { correct: number; total: number }) {
    const localScore = scorePercent(r.correct, r.total);
    const before = scores?.[stepId]?.[modeKey] ?? 0;

    const saved = await submitPracticeResult(stepId, modeKey, r.correct, r.total);
    const score = saved?.score ?? localScore;

    // Kilit YALNIZCA sunucuya yazılabildiyse açılmış sayılır — aksi halde
    // öğrenciye açıldı deyip yenilemede kapalı bulmasına yol açardık.
    const opened = saved !== null && before < UNLOCK_THRESHOLD && score >= UNLOCK_THRESHOLD;
    setUnlockedNow(opened ? unlockedLabel(modeKey) : null);

    if (saved !== null) {
      setScores((prev) => ({
        ...(prev ?? {}),
        [stepId]: { ...(prev?.[stepId] ?? {}), [modeKey]: saved.best_score },
      }));
    }
    setFinished({ correct: r.correct, total: r.total, score });
  }

  function handleRetry() {
    setFinished(null);
    setUnlockedNow(null);
    setSolved(0);
    setLeft(TIMED_SECONDS);
    setTimeUp(false);
    setRunId((n) => n + 1);
    // Yeni tur: saklanan oturum silinir, sporcu 1. sorudan baslar.
    clearSession(sessionKey(stepId, slug));
    setStartIndex(0);
  }

  /** Kilit yalnızca skor haritası GERÇEKTEN alındıysa uygulanır. */
  const locked = scores !== null && !isModeUnlocked(orderedStepIds, stepId, modeKey, scores);

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

      {!loading && !locked && exercises?.length === 0 && (
        <div className="t-card-i p-5 text-center rounded-xl">
          <p className="text-3xl mb-2">📭</p>
          <p className="font-bold text-sm mb-1">Bu bölümde henüz soru yok</p>
          <p className="text-xs t-muted mb-4">
            Öğretmenin bu alt konu için “{mode.title}” sorularını hazırladığında burada görünecek.
          </p>
          <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">Ana Sayfaya Dön</Link>
        </div>
      )}

      {!loading && locked && (
        <div className="t-card-i p-5 text-center rounded-xl">
          <p className="text-3xl mb-2">🔒</p>
          <p className="font-bold text-sm mb-1">Bu bölüm henüz kilitli</p>
          <p className="text-xs t-muted mb-4">
            {modeKey === 'sureli'
              ? 'Önce “Süresiz Pratik Yap”ta 85 puan ve üzeri al.'
              : modeKey === 'test'
                ? 'Önce “Süreli Pratik Yap”ta 85 puan ve üzeri al.'
                : 'Önce bir önceki alt konuyu tamamla.'}
          </p>
          <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">Ana Sayfaya Dön</Link>
        </div>
      )}

      {!loading && !locked && finished && (
        <PracticeResult
          correct={finished.correct}
          total={finished.total}
          score={finished.score}
          unlocked={unlockedNow}
          onRetry={handleRetry}
        />
      )}

      {!loading && !locked && !finished && exercises && exercises.length > 0 && timeUp && (
        <div className="t-card-i p-5 text-center rounded-xl">
          <p className="text-3xl mb-2">⏰</p>
          <p className="font-bold text-sm mb-1">Süre doldu!</p>
          <p className="text-xs t-muted mb-4">{exercises.length} sorudan {solved} tanesini çözdün.</p>
          <Link href="/home" className="t-btn inline-block px-5 py-2.5 text-sm">Ana Sayfaya Dön</Link>
        </div>
      )}

      {!loading && !locked && !finished && exercises && exercises.length > 0 && !timeUp && (
        <>
          {mode.scored && (
            <p className="text-xs t-muted mb-2">
              Puan: <b style={{ color: 'var(--t-accent)' }}>{solved}</b> / {exercises.length}
            </p>
          )}
          {mode.randomPick > 0 && poolSize > exercises.length && (
            <p className="text-xs t-muted mb-2">
              🎲 {poolSize} soruluk havuzdan rastgele <b style={{ color: 'var(--t-accent)' }}>{exercises.length}</b> soru seçildi
              <span className="opacity-70"> — her girişte farklı sorular gelir</span>
            </p>
          )}
          <BoardExercise
            key={runId}
            exercises={exercises}
            done={false}
            onCorrect={() => setSolved((s) => Math.min(s + 1, exercises.length))}
            onFinish={handleFinish}
            /* Madde 1: Suresiz Pratik'te bir soru yanlis yapilirsa tekrar
               cozulemez; sporcu "Sonraki Soruya Gec" ile ilerler. */
            noRetry={modeKey === 'suresiz'}
            initialIndex={startIndex}
            onIndexChange={(i) => {
              if (exercises) saveSession(sessionKey(stepId, slug), { items: exercises, index: i });
            }}
          />
        </>
      )}
    </main>
  );
}

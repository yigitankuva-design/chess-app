'use client';
import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ComingSoon } from '@/components/ComingSoon';
import { BoardExercise, isBoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';
import { resultHeadline } from '@/lib/practice/resultHeadline';
import { sessionKey, loadSession, saveSession, clearSession } from '@/lib/play/practiceSession';
import { isSessionStale } from '@/lib/play/staleSession';
import { pickWeighted, scaleMix, UNTIMED_MIX, TIMED_MIX, TEST_MIX } from '@/lib/play/questionPicker';
import type { DifficultyBucket } from '@/lib/play/questionPicker';
import { loadPreviousCodes, saveShownCodes } from '@/lib/play/practiceHistory';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import { PracticeResult } from '@/components/practice/PracticeResult';
import { scorePercent } from '@/lib/practice/scoring';
import { isModeUnlocked, unlockedLabel, thresholdFor, PRACTICE_MODE_FIELDS } from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap, ThresholdMap } from '@/lib/practice/unlock';
import { fetchLessonScores, submitPracticeResult } from '@/lib/practice/practiceApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Alt konu için özel bir soru sayısı belirlenmediyse kullanılan eski sabit (KURAL #3). */
const DEFAULT_QUESTION_COUNT = 20;

/** Admin'deki 3 pratik modu → adım içeriğindeki soru listesi alanı */
const MODES: Record<string, {
  emoji: string; title: string; field: string; timed: boolean; scored: boolean;
  /** Zorluk dağılım ORANI (madde 4/5/6) — çözülen soru sayısına scaleMix ile ölçeklenir. */
  mix: DifficultyBucket;
  /** "Bırak" düğmesinin yazısı — başlıktan türetilmez, açıkça yazılır. */
  quitLabel: string;
}> = {
  // Madde 2026-09-05: "Süresiz Pratik Yap" → "Ödevini Yap" — SADECE başlık, field/işlev DEĞİŞMEDİ.
  suresiz: { emoji: '♾️', title: 'Ödevini Yap', field: 'board_exercises',       timed: false, scored: false, mix: UNTIMED_MIX, quitLabel: 'Ödevini Yapmayı Bırak' },
  sureli:  { emoji: '⏱️', title: 'Süreli Pratik Yap',  field: 'board_exercises_timed', timed: true,  scored: false, mix: TIMED_MIX,   quitLabel: 'Süreli Pratik Yapmayı Bırak' },
  test:    { emoji: '📝', title: 'Kendini Test Et',    field: 'board_exercises_test',  timed: false, scored: true,  mix: TEST_MIX,    quitLabel: 'Testi Bırak' },
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
  const router = useRouter();
  const slug = String(params.mode ?? '');
  const mode = MODES[slug];

  const konu = searchParams.get('konu');
  const stepId = Number(searchParams.get('step'));
  const lessonId = Number(searchParams.get('ders'));

  const [exercises, setExercises] = useState<BoardExerciseConfig[] | null>(null);
  const [poolSize, setPoolSize] = useState(0);
  /** Bu alt konu + mod için çözülecek soru sayısı — admin'de belirlenmediyse 20. */
  const [randomPick, setRandomPick] = useState(DEFAULT_QUESTION_COUNT);
  const [loading, setLoading] = useState(true);
  const [solved, setSolved] = useState(0);
  const [left, setLeft] = useState(TIMED_SECONDS);
  const [timeUp, setTimeUp] = useState(false);
  /** null = kilit sistemi uygulanmıyor (token yok / sunucuya ulaşılamadı). */
  const [scores, setScores] = useState<ScoreMap | null>(null);
  const [orderedStepIds, setOrderedStepIds] = useState<number[]>([]);
  /** stepId → mod → hoca'nın Admin'de girdiği geçme puanı; boşsa UNLOCK_THRESHOLD (85). */
  const [thresholds, setThresholds] = useState<ThresholdMap>({});
  const [finished, setFinished] = useState<{ correct: number; total: number; score: number } | null>(null);
  const [unlockedNow, setUnlockedNow] = useState<string | null>(null);
  /** Tekrar Dene: BoardExercise'ı sıfırdan kurmak için artan sayaç. */
  const [runId, setRunId] = useState(0);
  /** Yenilemeden sonra kalinan soru sirasi (madde 4/9). */
  const [startIndex, setStartIndex] = useState(0);
  /** Yenilemeden sonra kalinan sorunun cevap durumu (madde 6). */
  const [startAnswer, setStartAnswer] = useState<'correct' | 'wrong' | null>(null);
  /** Yenilemeden sonra restore edilecek doğru-sayısı (madde 6). */
  const [startDoneCount, setStartDoneCount] = useState(0);
  /** Son çekilen havuz — "Tekrar Dene" ağa gitmeden YENİ bir set çekebilsin
   *  diye saklanır (madde: 2026-08-21, "Tekrar Dene" de artık farklı sorular
   *  getirir — önceden aynı `exercises` state'ini tekrar kullanıyordu). */
  const poolRef = useRef<{ pool: BoardExerciseConfig[]; resolvedPick: number } | null>(null);

  /** Havuzdan zorluk dağılımına göre YENİ bir set seçer: mümkünse bir önceki
   *  turda gösterilen sorulardan farklı (madde 4/5/6). Hem ilk yüklemede hem
   *  "Tekrar Dene"de kullanılır — iki yerde iki farklı mantık olmasın diye. */
  function pickFreshSet() {
    const cached = poolRef.current;
    if (!cached || !mode) return;
    const { pool, resolvedPick } = cached;
    const previousCodes = loadPreviousCodes(stepId, slug);
    const picked = resolvedPick > 0
      ? pickWeighted(
          pool, scaleMix(mode.mix, resolvedPick),
          (ex) => (ex as { difficulty?: number }).difficulty,
          (ex) => ex.code ?? '',
          previousCodes,
        )
      : pool;
    setExercises(picked);
    setStartIndex(0);
    setStartAnswer(null);
    setStartDoneCount(0);
    setSolved(0);
    saveSession(sessionKey(stepId, slug), { items: picked, index: 0, currentAnswer: null, doneCount: 0 });
    if (resolvedPick > 0) {
      saveShownCodes(stepId, slug, picked.map((ex) => ex.code ?? '').filter(Boolean));
    }
  }

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
        // Madde 3: Zafer hoca bu alt konu + mod için özel bir soru sayısı
        // belirlediyse onu kullan; yoksa eskisi gibi 20 (geriye dönük uyumlu).
        const counts = step?.content_json?.question_counts as Record<string, number> | undefined;
        const configured = counts?.[mode.field];
        const resolvedPick = configured && configured > 0 ? configured : DEFAULT_QUESTION_COUNT;
        setRandomPick(resolvedPick);
        // Alt konu sırası: başlıklı explanation adımları — home/page.tsx:270 ile aynı kural.
        const ordered = (d.steps as StepRow[] | undefined ?? [])
          .filter((s) => s.type === 'explanation' && (s.content_json as { title?: string } | undefined)?.title)
          .map((s) => s.id);
        setOrderedStepIds(ordered);
        // Hoca'nın alt konu + mod başına girdiği başarı puanları — girilmeyen
        // mod eskisi gibi UNLOCK_THRESHOLD (85) kullanır (thresholdFor).
        const nextThresholds: ThresholdMap = {};
        for (const s of (d.steps as StepRow[] | undefined) ?? []) {
          const raw = s.content_json?.success_scores as Record<string, number> | undefined;
          if (!raw) continue;
          const entry: Partial<Record<PracticeMode, number>> = {};
          for (const key of Object.keys(PRACTICE_MODE_FIELDS) as PracticeMode[]) {
            const field = PRACTICE_MODE_FIELDS[key];
            if (typeof raw[field] === 'number') entry[key] = raw[field];
          }
          if (Object.keys(entry).length > 0) nextThresholds[s.id] = entry;
        }
        setThresholds(nextThresholds);
        // Kodlar ADMİN'DEKİ SIRAYA göre (havuz karıştırılmadan önce) hesaplanır — yoksa
        // öğrenciye gösterilen kod, admin panelindeki dairesel kartla eşleşmez.
        const codes = assignExerciseCodes(rawPool);
        const pool = rawPool.map((ex, i) => ({ ...ex, code: ex.code ?? codes[i] }));
        poolRef.current = { pool, resolvedPick };
        // Sayfa YENILENDIYSE ayni soru setiyle ve ayni sirada devam edilir
        // (madde 4 ve 9); yeni oturumda havuzdan yeniden secilir.
        const key = sessionKey(stepId, slug);
        const saved = loadSession<BoardExerciseConfig>(key);
        // Madde 4: kayıt varsa ama havuzla artık UYUŞMUYORSA (Zafer Hoca
        // sonradan soru ekledi/çıkardı) bayat sayılır — yeniden üretilir.
        if (saved && !isSessionStale(saved.items.length, rawPool.length, resolvedPick)) {
          setExercises(saved.items);
          setStartIndex(saved.index);
          setStartAnswer(saved.currentAnswer);
          setStartDoneCount(saved.doneCount);
          setSolved(saved.doneCount);
          setLoading(false);
          return;
        }
        pickFreshSet();
        setLoading(false);
      })
      .catch(() => { setExercises([]); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  /** Bu alt konu + modun geçme eşiği — hoca girmediyse 85 (thresholdFor). */
  const passThreshold = thresholdFor(thresholds, stepId, modeKey);

  /** Oturum bitti: puanı sunucuya yaz, sonuç ekranını hazırla. */
  async function handleFinish(r: { correct: number; total: number }) {
    const localScore = scorePercent(r.correct, r.total);
    const before = scores?.[stepId]?.[modeKey] ?? 0;

    const saved = await submitPracticeResult(stepId, modeKey, r.correct, r.total);
    const score = saved?.score ?? localScore;

    // Kilit YALNIZCA sunucuya yazılabildiyse açılmış sayılır — aksi halde
    // öğrenciye açıldı deyip yenilemede kapalı bulmasına yol açardık.
    const opened = saved !== null && before < passThreshold && score >= passThreshold;
    setUnlockedNow(opened ? unlockedLabel(modeKey) : null);

    if (saved !== null) {
      setScores((prev) => ({
        ...(prev ?? {}),
        [stepId]: { ...(prev?.[stepId] ?? {}), [modeKey]: saved.best_score },
      }));
    }
    // Madde 7: oturum bitti — kayıt silinir, bir dahaki girişte taze bir set
    // hazırlanır (aksi halde bitmiş setin SON sorusuyla karşılaşılıyordu).
    clearSession(sessionKey(stepId, slug));
    setFinished({ correct: r.correct, total: r.total, score });
  }

  /** Pratiği YARIDA bırak: hiçbir şey kaydedilmez, sunucuya yazılmaz.
   *  handleFinish'ten AYRI tutulur — o puan yazar, kilit açar, sonuç gösterir. */
  function handleQuit() {
    if (!confirm('Bırakmak istediğine emin misin? Bu pratik kaydedilmeyecek.')) return;
    clearSession(sessionKey(stepId, slug));
    router.push('/home');
  }

  /** "Tekrar Dene": madde 2026-08-21 — artık AYNI seti değil, havuzdan
   *  mümkünse bir önceki setten FARKLI bir set çeker (pickFreshSet ile
   *  ilk yüklemeyle AYNI mantık). Önceden `exercises` state'i hiç
   *  değişmiyordu, bu yüzden "tekrar pratik yap" hep aynı sorularla
   *  karşılaşılıyordu. */
  function handleRetry() {
    setFinished(null);
    setUnlockedNow(null);
    setLeft(TIMED_SECONDS);
    setTimeUp(false);
    setRunId((n) => n + 1);
    pickFreshSet();
  }

  /** Kilit yalnızca skor haritası GERÇEKTEN alındıysa uygulanır. */
  const locked = scores !== null && !isModeUnlocked(orderedStepIds, stepId, modeKey, scores, thresholds);
  /** Kilit ekranında gösterilecek eşik: bu modu açmak için ÖNCEKİ modun eşiği
   *  (sureli için suresiz'in eşiği, test için sureli'nin eşiği). */
  const prevModeThreshold =
    modeKey === 'sureli' ? thresholdFor(thresholds, stepId, 'suresiz')
    : modeKey === 'test' ? thresholdFor(thresholds, stepId, 'sureli')
    : null;

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
    <main id="main-content" className="px-4 pt-5 pb-12 practice-shell mx-auto">
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
              ? `Önce "Ödevini Yap"ta ${prevModeThreshold} puan ve üzeri al.`
              : modeKey === 'test'
                ? `Önce "Süreli Pratik Yap"ta ${prevModeThreshold} puan ve üzeri al.`
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
          // Madde 7: son sorunun tahtası matlaşarak arka planda kalır.
          boardFen={[...(exercises ?? [])].reverse().find(isBoardExercise)?.fen ?? ''}
          headline={resultHeadline(modeKey, finished.score, passThreshold)}
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
          {randomPick > 0 && poolSize > exercises.length && (
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
            /* Madde 6: üç modda da (Süresiz/Süreli/Test) yanlış cevaptan
               sonra tekrar deneme YOK; sporcu "Sonraki Soruya Geç" ile ilerler. */
            noRetry
            initialIndex={startIndex}
            initialAnswer={startAnswer}
            initialDoneCount={startDoneCount}
            onIndexChange={(i) => {
              if (exercises) saveSession(sessionKey(stepId, slug), {
                items: exercises, index: i, currentAnswer: null, doneCount: solved,
              });
            }}
            onAnswered={(index, doneCount, answer) => {
              if (exercises) saveSession(sessionKey(stepId, slug), {
                items: exercises, index, currentAnswer: answer, doneCount,
              });
            }}
            quitSlot={(
              <button
                type="button"
                onClick={handleQuit}
                className="t-card-i w-full py-3 px-4 text-center text-sm font-semibold"
              >
                {mode.quitLabel}
              </button>
            )}
          />
        </>
      )}
    </main>
  );
}

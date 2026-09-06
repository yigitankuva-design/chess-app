'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  isSubtopicUnlocked, isLessonCompleted, thresholdFor,
} from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap, ThresholdMap } from '@/lib/practice/unlock';
import { fetchLessonScores, fetchPracticeDetail, fetchAttemptsSummary, fetchAttempts } from '@/lib/practice/practiceApi';
import type { PracticeDetail, AttemptsSummary, AttemptRow } from '@/lib/practice/practiceApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Madde 2026-09-05: Sporcu Profili — "Ders İlerlemesi" + "Ödevlerim".
 * Zafer'in gönderdiği görsele göre gerçek hiyerarşi: Düzey (TD/BD/OD/İD) →
 * Konu (1-8 kutucuk) → Alt Konu → mod (Ödevini Yap/Süreli Pratik Yap/
 * Kendini Test Et) → soru bazlı yeşil/kırmızı kare.
 *
 * Madde 2026-09-06 (Görsel 6/7): "Süreli Pratik Yap" ve "Kendini Test Et"
 * de artık gerçek veriye bağlı — üçü de TAMAMLANDI:
 *   - Ödevini Yap: en iyi denemenin soru bazlı yeşil/kırmızı kareleri.
 *   - Süreli Pratik Yap: Günlük/Haftalık/Aylık/Yıllık istatistik tablosu
 *     (child_practice_attempts'in TAKVİM dönemlerine göre toplamı).
 *   - Kendini Test Et: her deneme kendi "Sınav-N" sekmesi, seçilenin soru
 *     bazlı kareleri gösterilir.
 */

// Kodlar Zafer'in verdiği sırayla (TD-BD-OD-İD); isimler gerçek modül
// adlarıyla AYNI (scripts/reset_curriculum.py) — profile/page.tsx'teki
// mevcut LEVEL_ORDER/LEVEL_NAMES ile BİREBİR aynı sabitler (madde 5).
type LevelCode = 'TD' | 'BD' | 'OD' | 'İD';
const LEVEL_ORDER: LevelCode[] = ['TD', 'BD', 'OD', 'İD'];
const LEVEL_NAMES: Record<LevelCode, string> = {
  TD: 'Temel Düzey', BD: 'Başlangıç Düzeyi', OD: 'Orta Düzey', 'İD': 'İleri Düzey',
};

const MODE_TABS: { slug: PracticeMode; label: string }[] = [
  { slug: 'suresiz', label: 'Ödevini Yap' },
  { slug: 'sureli', label: 'Süreli Pratik Yap' },
  { slug: 'test', label: 'Kendini Test Et' },
];

interface ModuleSummary { id: number; name: string; lessons_count: number }
interface LessonSummary { id: number; order_index: number; title: string }
interface Subtopic { stepId: number; title: string }

export function LessonProgressCard() {
  const [level, setLevel] = useState<LevelCode>('TD');
  const [modules, setModules] = useState<ModuleSummary[] | null>(null);
  const [lessonsByModule, setLessonsByModule] = useState<Record<number, LessonSummary[]>>({});
  const [subtopicsByLesson, setSubtopicsByLesson] = useState<Record<number, Subtopic[]>>({});
  const [scoresByLesson, setScoresByLesson] = useState<Record<number, ScoreMap | null>>({});
  const [thresholdsByLesson, setThresholdsByLesson] = useState<Record<number, ThresholdMap>>({});

  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openSubtopic, setOpenSubtopic] = useState<{ lessonId: number; stepId: number; title: string } | null>(null);
  const [openMode, setOpenMode] = useState<PracticeMode | null>(null);
  const [practiceDetail, setPracticeDetail] = useState<PracticeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  /** Madde 2026-09-06 (Görsel 6): "Süreli Pratik Yap" — Günlük/Haftalık/Aylık/Yıllık. */
  const [attemptsSummary, setAttemptsSummary] = useState<AttemptsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  /** Madde 2026-09-06 (Görsel 7): "Kendini Test Et" — "Sınav-N" geçmişi. */
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [selectedAttemptIdx, setSelectedAttemptIdx] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/modules`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setModules(Array.isArray(list) ? list : []))
      .catch(() => setModules([]));
  }, []);

  const currentModule = modules?.find((m) => m.name === LEVEL_NAMES[level]) ?? null;

  const loadSubtopics = useCallback(async (lessonId: number) => {
    try {
      const detail = await fetch(`${API_BASE}/lessons/${lessonId}`).then((r) => (r.ok ? r.json() : { steps: [] }));
      const subs: Subtopic[] = (detail.steps ?? [])
        .filter((s: { type: string; content_json?: { title?: string } }) => s.type === 'explanation' && s.content_json?.title)
        .map((s: { id: number; content_json: { title: string } }) => ({ stepId: s.id, title: s.content_json.title }));
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: subs }));
      const thresholds: ThresholdMap = {};
      for (const s of (detail.steps ?? []) as { id: number; content_json?: { success_scores?: Record<string, number> } }[]) {
        const raw = s.content_json?.success_scores;
        if (!raw) continue;
        const entry: Partial<Record<PracticeMode, number>> = {};
        if (typeof raw.board_exercises === 'number') entry.suresiz = raw.board_exercises;
        if (typeof raw.board_exercises_timed === 'number') entry.sureli = raw.board_exercises_timed;
        if (typeof raw.board_exercises_test === 'number') entry.test = raw.board_exercises_test;
        if (Object.keys(entry).length > 0) thresholds[s.id] = entry;
      }
      setThresholdsByLesson((prev) => ({ ...prev, [lessonId]: thresholds }));
      const scoreMap = await fetchLessonScores(lessonId);
      setScoresByLesson((prev) => ({ ...prev, [lessonId]: scoreMap }));
    } catch {
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: [] }));
    }
  }, []);

  // Madde 10 ile AYNI mantık (home/page.tsx): bir düzeyin dersleri gelince,
  // HEPSİNİN alt konu+skor bilgisi ÖNCEDEN çekilir — hem "N/N konu
  // tamamlandı" başlığı hem kutucukların üstündeki gösterge bunsuz hesaplanamaz.
  useEffect(() => {
    if (!currentModule || lessonsByModule[currentModule.id]) return;
    const moduleId = currentModule.id;
    fetch(`${API_BASE}/modules/${moduleId}/lessons`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: LessonSummary[]) => {
        const lessons = Array.isArray(list) ? list : [];
        setLessonsByModule((prev) => ({ ...prev, [moduleId]: lessons }));
        void Promise.all(lessons.map((l) => loadSubtopics(l.id)));
      })
      .catch(() => setLessonsByModule((prev) => ({ ...prev, [moduleId]: [] })));
  }, [currentModule, lessonsByModule, loadSubtopics]);

  const lessons = currentModule ? lessonsByModule[currentModule.id] : undefined;
  const totalLessons = lessons?.length ?? 0;
  const completedLessons = (lessons ?? []).filter((l) => {
    const subs = subtopicsByLesson[l.id];
    if (!subs) return false;
    return isLessonCompleted(subs.map((s) => s.stepId), scoresByLesson[l.id] ?? undefined, thresholdsByLesson[l.id]);
  }).length;

  function selectLevel(code: LevelCode) {
    setLevel(code);
    setOpenLessonId(null);
    setOpenSubtopic(null);
    setOpenMode(null);
    setPracticeDetail(null);
    setAttemptsSummary(null);
    setAttempts(null);
  }

  function toggleLesson(lessonId: number) {
    setOpenLessonId((prev) => (prev === lessonId ? null : lessonId));
    setOpenSubtopic(null);
    setOpenMode(null);
    setPracticeDetail(null);
    setAttemptsSummary(null);
    setAttempts(null);
  }

  function toggleSubtopic(lessonId: number, sub: Subtopic) {
    setOpenSubtopic((prev) => (prev?.stepId === sub.stepId ? null : { lessonId, stepId: sub.stepId, title: sub.title }));
    setOpenMode(null);
    setPracticeDetail(null);
    setAttemptsSummary(null);
    setAttempts(null);
  }

  function selectMode(mode: PracticeMode) {
    setOpenMode((prev) => (prev === mode ? null : mode));
    setPracticeDetail(null);
    setAttemptsSummary(null);
    setAttempts(null);
    if (!openSubtopic) return;
    if (mode === 'suresiz') {
      setDetailLoading(true);
      fetchPracticeDetail(openSubtopic.stepId, 'suresiz')
        .then(setPracticeDetail)
        .finally(() => setDetailLoading(false));
    } else if (mode === 'sureli') {
      setSummaryLoading(true);
      fetchAttemptsSummary(openSubtopic.stepId, 'sureli')
        .then(setAttemptsSummary)
        .finally(() => setSummaryLoading(false));
    } else if (mode === 'test') {
      setAttemptsLoading(true);
      setSelectedAttemptIdx(0);
      fetchAttempts(openSubtopic.stepId, 'test')
        .then(setAttempts)
        .finally(() => setAttemptsLoading(false));
    }
  }

  const openLessonSubs = openLessonId != null ? subtopicsByLesson[openLessonId] : undefined;
  const openLessonScores = openLessonId != null ? scoresByLesson[openLessonId] : undefined;
  const openLessonThresholds = openLessonId != null ? thresholdsByLesson[openLessonId] : undefined;
  const orderedStepIds = (openLessonSubs ?? []).map((s) => s.stepId);

  const passThreshold = openSubtopic ? thresholdFor(openLessonThresholds, openSubtopic.stepId, 'suresiz') : 85;
  const suresizCompleted = practiceDetail != null && practiceDetail.best_score >= passThreshold;

  return (
    <div className="t-card p-4">
      <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
        <span className="text-xs font-bold uppercase tracking-wide t-muted">Ders İlerlemesi</span>
        <div className="flex gap-1.5">
          {LEVEL_ORDER.map((code) => (
            <button
              key={code} type="button" onClick={() => selectLevel(code)} aria-pressed={level === code}
              className="font-mono text-xs font-bold px-2.5 py-1 rounded-full transition-colors"
              style={{
                background: level === code ? 'var(--t-accent)' : 'var(--t-surface-2)',
                color: level === code ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
              }}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm font-bold mb-2.5">
        {LEVEL_NAMES[level]} · {completedLessons}/{totalLessons} konu tamamlandı
      </p>

      {lessons === undefined && <p className="text-xs t-muted py-1">Yükleniyor...</p>}
      {lessons?.length === 0 && <p className="text-xs t-muted py-1">Bu düzeyde henüz ders yok.</p>}

      {/* Madde 2026-09-06 (Görsel 5): sabit 4'lü satır ızgarası (auto-fill DEĞİL). */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {(lessons ?? []).map((l, i) => {
          const subs = subtopicsByLesson[l.id];
          const done = subs
            ? isLessonCompleted(subs.map((s) => s.stepId), scoresByLesson[l.id] ?? undefined, thresholdsByLesson[l.id])
            : false;
          // Madde 2026-09-05: sadece "Ödevini Yap" gerçek veriye bağlı — bu
          // konudaki TÜM alt konuların suresiz'i geçmiş mi? Süreli/Test için
          // görseller henüz gelmedi, o iki gösterge şimdilik boş kalır.
          const homeworkDone = subs != null && subs.length > 0 && subs.every((s) => {
            const score = scoresByLesson[l.id]?.[s.stepId]?.suresiz ?? 0;
            return score >= thresholdFor(thresholdsByLesson[l.id], s.stepId, 'suresiz');
          });
          return (
            <div key={l.id} className="text-center">
              <div className="flex gap-0.5 justify-center mb-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: homeworkDone ? 'var(--t-accent)' : 'var(--t-surface-2)' }} />
                <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--t-surface-2)' }} />
                <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--t-surface-2)' }} />
              </div>
              <button
                type="button"
                onClick={() => toggleLesson(l.id)}
                aria-pressed={openLessonId === l.id}
                aria-label={`${i + 1}. konu: ${l.title}`}
                className="w-full aspect-square rounded-md flex items-center justify-center text-sm font-bold transition-colors"
                style={{
                  background: openLessonId === l.id || done ? 'var(--t-accent)' : 'var(--t-surface-2)',
                  color: openLessonId === l.id || done ? 'var(--t-accent-fg)' : 'var(--t-text-1)',
                }}
              >
                {i + 1}
              </button>
            </div>
          );
        })}
      </div>

      {openLessonId != null && (() => {
        const lessonId = openLessonId;
        return (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--t-border)' }}>
          {openLessonSubs === undefined && <p className="text-xs t-muted py-1">Yükleniyor...</p>}
          {openLessonSubs?.length === 0 && <p className="text-xs t-muted py-1">Alt konu bulunamadı.</p>}
          <div className="flex flex-col gap-1.5">
            {openLessonSubs?.map((sub) => {
              const subOpen = openSubtopic?.stepId === sub.stepId;
              const locked = openLessonScores != null
                && !isSubtopicUnlocked(orderedStepIds, sub.stepId, openLessonScores, openLessonThresholds);
              return (
                <div key={sub.stepId}>
                  <button
                    type="button"
                    onClick={() => { if (!locked) toggleSubtopic(lessonId, sub); }}
                    aria-pressed={subOpen}
                    aria-disabled={locked}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: subOpen ? 'var(--t-accent)' : 'var(--t-surface-2)',
                      color: subOpen ? 'var(--t-accent-fg)' : 'var(--t-text-1)',
                      opacity: locked ? 0.5 : 1,
                    }}
                  >
                    {locked ? `🔒 ${sub.title}` : sub.title}
                  </button>

                  {subOpen && (
                    <div className="grid grid-cols-3 gap-1.5 mt-1.5 mb-2">
                      {MODE_TABS.map((m) => (
                        <button
                          key={m.slug} type="button" onClick={() => selectMode(m.slug)}
                          aria-pressed={openMode === m.slug}
                          className="px-2 py-1.5 rounded-lg text-xs font-bold transition-colors"
                          style={{
                            background: openMode === m.slug ? 'var(--t-accent)' : 'var(--t-surface-2)',
                            color: openMode === m.slug ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {openMode === 'sureli' && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--t-border)' }}>
          {summaryLoading && <p className="text-xs t-muted py-1 text-center">Yükleniyor...</p>}
          {!summaryLoading && attemptsSummary && (
            <div className="flex flex-col">
              {([
                ['Günlük', attemptsSummary.daily],
                ['Haftalık', attemptsSummary.weekly],
                ['Aylık', attemptsSummary.monthly],
                ['Yıllık', attemptsSummary.yearly],
              ] as const).map(([label, stat], i) => (
                <div key={label}
                  className="flex items-center justify-between gap-2 py-2 text-xs"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--t-border)' }}>
                  <span className="font-bold">{label}: {stat.total}</span>
                  <span>Doğru Sayısı: <b style={{ color: 'var(--t-ok-text)' }}>{stat.correct}</b></span>
                  <span>Yanlış Sayısı: <b style={{ color: 'var(--t-err-text)' }}>{stat.wrong}</b></span>
                  <span>Başarı Oranı: <b>%{stat.success_rate}</b></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {openMode === 'test' && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--t-border)' }}>
          {attemptsLoading && <p className="text-xs t-muted py-1 text-center">Yükleniyor...</p>}
          {!attemptsLoading && attempts && attempts.length === 0 && (
            <p className="text-xs t-muted py-1 text-center">Bu alt konuda henüz bir sınav denemesi yok.</p>
          )}
          {!attemptsLoading && attempts && attempts.length > 0 && (() => {
            const selected = attempts[selectedAttemptIdx] ?? attempts[0];
            const testThreshold = openSubtopic ? thresholdFor(openLessonThresholds, openSubtopic.stepId, 'test') : 85;
            const selectedScore = selected.total_count > 0
              ? Math.round((selected.correct_count / selected.total_count) * 100) : 0;
            const passed = selectedScore >= testThreshold;
            return (
              <>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {attempts.map((a, i) => (
                    <button
                      key={a.attempt_no} type="button" onClick={() => setSelectedAttemptIdx(i)}
                      aria-pressed={i === selectedAttemptIdx}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      style={{
                        background: i === selectedAttemptIdx ? 'var(--t-accent)' : 'var(--t-surface-2)',
                        color: i === selectedAttemptIdx ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
                      }}
                    >
                      Sınav - {a.attempt_no}
                    </button>
                  ))}
                </div>
                {selected.total_count > 0 && (
                  <div
                    className="grid gap-1.5 mx-auto mb-3"
                    style={{ gridTemplateColumns: `repeat(${Math.min(selected.total_count, 8)}, 22px)`, maxWidth: '100%' }}
                  >
                    {Array.from({ length: selected.total_count }, (_, i) => {
                      const result = selected.per_question_correct?.[i];
                      const bg = result === true ? 'var(--t-ok-text)' : result === false ? 'var(--t-err-text)' : 'var(--t-surface-2)';
                      return <div key={i} className="aspect-square rounded-md" style={{ background: bg }} />;
                    })}
                  </div>
                )}
                <p className="text-xs text-center" style={{ color: passed ? 'var(--t-ok-text)' : 'var(--t-err-text)' }}>
                  {passed
                    ? 'Tebrikler, sınav performansınız başarı eşiğinin üzerinde.'
                    : 'Maalesef sınav performansınız kritik eşiğin altındadır. Başarı sınırını geçmek için yeniden sınava girebilirsiniz.'}
                </p>
              </>
            );
          })()}
        </div>
      )}

      {openMode === 'suresiz' && openSubtopic && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--t-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide t-muted">Ödevlerim</span>
          </div>
          {detailLoading && <p className="text-xs t-muted py-1 text-center">Yükleniyor...</p>}
          {!detailLoading && practiceDetail && (
            /* Madde 2026-09-06 (Görsel 5): cümle + kare kartlar ortalanır. */
            <div className="text-center">
              <p className="text-sm font-bold italic mb-2">
                {openSubtopic.title} - {(lessons ?? []).findIndex((l) => l.id === openLessonId) + 1} konusuna ait
                ödev {suresizCompleted ? 'tamamlanmıştır' : 'tamamlanmamıştır'}.
              </p>
              {practiceDetail.pool_size === 0 ? (
                <p className="text-xs t-muted py-1">Bu alt konu için henüz soru eklenmedi.</p>
              ) : (
                <div
                  className="grid gap-1.5 mx-auto"
                  style={{ gridTemplateColumns: `repeat(${Math.min(practiceDetail.pool_size, 5)}, 22px)`, maxWidth: '100%' }}
                >
                  {Array.from({ length: practiceDetail.pool_size }, (_, i) => {
                    const result = practiceDetail.per_question_correct?.[i];
                    const bg = result === true ? 'var(--t-ok-text)' : result === false ? 'var(--t-err-text)' : 'var(--t-surface-2)';
                    return <div key={i} className="aspect-square rounded-md" style={{ background: bg }} />;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

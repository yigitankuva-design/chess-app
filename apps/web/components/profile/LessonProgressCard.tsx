'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  isSubtopicUnlocked, isLessonCompleted, thresholdFor,
} from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap, ThresholdMap } from '@/lib/practice/unlock';
import { fetchLessonScores, fetchPracticeDetail } from '@/lib/practice/practiceApi';
import type { PracticeDetail } from '@/lib/practice/practiceApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Madde 2026-09-05: Sporcu Profili — "Ders İlerlemesi" + "Ödevlerim".
 * Zafer'in gönderdiği görsele göre gerçek hiyerarşi: Düzey (TD/BD/OD/İD) →
 * Konu (1-8 kutucuk) → Alt Konu → mod (Ödevini Yap/Süreli Pratik Yap/
 * Kendini Test Et) → soru bazlı yeşil/kırmızı kare.
 *
 * Kapsam bilinçli olarak DAR: SADECE "Ödevini Yap" (suresiz) gerçek veriye
 * bağlı — Zafer'in kararı, Süreli Pratik Yap/Kendini Test Et için görselleri
 * SONRA gönderecek. Hiyerarşinin TAMAMI (4 seviye, 3 mod sekmesi) burada
 * kuruludur; diğer 2 mod "yakında" placeholder'ı gösterir (Video İzle
 * kartıyla AYNI desen — bkz. app/admin/content/lesson/[lessonId]/page.tsx).
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
  }

  function toggleLesson(lessonId: number) {
    setOpenLessonId((prev) => (prev === lessonId ? null : lessonId));
    setOpenSubtopic(null);
    setOpenMode(null);
    setPracticeDetail(null);
  }

  function toggleSubtopic(lessonId: number, sub: Subtopic) {
    setOpenSubtopic((prev) => (prev?.stepId === sub.stepId ? null : { lessonId, stepId: sub.stepId, title: sub.title }));
    setOpenMode(null);
    setPracticeDetail(null);
  }

  function selectMode(mode: PracticeMode) {
    setOpenMode((prev) => (prev === mode ? null : mode));
    setPracticeDetail(null);
    if (mode !== 'suresiz' || !openSubtopic) return;
    setDetailLoading(true);
    fetchPracticeDetail(openSubtopic.stepId, 'suresiz')
      .then(setPracticeDetail)
      .finally(() => setDetailLoading(false));
  }

  const openLessonSubs = openLessonId != null ? subtopicsByLesson[openLessonId] : undefined;
  const openLessonScores = openLessonId != null ? scoresByLesson[openLessonId] : undefined;
  const openLessonThresholds = openLessonId != null ? thresholdsByLesson[openLessonId] : undefined;
  const orderedStepIds = (openLessonSubs ?? []).map((s) => s.stepId);

  const passThreshold = openSubtopic ? thresholdFor(openLessonThresholds, openSubtopic.stepId, 'suresiz') : 85;
  const suresizCompleted = practiceDetail != null && practiceDetail.best_score >= passThreshold;

  return (
    <div className="t-card p-4">
      <div className="flex items-center justify-between mb-3">
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

      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))' }}>
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

      {openMode && openMode !== 'suresiz' && (
        <div className="mt-3 pt-3 border-t text-center py-4" style={{ borderColor: 'var(--t-border)' }}>
          <p className="text-sm t-muted">
            {MODE_TABS.find((m) => m.slug === openMode)?.label} için Ödevlerim görünümü yakında.
          </p>
        </div>
      )}

      {openMode === 'suresiz' && openSubtopic && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--t-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide t-muted">Ödevlerim</span>
          </div>
          {detailLoading && <p className="text-xs t-muted py-1">Yükleniyor...</p>}
          {!detailLoading && practiceDetail && (
            <>
              <p className="text-sm font-bold italic mb-2">
                {openSubtopic.title} - {(lessons ?? []).findIndex((l) => l.id === openLessonId) + 1} konusuna ait
                ödev {suresizCompleted ? 'tamamlanmıştır' : 'tamamlanmamıştır'}.
              </p>
              {practiceDetail.pool_size === 0 ? (
                <p className="text-xs t-muted py-1">Bu alt konu için henüz soru eklenmedi.</p>
              ) : (
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(22px, 1fr))' }}>
                  {Array.from({ length: practiceDetail.pool_size }, (_, i) => {
                    const result = practiceDetail.per_question_correct?.[i];
                    const bg = result === true ? 'var(--t-ok-text)' : result === false ? 'var(--t-err-text)' : 'var(--t-surface-2)';
                    return <div key={i} className="aspect-square rounded-md" style={{ background: bg }} />;
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

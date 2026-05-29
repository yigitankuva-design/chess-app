'use client';
import { use, useEffect, useState, useCallback, useRef } from 'react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Quiz {
  question: string;
  options: string[];
  correct_index: number;
}
interface StepContent {
  title?: string;
  body?: string;
  quiz?: Quiz;
  board_exercise?: BoardExerciseConfig;   // legacy single
  board_exercises?: BoardExerciseConfig[]; // new: array of 10
}
interface Step {
  id: number;
  order_index: number;
  type: string;
  content_json: StepContent;
}
interface LessonSummary {
  id: number;
  order_index: number;
  title: string;
  estimated_minutes: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const LS_STEP = (lid: number, sid: number) => `bea_s_${lid}_${sid}`;
const LS_LESSON = (lid: number) => `bea_l_${lid}`;

// ─── Inline Quiz ─────────────────────────────────────────────────────────────
function InlineQuiz({ quiz, done, onCorrect }: { quiz: Quiz; done: boolean; onCorrect: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(done);
  const correct = done || (answered && selected === quiz.correct_index);

  const pick = (i: number) => {
    if (answered || done) return;
    setSelected(i);
    setAnswered(true);
    if (i === quiz.correct_index) onCorrect();
  };

  const retry = () => { setSelected(null); setAnswered(false); };

  const optionStyle = (i: number): React.CSSProperties => {
    if (!answered && !done) return {};
    if (i === quiz.correct_index) return { background: '#dcfce7', borderColor: '#16a34a', color: '#15803d' };
    if (i === selected) return { background: '#fee2e2', borderColor: '#dc2626', color: '#b91c1c' };
    return { opacity: 0.5 };
  };

  return (
    <div className="mt-4 space-y-2 pt-3" style={{ borderTop: '1px solid var(--t-border)' }}>
      <p className="text-sm font-semibold">{quiz.question}</p>
      <div className="space-y-1.5">
        {quiz.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            disabled={answered || done}
            className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
            style={{
              border: '1px solid var(--t-border)',
              background: 'var(--t-surface)',
              ...optionStyle(i),
              cursor: answered || done ? 'default' : 'pointer',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      {answered && !done && (
        <div className="flex items-center gap-3 pt-1">
          {correct ? (
            <span className="text-sm font-medium" style={{ color: '#16a34a' }}>✓ Doğru! Harika iş çıkardın.</span>
          ) : (
            <>
              <span className="text-sm font-medium" style={{ color: '#dc2626' }}>✗ Yanlış, tekrar dene!</span>
              <button onClick={retry} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--t-surface-2)' }}>
                Tekrar →
              </button>
            </>
          )}
        </div>
      )}
      {done && (
        <span className="text-sm font-medium" style={{ color: '#16a34a' }}>✓ Tamamlandı</span>
      )}
    </div>
  );
}

// ─── Done circle ──────────────────────────────────────────────────────────────
const DoneCircle = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="9" cy="9" r="8" fill="white" stroke="black" strokeWidth="1.5" />
    <path d="M5 9.5L7.5 12L13 6" stroke="#16a34a" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Icons ────────────────────────────────────────────────────────────────────
const ChevronDown = ({ open }: { open: boolean }) => (
  <svg className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    style={{ color: 'var(--t-muted)' }}
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const ChevronRight = ({ open }: { open: boolean }) => (
  <svg className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    style={{ color: 'var(--t-muted)' }}
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ color: 'var(--t-muted)', flexShrink: 0 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ModuleLessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedLesson, setExpandedLesson] = useState<number | null>(null);
  const [lessonSteps, setLessonSteps] = useState<Record<number, Step[]>>({});
  const [stepsLoading, setStepsLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Completion state (hydrated from localStorage)
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [doneLessons, setDoneLessons] = useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Load lessons
  useEffect(() => {
    fetch(`${API_BASE}/modules/${id}/lessons`)
      .then((r) => r.json())
      .then((data) => { setLessons(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // Hydrate completion state from localStorage
  useEffect(() => {
    const stepSet = new Set<string>();
    const lessonSet = new Set<number>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('bea_s_') && localStorage.getItem(k) === '1') stepSet.add(k.slice(6));
      if (k.startsWith('bea_l_') && localStorage.getItem(k) === '1') {
        lessonSet.add(Number(k.slice(6)));
      }
    }
    setDoneSteps(stepSet);
    setDoneLessons(lessonSet);
    setHydrated(true);
  }, []);

  const isStepDone = (lessonId: number, stepId: number) =>
    doneSteps.has(`${lessonId}_${stepId}`);

  const isStepAccessible = (lessonId: number, steps: Step[], idx: number) => {
    if (!hydrated) return false;
    if (idx === 0) return true;
    return isStepDone(lessonId, steps[idx - 1].id);
  };

  const markStepDone = useCallback((lessonId: number, stepId: number, steps: Step[]) => {
    const key = `${lessonId}_${stepId}`;
    localStorage.setItem(LS_STEP(lessonId, stepId), '1');
    setDoneSteps((prev) => {
      const next = new Set([...prev, key]);
      // Check if all steps done → mark lesson done
      if (steps.every((s) => next.has(`${lessonId}_${s.id}`))) {
        localStorage.setItem(LS_LESSON(lessonId), '1');
        setDoneLessons((p) => new Set([...p, lessonId]));
      }
      return next;
    });
  }, []);

  const loadSteps = useCallback(async (lessonId: number) => {
    setStepsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/lessons/${lessonId}`);
      const data = await res.json();
      setLessonSteps((prev) => ({ ...prev, [lessonId]: data.steps || [] }));
    } catch {
      setLessonSteps((prev) => ({ ...prev, [lessonId]: [] }));
    }
    setStepsLoading(false);
  }, []);

  const toggleLesson = useCallback(async (lesson: LessonSummary) => {
    const lessonId = lesson.id;
    if (expandedLesson === lessonId) { setExpandedLesson(null); setExpandedStep(null); return; }
    setExpandedLesson(lessonId);
    setExpandedStep(null);
    // Remember as the last opened lesson (for "restart last lesson" shortcut)
    try {
      localStorage.setItem('bea_last_lesson', JSON.stringify({
        moduleId: Number(id), lessonId, title: lesson.title, orderIndex: lesson.order_index,
      }));
    } catch { /* ignore */ }
    if (!lessonSteps[lessonId]) await loadSteps(lessonId);
  }, [expandedLesson, lessonSteps, id, loadSteps]);

  // Restart-last-lesson deep link: ?restart={lessonId} clears that lesson's
  // progress and auto-opens it from the start.
  const restartHandled = useRef(false);
  useEffect(() => {
    if (restartHandled.current || !hydrated || lessons.length === 0) return;
    const restartId = new URLSearchParams(window.location.search).get('restart');
    if (!restartId) return;
    restartHandled.current = true;
    const lid = Number(restartId);

    // Wipe this lesson's step + lesson completion keys
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith(`bea_s_${lid}_`) || k === `bea_l_${lid}`) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    setDoneSteps((prev) => {
      const next = new Set(prev);
      [...next].forEach((key) => { if (key.startsWith(`${lid}_`)) next.delete(key); });
      return next;
    });
    setDoneLessons((prev) => { const n = new Set(prev); n.delete(lid); return n; });

    // Open it
    setExpandedLesson(lid);
    setExpandedStep(null);
    if (!lessonSteps[lid]) void loadSteps(lid);
  }, [hydrated, lessons, lessonSteps, loadSteps]);

  const toggleStep = (accessible: boolean, stepId: number) => {
    if (!accessible) return;
    setExpandedStep((prev) => (prev === stepId ? null : stepId));
  };

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto">
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="t-skel h-14 rounded-xl" />)}
        </div>
      ) : lessons.length === 0 ? (
        <p className="t-muted text-sm">Bu modüle henüz ders eklenmedi.</p>
      ) : (
        <div className="space-y-3">
          {lessons.map((l) => {
            const isOpen = expandedLesson === l.id;
            const steps = lessonSteps[l.id] || [];
            const lessonDone = hydrated && doneLessons.has(l.id);

            return (
              <div key={l.id} className="rounded-xl overflow-hidden"
                style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)' }}>

                {/* ── Lesson accordion header ── */}
                <button onClick={() => toggleLesson(l)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors"
                  style={isOpen ? { background: 'color-mix(in srgb, var(--t-accent) 6%, transparent)' } : {}}>
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--t-surface-2)', color: 'var(--t-accent)' }}>
                    {l.order_index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {l.order_index}. {l.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--t-muted)' }}>
                      {lessonDone
                        ? '✓ Tamamlandı'
                        : `~${l.estimated_minutes} dakika`}
                    </p>
                  </div>
                  {lessonDone && <DoneCircle />}
                  <ChevronDown open={isOpen} />
                </button>

                {/* ── Expanded content ── */}
                {isOpen && (
                  <div className="pb-4" style={{ borderTop: '1px solid var(--t-border)' }}>
                    {stepsLoading && !lessonSteps[l.id] ? (
                      <div className="px-4 pt-3 space-y-2">
                        {[1, 2, 3].map((i) => <div key={i} className="t-skel h-10 rounded-lg" />)}
                      </div>
                    ) : steps.length === 0 ? (
                      <p className="px-4 pt-3 text-xs" style={{ color: 'var(--t-muted)' }}>İçerik henüz eklenmedi.</p>
                    ) : (
                      <div className="px-4 pt-3 space-y-1.5">
                        {steps.map((step, idx) => {
                          const accessible = isStepAccessible(l.id, steps, idx);
                          const stepOpen = expandedStep === step.id;
                          const stepDone = hydrated && isStepDone(l.id, step.id);
                          const content = step.content_json;
                          const label = `${l.order_index}.${step.order_index}`;

                          return (
                            <div key={step.id} className="rounded-lg overflow-hidden"
                              style={{
                                background: accessible ? 'var(--t-surface-2)' : 'color-mix(in srgb, var(--t-surface-2) 50%, transparent)',
                                border: stepDone ? '1px solid #16a34a33' : '1px solid transparent',
                              }}>

                              {/* Sub-topic button */}
                              <button
                                onClick={() => toggleStep(accessible, step.id)}
                                disabled={!accessible}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                                style={{ cursor: accessible ? 'pointer' : 'not-allowed' }}>
                                {!accessible
                                  ? <LockIcon />
                                  : <ChevronRight open={stepOpen} />}
                                <span className="text-xs font-bold flex-shrink-0 w-7"
                                  style={{ color: 'var(--t-accent)' }}>
                                  {label}
                                </span>
                                <span className="text-sm flex-1" style={{
                                  color: accessible ? 'inherit' : 'var(--t-muted)',
                                  fontWeight: accessible ? 500 : 400,
                                }}>
                                  {content.title || `Konu ${step.order_index}`}
                                </span>
                                {stepDone && <DoneCircle />}
                              </button>

                              {/* Expanded step content */}
                              {accessible && stepOpen && (
                                <div className="px-3 pb-4">
                                  {content.body && (
                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--t-muted)' }}>
                                      {content.body}
                                    </p>
                                  )}
                                  {/* Board exercises (array) takes priority */}
                                  {(content.board_exercises || content.board_exercise) && (
                                    <BoardExercise
                                      exercises={
                                        content.board_exercises ??
                                        (content.board_exercise ? [content.board_exercise] : [])
                                      }
                                      done={stepDone}
                                      onCorrect={() => markStepDone(l.id, step.id, steps)}
                                    />
                                  )}
                                  {!content.board_exercises && !content.board_exercise && content.quiz && (
                                    <InlineQuiz
                                      quiz={content.quiz}
                                      done={stepDone}
                                      onCorrect={() => markStepDone(l.id, step.id, steps)}
                                    />
                                  )}
                                  {!content.board_exercises && !content.board_exercise && !content.quiz && !stepDone && (
                                    <button
                                      onClick={() => markStepDone(l.id, step.id, steps)}
                                      className="mt-3 text-sm px-4 py-2 rounded-lg font-medium"
                                      style={{ background: 'var(--t-accent)', color: '#fff' }}>
                                      Tamamladım →
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

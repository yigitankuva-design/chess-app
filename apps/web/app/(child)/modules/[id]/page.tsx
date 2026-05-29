'use client';
import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface StepContent {
  title?: string;
  body?: string;
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

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    style={{ color: 'var(--t-muted)' }}
    width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const ChevronRight = ({ open }: { open: boolean }) => (
  <svg
    className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    style={{ color: 'var(--t-muted)' }}
    width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function ModuleLessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // accordion state
  const [expandedLesson, setExpandedLesson] = useState<number | null>(null);
  const [lessonSteps, setLessonSteps] = useState<Record<number, Step[]>>({});
  const [stepsLoading, setStepsLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/modules/${id}/lessons`)
      .then((r) => r.json())
      .then((data) => { setLessons(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const toggleLesson = useCallback(async (lessonId: number) => {
    if (expandedLesson === lessonId) {
      setExpandedLesson(null);
      setExpandedStep(null);
      return;
    }
    setExpandedLesson(lessonId);
    setExpandedStep(null);

    if (!lessonSteps[lessonId]) {
      setStepsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/lessons/${lessonId}`);
        const data = await res.json();
        setLessonSteps((prev) => ({ ...prev, [lessonId]: data.steps || [] }));
      } catch {
        setLessonSteps((prev) => ({ ...prev, [lessonId]: [] }));
      }
      setStepsLoading(false);
    }
  }, [expandedLesson, lessonSteps]);

  const toggleStep = (stepId: number) => {
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
        <div className="space-y-2">
          {lessons.map((l) => {
            const isOpen = expandedLesson === l.id;
            const steps = lessonSteps[l.id] || [];

            return (
              <div
                key={l.id}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--t-surface)', border: '1px solid var(--t-border)' }}
              >
                {/* Lesson header — accordion trigger */}
                <button
                  onClick={() => toggleLesson(l.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors"
                  style={isOpen ? { background: 'color-mix(in srgb, var(--t-accent) 6%, transparent)' } : {}}
                >
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--t-surface-2)', color: 'var(--t-accent)' }}
                  >
                    {l.order_index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{l.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--t-muted)' }}>
                      ~{l.estimated_minutes} dakika
                    </p>
                  </div>
                  <ChevronDown open={isOpen} />
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div
                    className="px-4 pb-4 space-y-1"
                    style={{ borderTop: '1px solid var(--t-border)' }}
                  >
                    {stepsLoading && !lessonSteps[l.id] ? (
                      <div className="space-y-2 pt-3">
                        {[1, 2, 3].map((i) => <div key={i} className="t-skel h-10 rounded-lg" />)}
                      </div>
                    ) : steps.length === 0 ? (
                      <p className="text-xs pt-3" style={{ color: 'var(--t-muted)' }}>
                        Bu ders henüz içerik içermiyor.
                      </p>
                    ) : (
                      <>
                        <div className="pt-2 space-y-1">
                          {steps.map((step) => {
                            const stepOpen = expandedStep === step.id;
                            const content = step.content_json;

                            return (
                              <div key={step.id} className="rounded-lg overflow-hidden"
                                style={{ background: 'var(--t-surface-2)' }}>
                                {/* Sub-topic trigger */}
                                <button
                                  onClick={() => toggleStep(step.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                                >
                                  <ChevronRight open={stepOpen} />
                                  <span className="text-sm font-medium flex-1">
                                    {content.title || `Konu ${step.order_index}`}
                                  </span>
                                </button>

                                {/* Sub-topic description */}
                                {stepOpen && content.body && (
                                  <div className="px-3 pb-3">
                                    <p
                                      className="text-sm leading-relaxed"
                                      style={{ color: 'var(--t-muted)' }}
                                    >
                                      {content.body}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Start lesson button */}
                        <div className="pt-3">
                          <Link
                            href={`/lesson/${l.id}`}
                            className="t-btn block text-center py-2.5 text-sm font-semibold rounded-lg"
                          >
                            Dersi Başlat →
                          </Link>
                        </div>
                      </>
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

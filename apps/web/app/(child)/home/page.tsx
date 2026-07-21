'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { getAthleteName } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const LEVEL_META = [
  { id: 1, emoji: '🌱' },
  { id: 2, emoji: '😊' },
  { id: 3, emoji: '😎' },
  { id: 4, emoji: '🔥' },
];

// Eğlence sekmesinin açılır alt menüleri
const EGLENCE_GAMES = [
  { slug: 'bulmaca-duellosu', emoji: '⚔️', label: 'Bulmaca Düellosu' },
  { slug: 'bulmaca-firtinasi', emoji: '🌪️', label: 'Bulmaca Fırtınası' },
  { slug: 'koordinat-yarisi', emoji: '🏁', label: 'Koordinat Yarışı' },
  { slug: 'acilisi-tahmin-et', emoji: '🎯', label: 'Açılışı Tahmin Et' },
];

// Her hızlı erişim sekmesi farklı renk
const FEATURE_COLORS = {
  play: '#34d399',     // yeşil
  lessons: '#38bdf8',  // mavi
  analiz: '#a78bfa',   // mor
  eglence: '#f472b6',  // pembe
};

// Alt konu dairelerinde sırayla kullanılacak emojiler
const SUBTOPIC_EMOJIS = ['📋', '🎯', '🛤️', '♟️', '🏁', '✅', '📖', '🧩', '👑', '⭐'];

// Pratik modu kartları — alt konu seçildiğinde gösterilir
const PRACTICE_MODES = [
  { slug: 'suresiz', emoji: '♾️', label: 'Süresiz Pratik Yap', color: '#2dd4bf' },
  { slug: 'sureli',  emoji: '⏱️', label: 'Süreli Pratik Yap',  color: '#fbbf24' },
  { slug: 'test',    emoji: '📝', label: 'Kendini Test Et',    color: '#a78bfa' },
];

const QA_STATE_KEY = 'bea_qa_state_v2';

interface LessonSummary { id: number; order_index: number; title: string; estimated_minutes: number }
interface Subtopic { stepId: number; title: string }

function featTabStyle(color: string, active: boolean): React.CSSProperties {
  return {
    borderColor: color,
    boxShadow: active
      ? `0 0 22px -4px ${color}, inset 0 0 0 1px ${color}`
      : `0 0 18px -8px ${color}`,
    background: active ? `color-mix(in srgb, ${color} 12%, var(--t-surface))` : undefined,
  };
}

function SubtopicCircle({ emoji, label, active, onClick }: { emoji: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex justify-center">
      <div
        className="rounded-full flex flex-col items-center justify-center text-center p-3 transition-transform active:scale-95 hover:-translate-y-0.5"
        style={{
          width: '100%',
          maxWidth: 140,
          aspectRatio: '1 / 1',
          background: active
            ? 'radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--t-accent) 38%, var(--t-surface)), var(--t-surface))'
            : 'radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--t-accent) 22%, var(--t-surface)), var(--t-surface))',
          border: `1px solid color-mix(in srgb, var(--t-accent) ${active ? 80 : 55}%, transparent)`,
          boxShadow: '0 0 26px -6px var(--t-glow), inset 0 0 18px -10px var(--t-accent)',
        }}
      >
        <span className="text-2xl leading-none mb-1">{emoji}</span>
        <span className="text-[0.72rem] font-bold leading-tight" style={{ color: 'var(--t-text-1)' }}>{label}</span>
      </div>
    </button>
  );
}

export default function ChildHomePage() {
  const { settings } = useSettings();
  const [showLevels, setShowLevels] = useState(false);
  const [showEglence, setShowEglence] = useState(false);
  const [athleteName, setAthleteName] = useState<string | null>(null);

  // Düzeyler → Dersler → Alt Konular → Pratik hiyerarşisi
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [lessonsByLevel, setLessonsByLevel] = useState<Record<number, LessonSummary[]>>({});
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [subtopicsByLesson, setSubtopicsByLesson] = useState<Record<number, Subtopic[]>>({});
  const [openSubtopic, setOpenSubtopic] = useState<{ lessonId: number; stepId: number; title: string } | null>(null);

  const L = settings.labels;
  const restored = useRef(false);

  useEffect(() => {
    setAthleteName(getAthleteName());
  }, []);

  const loadLessons = useCallback(async (levelId: number) => {
    setLessonsByLevel((prev) => (prev[levelId] ? prev : { ...prev, [levelId]: [] }));
    try {
      const lessons: LessonSummary[] = await fetch(`${API_BASE}/modules/${levelId}/lessons`).then((r) => (r.ok ? r.json() : []));
      setLessonsByLevel((prev) => ({ ...prev, [levelId]: Array.isArray(lessons) ? lessons : [] }));
    } catch {
      setLessonsByLevel((prev) => ({ ...prev, [levelId]: [] }));
    }
  }, []);

  const loadSubtopics = useCallback(async (lessonId: number) => {
    setSubtopicsByLesson((prev) => (prev[lessonId] ? prev : { ...prev, [lessonId]: [] }));
    try {
      const detail = await fetch(`${API_BASE}/lessons/${lessonId}`).then((r) => (r.ok ? r.json() : { steps: [] }));
      const subs: Subtopic[] = (detail.steps ?? [])
        .filter((s: { type: string; content_json?: { title?: string } }) => s.type === 'explanation' && s.content_json?.title)
        .map((s: { id: number; content_json: { title: string } }) => ({ stepId: s.id, title: s.content_json.title }));
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: subs }));
    } catch {
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: [] }));
    }
  }, []);

  // Geri dönünce açılım durumunu koru (en başa dönmesin)
  useEffect(() => {
    try {
      const st = JSON.parse(sessionStorage.getItem(QA_STATE_KEY) || '{}');
      if (st.showLevels) setShowLevels(true);
      if (st.showEglence) setShowEglence(true);
      if (st.openLevel) { setOpenLevel(st.openLevel); loadLessons(st.openLevel); }
      if (st.openLessonId) { setOpenLessonId(st.openLessonId); loadSubtopics(st.openLessonId); }
      if (st.openSubtopic) setOpenSubtopic(st.openSubtopic);
    } catch { /* ignore */ }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(QA_STATE_KEY, JSON.stringify({ showLevels, showEglence, openLevel, openLessonId, openSubtopic }));
    } catch { /* ignore */ }
  }, [showLevels, showEglence, openLevel, openLessonId, openSubtopic]);

  function toggleLevel(levelId: number) {
    const opening = openLevel !== levelId;
    setOpenLevel(opening ? levelId : null);
    setOpenLessonId(null);
    setOpenSubtopic(null);
    if (opening && !lessonsByLevel[levelId]) loadLessons(levelId);
  }

  function toggleLesson(lessonId: number) {
    const opening = openLessonId !== lessonId;
    setOpenLessonId(opening ? lessonId : null);
    setOpenSubtopic(null);
    if (opening && !subtopicsByLesson[lessonId]) loadSubtopics(lessonId);
  }

  function toggleSubtopic(lessonId: number, sub: Subtopic) {
    const opening = !(openSubtopic?.lessonId === lessonId && openSubtopic.stepId === sub.stepId);
    setOpenSubtopic(opening ? { lessonId, stepId: sub.stepId, title: sub.title } : null);
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-8">
      {athleteName && (
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏅</span>
          <div>
            <p className="text-xs t-muted uppercase tracking-widest">Sporcu</p>
            <p className="text-2xl font-extrabold t-premium">{athleteName}</p>
          </div>
        </div>
      )}
      <section aria-label={L.sections.quickAccess}>
        <p className="text-sm font-bold t-premium uppercase tracking-widest mb-3">
          {L.sections.quickAccess}
        </p>

        {/* Sekmeler — her biri farklı renk, yazılar ortalı */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {settings.tabs.play && (
            <Link href="/play" className="t-feat" style={featTabStyle(FEATURE_COLORS.play, false)}>
              <span className="text-3xl leading-none">🎮</span>
              <span className="text-xs font-semibold leading-tight text-center" style={{ color: FEATURE_COLORS.play }}>
                {L.features.play}
              </span>
            </Link>
          )}

          {/* Dersler — açılır: Düzeyler */}
          <button
            onClick={() => setShowLevels((v) => !v)}
            className="t-feat transition-colors"
            style={featTabStyle(FEATURE_COLORS.lessons, showLevels)}
          >
            <span className="text-3xl leading-none">📚</span>
            <span className="text-xs font-semibold leading-tight text-center" style={{ color: FEATURE_COLORS.lessons }}>
              {L.features.lessons}
            </span>
          </button>
        </div>

        {/* 1. Düzeyler */}
        {showLevels && (
          <div className="mb-3">
            <p className="text-sm font-bold t-premium uppercase tracking-widest mb-3 px-1 text-center">
              {L.sections.lessonsPick}
            </p>
            <div className="space-y-2">
              {LEVEL_META.map((lv) => {
                const levelOpen = openLevel === lv.id;
                const lessons = lessonsByLevel[lv.id];
                return (
                  <div key={lv.id}>
                    <button
                      onClick={() => toggleLevel(lv.id)}
                      className="t-card-i w-full flex flex-col items-center justify-center gap-1 px-4 py-4 rounded-xl text-center"
                      style={levelOpen ? { borderColor: 'var(--t-accent)' } : undefined}
                    >
                      <span className="text-3xl leading-none">{lv.emoji}</span>
                      <span className="font-semibold text-sm">{lv.id}. {L.levels[String(lv.id)] ?? ''}</span>
                    </button>

                    {/* 2. Dersler */}
                    {levelOpen && (
                      <div className="mt-2 space-y-2 pl-2">
                        {lessons === undefined && <p className="text-xs t-muted text-center py-2">Yükleniyor...</p>}
                        {lessons?.length === 0 && <p className="text-xs t-muted text-center py-2">Bu düzeyde henüz ders yok.</p>}
                        {lessons?.map((les) => {
                          const lessonOpen = openLessonId === les.id;
                          const subs = subtopicsByLesson[les.id];
                          return (
                            <div key={les.id}>
                              <button
                                onClick={() => toggleLesson(les.id)}
                                className="t-card-i w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left"
                                style={lessonOpen ? { borderColor: 'var(--t-accent)' } : undefined}
                              >
                                <span className="text-xl leading-none flex-shrink-0">📘</span>
                                <span className="font-medium text-sm flex-1">{les.title}</span>
                                <svg className="flex-shrink-0 opacity-40" width="14" height="14" viewBox="0 0 24 24"
                                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 18l6-6-6-6" />
                                </svg>
                              </button>

                              {/* 3. Alt Konular */}
                              {lessonOpen && (
                                <div className="mt-2 pl-3 space-y-3">
                                  {subs === undefined && <p className="text-xs t-muted text-center py-2">Yükleniyor...</p>}
                                  {subs?.length === 0 && <p className="text-xs t-muted text-center py-2">Alt konu bulunamadı.</p>}
                                  {subs && subs.length > 0 && (
                                    <div className="grid grid-cols-2 gap-4 justify-items-center">
                                      {subs.map((sub, i) => (
                                        <SubtopicCircle
                                          key={sub.stepId}
                                          emoji={SUBTOPIC_EMOJIS[i % SUBTOPIC_EMOJIS.length]}
                                          label={sub.title}
                                          active={openSubtopic?.stepId === sub.stepId}
                                          onClick={() => toggleSubtopic(les.id, sub)}
                                        />
                                      ))}
                                    </div>
                                  )}

                                  {/* 4. Pratik modları */}
                                  {openSubtopic?.lessonId === les.id && subs?.some((s) => s.stepId === openSubtopic.stepId) && (
                                    <div className="mt-1">
                                      <p className="text-xs font-bold t-muted uppercase tracking-wide text-center mb-2">
                                        {openSubtopic.title}
                                      </p>
                                      <div className="grid grid-cols-2 gap-3">
                                        {PRACTICE_MODES.map((m, idx) => (
                                          <Link
                                            key={m.slug}
                                            href={`/pratik/${m.slug}?konu=${encodeURIComponent(openSubtopic.title)}&step=${openSubtopic.stepId}`}
                                            className={`t-feat ${idx === PRACTICE_MODES.length - 1 ? 'col-span-2' : ''}`}
                                            style={featTabStyle(m.color, false)}
                                          >
                                            <span className="text-3xl leading-none">{m.emoji}</span>
                                            <span className="text-xs font-semibold leading-tight text-center" style={{ color: m.color }}>
                                              {m.label}
                                            </span>
                                          </Link>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Analiz Et + Eğlence */}
        {(settings.tabs.analiz || settings.tabs.eglence) && (
          <div className="grid grid-cols-2 gap-3">
            {settings.tabs.analiz && (
              <Link href="/analiz" className="t-feat" style={featTabStyle(FEATURE_COLORS.analiz, false)}>
                <span className="text-3xl leading-none">🔍</span>
                <span className="text-xs font-semibold leading-tight text-center" style={{ color: FEATURE_COLORS.analiz }}>
                  {L.features.analiz}
                </span>
              </Link>
            )}
            {settings.tabs.eglence && (
              <button
                onClick={() => setShowEglence((v) => !v)}
                className="t-feat transition-colors"
                style={featTabStyle(FEATURE_COLORS.eglence, showEglence)}
              >
                <span className="text-3xl leading-none">🎉</span>
                <span className="text-xs font-semibold leading-tight text-center" style={{ color: FEATURE_COLORS.eglence }}>
                  {L.features.eglence}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Eğlence açılır alt menü — yazılar ortalı */}
        {settings.tabs.eglence && showEglence && (
          <div className="mt-3">
            <p className="text-sm font-bold t-premium uppercase tracking-widest mb-3 px-1 text-center">
              {L.features.eglence}
            </p>
            <div className="space-y-2">
              {EGLENCE_GAMES.map((g) => (
                <Link
                  key={g.slug}
                  href={`/eglence/${g.slug}`}
                  className="t-card-i flex flex-col items-center justify-center gap-1 px-4 py-4 rounded-xl text-center"
                >
                  <span className="text-3xl leading-none">{g.emoji}</span>
                  <span className="font-semibold text-sm">{g.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

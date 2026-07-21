'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getAthleteName } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const LEVEL_META = [
  { id: 1, emoji: '🌱', href: '/modules/1' },
  { id: 2, emoji: '😊', href: '/modules/2' },
  { id: 3, emoji: '😎', href: '/modules/3' },
  { id: 4, emoji: '🔥', href: '/modules/4' },
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

interface SubtopicLesson { lessonId: number; title: string; subtopics: string[] }

// Alt konu dairelerinde sırayla kullanılacak emojiler
const SUBTOPIC_EMOJIS = ['📋', '🎯', '🛤️', '♟️', '🏁', '✅', '📖', '🧩', '👑', '⭐'];

function featTabStyle(color: string, active: boolean): React.CSSProperties {
  return {
    borderColor: color,
    boxShadow: active
      ? `0 0 22px -4px ${color}, inset 0 0 0 1px ${color}`
      : `0 0 18px -8px ${color}`,
    background: active ? `color-mix(in srgb, ${color} 12%, var(--t-surface))` : undefined,
  };
}

export default function ChildHomePage() {
  const { settings } = useSettings();
  const [showLevels, setShowLevels] = useState(false);
  const [showEglence, setShowEglence] = useState(false);
  const [showTemel, setShowTemel] = useState(false);
  const [temel, setTemel] = useState<SubtopicLesson[] | null>(null);
  const [athleteName, setAthleteName] = useState<string | null>(null);

  const L = settings.labels;

  useEffect(() => {
    setAthleteName(getAthleteName());
  }, []);

  // Temel düzey (modül 1) derslerinin alt konularını yükle
  const loadTemel = useCallback(async () => {
    try {
      const lessons = await fetch(`${API_BASE}/modules/1/lessons`).then((r) => (r.ok ? r.json() : []));
      const out: SubtopicLesson[] = [];
      for (const les of Array.isArray(lessons) ? lessons : []) {
        const detail = await fetch(`${API_BASE}/lessons/${les.id}`).then((r) => (r.ok ? r.json() : { steps: [] }));
        const subs: string[] = (detail.steps ?? [])
          .filter((s: { type: string; content_json?: { title?: string } }) => s.type === 'explanation' && s.content_json?.title)
          .map((s: { content_json: { title: string } }) => s.content_json.title);
        out.push({ lessonId: les.id, title: les.title, subtopics: subs });
      }
      setTemel(out);
    } catch {
      setTemel([]);
    }
  }, []);

  function toggleTemel() {
    setShowTemel((v) => {
      const nv = !v;
      if (nv && temel === null) loadTemel();
      return nv;
    });
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

          {/* Dersler — açılır */}
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

        {/* Dersler açılınca: düzeyler */}
        {showLevels && (
          <div className="mb-3">
            <p className="text-sm font-bold t-premium uppercase tracking-widest mb-3 px-1 text-center">
              {L.sections.lessonsPick}
            </p>
            <div className="space-y-2">
              {LEVEL_META.map((lv) => {
                // Temel Düzey (1) açılır: alt konuları gösterir
                if (lv.id === 1) {
                  return (
                    <div key={lv.id}>
                      <button
                        onClick={toggleTemel}
                        className="t-card-i w-full flex flex-col items-center justify-center gap-1 px-4 py-4 rounded-xl text-center"
                        style={showTemel ? { borderColor: 'var(--t-accent)' } : undefined}
                      >
                        <span className="text-3xl leading-none">{lv.emoji}</span>
                        <span className="font-semibold text-sm">{lv.id}. {L.levels['1'] ?? ''}</span>
                      </button>

                      {/* Alt konular açılır kartlar */}
                      {showTemel && (
                        <div className="mt-2 space-y-2 pl-2">
                          {temel === null && <p className="text-xs t-muted text-center py-2">Yükleniyor...</p>}
                          {temel?.length === 0 && <p className="text-xs t-muted text-center py-2">Alt konu bulunamadı.</p>}
                          {temel?.map((les) => (
                            <div key={les.lessonId} className="space-y-3">
                              <p className="text-xs font-bold t-muted uppercase tracking-wide text-center">{les.title}</p>
                              <div className="grid grid-cols-2 gap-4 justify-items-center">
                                {les.subtopics.map((st, i) => (
                                  <Link
                                    key={i}
                                    href="/modules/1"
                                    onClick={() => { setShowLevels(false); setShowTemel(false); }}
                                    className="w-full flex justify-center"
                                  >
                                    <div
                                      className="rounded-full flex flex-col items-center justify-center text-center p-3 transition-transform active:scale-95 hover:-translate-y-0.5"
                                      style={{
                                        width: '100%',
                                        maxWidth: 140,
                                        aspectRatio: '1 / 1',
                                        background: 'radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--t-accent) 22%, var(--t-surface)), var(--t-surface))',
                                        border: '1px solid color-mix(in srgb, var(--t-accent) 55%, transparent)',
                                        boxShadow: '0 0 26px -6px var(--t-glow), inset 0 0 18px -10px var(--t-accent)',
                                      }}
                                    >
                                      <span className="text-2xl leading-none mb-1">{SUBTOPIC_EMOJIS[i % SUBTOPIC_EMOJIS.length]}</span>
                                      <span className="text-[0.72rem] font-bold leading-tight" style={{ color: 'var(--t-text-1)' }}>{st}</span>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <Link
                    key={lv.id}
                    href={lv.href}
                    onClick={() => setShowLevels(false)}
                    className="t-card-i flex flex-col items-center justify-center gap-1 px-4 py-4 rounded-xl text-center"
                  >
                    <span className="text-3xl leading-none">{lv.emoji}</span>
                    <span className="font-semibold text-sm">{lv.id}. {L.levels[String(lv.id)] ?? ''}</span>
                  </Link>
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
                  onClick={() => setShowEglence(false)}
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

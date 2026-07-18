'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAthleteName } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';

interface LastLesson { moduleId: number; lessonId: number; title: string; orderIndex: number; }

const LEVEL_META = [
  { id: 1, emoji: '🌱', href: '/modules/1' },
  { id: 2, emoji: '😊', href: '/modules/2' },
  { id: 3, emoji: '😎', href: '/modules/3' },
  { id: 4, emoji: '🔥', href: '/modules/4' },
];

export default function ChildHomePage() {
  const { settings } = useSettings();
  const [showLevels, setShowLevels] = useState(false);
  const [lastLesson, setLastLesson] = useState<LastLesson | null>(null);
  const [athleteName, setAthleteName] = useState<string | null>(null);

  const L = settings.labels;
  const remainingFeatures = [
    { href: '/puzzle', emoji: '🧩', label: L.features.puzzle, show: settings.tabs.puzzle },
    { href: '/badges', emoji: '🏆', label: L.features.badges, show: settings.tabs.badges },
  ].filter((f) => f.show);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bea_last_lesson');
      if (raw) setLastLesson(JSON.parse(raw));
    } catch { /* ignore */ }
    setAthleteName(getAthleteName());
  }, []);

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

        {/* Grid — Oyna + Dersler in first row, rest below */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {settings.tabs.play && (
            <Link href="/play" className="t-feat">
              <span className="text-3xl leading-none">🎮</span>
              <span className="text-xs font-semibold leading-tight">{L.features.play}</span>
            </Link>
          )}

          {/* Dersler — toggle */}
          <button
            onClick={() => setShowLevels((v) => !v)}
            className={`t-feat transition-colors ${showLevels ? 'border-[var(--t-accent)] bg-[color-mix(in_srgb,var(--t-accent)_8%,transparent)]' : ''}`}
          >
            <span className="text-3xl leading-none">📚</span>
            <span className="text-xs font-semibold leading-tight">{L.features.lessons}</span>
          </button>
        </div>

        {/* Level picker */}
        {showLevels && (
          <div className="mb-3">
            {/* Restart last lesson shortcut */}
            {lastLesson && (
              <Link
                href={`/modules/${lastLesson.moduleId}?restart=${lastLesson.lessonId}`}
                onClick={() => setShowLevels(false)}
                className="flex items-center gap-4 px-4 py-4 rounded-xl mb-3"
                style={{
                  border: '1px solid var(--t-accent)',
                  background: 'color-mix(in srgb, var(--t-accent) 8%, transparent)',
                }}
              >
                <span className="text-3xl leading-none w-10 text-center flex-shrink-0">🔄</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--t-accent)' }}>
                    Son Dersi Tekrar Başlat
                  </p>
                  <p className="text-xs t-muted mt-0.5 truncate">{lastLesson.title}</p>
                </div>
                <svg className="flex-shrink-0 opacity-40" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            )}

            <p className="text-sm font-bold t-premium uppercase tracking-widest mb-3 px-1">
              {L.sections.lessonsPick}
            </p>
            <div className="space-y-2">
              {LEVEL_META.map((lv) => (
                <Link
                  key={lv.id}
                  href={lv.href}
                  onClick={() => setShowLevels(false)}
                  className="t-card-i flex items-center gap-4 px-4 py-4 rounded-xl"
                >
                  <span className="text-3xl leading-none w-10 text-center flex-shrink-0">{lv.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{lv.id}. {L.levels[String(lv.id)] ?? ''}</p>
                  </div>
                  <svg className="flex-shrink-0 opacity-40" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Remaining features */}
        {remainingFeatures.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {remainingFeatures.map((f) => (
              <Link key={f.href} href={f.href} className="t-feat">
                <span className="text-3xl leading-none">{f.emoji}</span>
                <span className="text-xs font-semibold leading-tight">{f.label}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

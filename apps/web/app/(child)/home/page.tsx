'use client';
import { useState } from 'react';
import Link from 'next/link';

const LEVELS = [
  { id: 1, label: 'Temel Düzey',      emoji: '⭐',    href: '/modules/1' },
  { id: 2, label: 'Başlangıç Düzeyi', emoji: '⭐⭐',   href: '/modules/2' },
  { id: 3, label: 'Orta Düzey',       emoji: '⭐⭐⭐',  href: '/modules/3' },
  { id: 4, label: 'İleri Düzey',      emoji: '⭐⭐⭐⭐', href: '/modules/4' },
];

const FEATURES = [
  { href: '/play',    emoji: '🎮', label: 'Oyna'     },
  { href: '/puzzle',  emoji: '🧩', label: 'Bulmaca'  },
  { href: '/badges',  emoji: '🏆', label: 'Rozetler' },
  { href: '/profile', emoji: '👤', label: 'Profil'   },
];

export default function ChildHomePage() {
  const [showLevels, setShowLevels] = useState(false);

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-8">
      <section aria-label="Hızlı Erişim">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-3">
          Hızlı Erişim
        </p>

        {/* Grid — Oyna + Dersler in first row, rest below */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Link href="/play" className="t-feat">
            <span className="text-3xl leading-none">🎮</span>
            <span className="text-xs font-semibold leading-tight">Oyna</span>
          </Link>

          {/* Dersler — toggle */}
          <button
            onClick={() => setShowLevels((v) => !v)}
            className={`t-feat transition-colors ${showLevels ? 'border-[var(--t-accent)] bg-[color-mix(in_srgb,var(--t-accent)_8%,transparent)]' : ''}`}
          >
            <span className="text-3xl leading-none">📚</span>
            <span className="text-xs font-semibold leading-tight">Dersler</span>
          </button>
        </div>

        {/* Level picker — slides in below */}
        {showLevels && (
          <div className="t-card rounded-xl p-3 mb-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-2">Düzey Seçin</p>
            {LEVELS.map((lv) => (
              <Link
                key={lv.id}
                href={lv.href}
                onClick={() => setShowLevels(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--t-surface-2)] transition-colors"
              >
                <span className="text-lg w-16 leading-none">{lv.emoji}</span>
                <span className="font-semibold text-sm">
                  {lv.id}. {lv.label}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Remaining features */}
        <div className="grid grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href} className="t-feat">
              <span className="text-3xl leading-none">{f.emoji}</span>
              <span className="text-xs font-semibold leading-tight">{f.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BotGame } from '@/components/BotGame';
import type { TimeControl } from '@/components/BotGame';
import { useTabGuard } from '@/lib/settings/useTabGuard';

const LEVELS = [
  { label: 'Çok Kolay', skill: 0,  depth: 1,  emoji: '🐣' },
  { label: 'Kolay',     skill: 3,  depth: 4,  emoji: '🙂' },
  { label: 'Orta',      skill: 8,  depth: 8,  emoji: '😎' },
  { label: 'Zor',       skill: 14, depth: 10, emoji: '🔥' },
  { label: 'Çok Zor',   skill: 20, depth: 12, emoji: '👑' },
];

// Time control groups (base in seconds, increment in seconds)
const TIME_GROUPS: { cat: string; emoji: string; items: TimeControl[] }[] = [
  { cat: 'Yıldırım', emoji: '⚡', items: [
    { label: '3+2', base: 180, increment: 2 },
    { label: '5+0', base: 300, increment: 0 },
    { label: '5+3', base: 300, increment: 3 },
  ]},
  { cat: 'Hızlı', emoji: '🚀', items: [
    { label: '10+0',  base: 600, increment: 0 },
    { label: '10+5',  base: 600, increment: 5 },
    { label: '15+10', base: 900, increment: 10 },
  ]},
  { cat: 'Klasik', emoji: '🐢', items: [
    { label: '30+0',  base: 1800, increment: 0 },
    { label: '30+10', base: 1800, increment: 10 },
    { label: '30+20', base: 1800, increment: 20 },
  ]},
];

const ChevronRight = () => (
  <svg className="flex-shrink-0 t-muted" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

type Level = typeof LEVELS[number];

const ALL_TIMES: TimeControl[] = TIME_GROUPS.flatMap((g) => g.items);

export default function PlayPage() {
  return (
    <Suspense fallback={<main id="main-content" className="px-4 pt-5 max-w-lg mx-auto"><p className="text-sm t-muted">Yükleniyor...</p></main>}>
      <PlayInner />
    </Suspense>
  );
}

function PlayInner() {
  useTabGuard('play');
  const searchParams = useSearchParams();

  // Hızlı Erişim patikasından gelinmişse (skill+depth+tc) oyunu doğrudan başlat.
  const skillParam = searchParams.get('skill');
  const tcParam = searchParams.get('tc');
  const initialLevel = skillParam !== null
    ? (LEVELS.find((l) => l.skill === Number(skillParam)) ?? null)
    : null;
  const initialTc = tcParam && tcParam !== 'suresiz'
    ? (ALL_TIMES.find((t) => t.label === tcParam) ?? null)
    : null;

  const [selected, setSelected] = useState<Level | null>(initialLevel);
  const [tc, setTc] = useState<TimeControl | null>(initialTc);
  const [started, setStarted] = useState<boolean>(Boolean(initialLevel && tcParam));
  const [gameKey, setGameKey] = useState(0);

  // ── Step 1: choose difficulty ──────────────────────────────────────────────
  if (!selected) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <Link href="/play/online" className="t-card-i flex items-center gap-4 px-4 py-4">
          <span className="text-2xl">🤝</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">Arkadaşla Oyna</p>
            <p className="text-xs t-muted mt-0.5">Çevrimiçi eşleşme</p>
          </div>
          <ChevronRight />
        </Link>

        <hr className="t-line" />

        <p className="text-xs font-semibold t-muted uppercase tracking-widest pt-1">
          Bota Karşı Oyna — Zorluk ve Zaman Temposu Seç
        </p>

        <div className="space-y-2">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.skill}
              onClick={() => { setSelected(lvl); setTc(null); setStarted(false); }}
              className="t-card-i w-full flex items-center gap-4 px-4 py-3 text-left"
            >
              <span className="text-xl w-7 text-center">{lvl.emoji}</span>
              <span className="font-medium text-sm flex-1">{lvl.label}</span>
              <ChevronRight />
            </button>
          ))}
        </div>
      </main>
    );
  }

  // ── Step 2: choose time control ─────────────────────────────────────────────
  if (!started) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">{selected.emoji} {selected.label} — Süre Seç</p>
          <button onClick={() => setSelected(null)} className="t-btn-ghost text-xs px-3 py-1.5">
            ← Zorluk
          </button>
        </div>

        {TIME_GROUPS.map((g) => (
          <div key={g.cat} className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wide flex items-center gap-1.5">
              <span>{g.emoji}</span> {g.cat}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((item) => {
                const active = tc?.label === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => setTc(item)}
                    className="py-3 rounded-xl text-sm font-bold transition-all"
                    style={{
                      border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
                      background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
                      color: active ? 'var(--t-accent)' : 'var(--t-text)',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Unlimited option */}
        <button
          onClick={() => setTc(null)}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            border: tc === null ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
            background: tc === null ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
            color: tc === null ? 'var(--t-accent)' : 'var(--t-text)',
          }}
        >
          ♾️ Süresiz (saat yok)
        </button>

        {/* Start game */}
        <button
          onClick={() => { setStarted(true); setGameKey((k) => k + 1); }}
          className="w-full py-3.5 rounded-xl text-base font-bold transition-all shadow-sm"
          style={{ background: 'var(--t-accent)', color: '#fff' }}
        >
          ▶️ Oyuna Başla {tc ? `(${tc.label})` : '(Süresiz)'}
        </button>
      </main>
    );
  }

  // ── Step 3: the game ─────────────────────────────────────────────────────────
  return (
    <main className="pb-12">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <p className="font-semibold text-sm">
          {selected.emoji} Bot — {selected.label}{tc ? ` · ${tc.label}` : ''}
        </p>
        <button onClick={() => setStarted(false)} className="t-btn-ghost text-xs px-3 py-1.5">
          Ayarları değiştir
        </button>
      </div>

      <BotGame
        key={gameKey}
        skillLevel={selected.skill}
        depth={selected.depth}
        timeControl={tc}
        onGameEnd={() => {}}
      />

      <div className="text-center mt-4">
        <button onClick={() => setGameKey((k) => k + 1)} className="t-btn-ghost px-5 py-2">
          Yeni Oyun
        </button>
      </div>
    </main>
  );
}

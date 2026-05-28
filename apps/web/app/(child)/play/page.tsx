'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BotGame } from '@/components/BotGame';

const LEVELS = [
  { label: 'Çok Kolay', skill: 0,  depth: 1,  emoji: '🐣' },
  { label: 'Kolay',     skill: 3,  depth: 4,  emoji: '🙂' },
  { label: 'Orta',      skill: 8,  depth: 8,  emoji: '😎' },
  { label: 'Zor',       skill: 14, depth: 10, emoji: '🔥' },
  { label: 'Çok Zor',   skill: 20, depth: 12, emoji: '👑' },
];

const ChevronRight = () => (
  <svg className="flex-shrink-0 t-muted" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

export default function PlayPage() {
  const [selected, setSelected] = useState<typeof LEVELS[number] | null>(null);
  const [gameKey, setGameKey] = useState(0);

  if (!selected) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">

        {/* Online */}
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
          Bota Karşı — Zorluk Seç
        </p>

        <div className="space-y-2">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.skill}
              onClick={() => setSelected(lvl)}
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

  return (
    <main className="pb-12">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <p className="font-semibold text-sm">
          {selected.emoji} Bot — {selected.label}
        </p>
        <button
          onClick={() => setSelected(null)}
          className="t-btn-ghost text-xs px-3 py-1.5"
        >
          Zorluk değiştir
        </button>
      </div>

      <BotGame
        key={gameKey}
        skillLevel={selected.skill}
        depth={selected.depth}
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

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BotGame } from '@/components/BotGame';

const LEVELS = [
  { label: 'Çok Kolay', skill: 0, depth: 1, emoji: '🐣' },
  { label: 'Kolay', skill: 3, depth: 4, emoji: '🙂' },
  { label: 'Orta', skill: 8, depth: 8, emoji: '😎' },
  { label: 'Zor', skill: 14, depth: 10, emoji: '🔥' },
  { label: 'Çok Zor', skill: 20, depth: 12, emoji: '👑' },
];

export default function PlayPage() {
  const [selected, setSelected] = useState<typeof LEVELS[number] | null>(null);
  const [gameKey, setGameKey] = useState(0);

  if (!selected) {
    return (
      <main id="main-content" className="p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Bota Karşı Oyna 🤖</h1>
        <Link
          href="/play/online"
          className="block w-full mb-6 p-4 bg-green-500 text-white rounded-xl shadow hover:bg-green-600 transition text-lg font-medium flex items-center gap-3"
        >
          <span className="text-2xl">🤝</span> Arkadaşla Oyna (Online)
        </Link>
        <p className="text-center opacity-75 mb-6">Zorluk seç:</p>
        <div className="grid grid-cols-1 gap-3">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.skill}
              onClick={() => setSelected(lvl)}
              className="p-4 bg-white rounded-xl shadow hover:shadow-lg transition text-lg font-medium flex items-center gap-3"
            >
              <span className="text-2xl">{lvl.emoji}</span> {lvl.label}
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold">{selected.emoji} {selected.label} bot</h1>
        <button onClick={() => setSelected(null)} className="text-blue-600 underline text-sm">Zorluk değiştir</button>
      </div>
      <BotGame
        key={gameKey}
        skillLevel={selected.skill}
        depth={selected.depth}
        onGameEnd={() => { /* result shown in BotGame; could offer rematch */ }}
      />
      <div className="text-center mt-4">
        <button onClick={() => setGameKey((k) => k + 1)} className="px-4 py-2 border rounded-lg">
          Yeni Oyun
        </button>
      </div>
    </main>
  );
}

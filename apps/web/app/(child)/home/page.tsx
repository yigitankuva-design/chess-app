'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Module {
  id: number;
  order_index: number;
  name: string;
  description: string;
  icon: string;
  lessons_count: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const FEATURES = [
  { href: '/play', emoji: '🎮', label: 'Bota Karşı Oyna', color: 'bg-red-100' },
  { href: '/puzzle', emoji: '🧩', label: 'Bulmaca', color: 'bg-purple-100' },
  { href: '/daily', emoji: '📅', label: 'Günün Bulmacası', color: 'bg-orange-100' },
  { href: '/srs', emoji: '🔁', label: 'Tekrar', color: 'bg-teal-100' },
  { href: '/badges', emoji: '🏆', label: 'Rozetler', color: 'bg-yellow-100' },
  { href: '/profile', emoji: '👤', label: 'Profilim', color: 'bg-blue-100' },
];

export default function ChildHomePage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/modules`)
      .then((r) => r.json())
      .then((data) => {
        setModules(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-6">Yükleniyor...</main>;

  return (
    <main id="main-content" className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Hadi Öğrenelim! 🎯</h1>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {FEATURES.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className={`block p-4 rounded-xl text-center font-semibold hover:shadow-lg transition ${feature.color}`}
          >
            <div className="text-4xl mb-2">{feature.emoji}</div>
            <div className="text-sm">{feature.label}</div>
          </Link>
        ))}
      </div>

      {/* Lessons Section */}
      <h2 className="text-2xl font-bold mb-6">📚 Dersler</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={`/modules/${m.id}`}
            className="block p-6 bg-white rounded-2xl shadow hover:shadow-lg transition"
          >
            <h3 className="text-xl font-bold">
              {m.order_index}. {m.name}
            </h3>
            <p className="opacity-75 mt-2">{m.description}</p>
            <p className="text-sm opacity-50 mt-3">{m.lessons_count} ders</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

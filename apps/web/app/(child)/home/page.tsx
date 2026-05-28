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
  { href: '/play',    emoji: '🎮', label: 'Oyna'             },
  { href: '/puzzle',  emoji: '🧩', label: 'Bulmaca'          },
  { href: '/daily',   emoji: '📅', label: 'Günlük'           },
  { href: '/srs',     emoji: '🔁', label: 'Tekrar'           },
  { href: '/badges',  emoji: '🏆', label: 'Rozetler'         },
  { href: '/profile', emoji: '👤', label: 'Profil'           },
];

const ChevronRight = () => (
  <svg className="flex-shrink-0 opacity-40" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function ChildHomePage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/modules`)
      .then((r) => r.json())
      .then((data) => { setModules(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-8">

      {/* ── Quick actions ── */}
      <section aria-label="Hızlı Erişim">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-3">
          Hızlı Erişim
        </p>
        <div className="grid grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href} className="t-feat">
              <span className="text-3xl leading-none">{f.emoji}</span>
              <span className="text-xs font-semibold leading-tight">{f.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Module list ── */}
      <section aria-label="Dersler">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-3">
          Dersler
        </p>
        <div className="space-y-2">
          {loading
            ? [1, 2, 3, 4].map((i) => <div key={i} className="t-skel h-16" />)
            : modules.map((m) => (
                <Link key={m.id} href={`/modules/${m.id}`}
                  className="t-card-i flex items-center gap-3 px-4 py-3"
                >
                  {/* Icon badge */}
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ background: 'var(--t-surface-2)' }}
                  >
                    {m.icon || '📖'}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {m.order_index}. {m.name}
                    </p>
                    <p className="text-xs t-muted mt-0.5 truncate">{m.description}</p>
                    <p className="text-xs t-muted mt-0.5">{m.lessons_count} ders</p>
                  </div>

                  <ChevronRight />
                </Link>
              ))}
        </div>
      </section>

    </main>
  );
}

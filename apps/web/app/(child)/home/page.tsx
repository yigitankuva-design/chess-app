'use client';
import Link from 'next/link';

const FEATURES = [
  { href: '/play',    emoji: '🎮', label: 'Oyna'     },
  { href: '/puzzle',  emoji: '🧩', label: 'Bulmaca'  },
  { href: '/daily',   emoji: '📅', label: 'Günlük'   },
  { href: '/srs',     emoji: '🔁', label: 'Tekrar'   },
  { href: '/badges',  emoji: '🏆', label: 'Rozetler' },
  { href: '/profile', emoji: '👤', label: 'Profil'   },
];

export default function ChildHomePage() {
  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-8">
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
    </main>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { href: '/admin/parents', label: 'Kullanıcılar' },
  { href: '/admin/content', label: 'İçerik' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/'); return; }
    setReady(true);
  }, [router]);

  if (!ready) return <p className="p-6 neon-shell n-muted">Yükleniyor...</p>;

  return (
    <div className="neon-shell flex min-h-screen">
      <aside className="w-56 shrink-0 flex flex-col border-r border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="p-4 border-b border-white/10">
          <p className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-400">Admin Paneli</p>
          <p className="text-xs n-muted">Bozüyük Satranç Akademisi</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <Link
            href="/admin/parents"
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-cyan-100 bg-cyan-400/15 border border-cyan-400/40 hover:bg-cyan-400/25 transition-all mb-1"
          >
            🏠 Ana Sayfaya Dön
          </Link>
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/');
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block px-3 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? 'text-cyan-200 bg-cyan-400/10 border border-cyan-400/40 shadow-[0_0_18px_-6px_rgba(34,211,238,0.7)]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/90 border border-transparent'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => { auth.logout(); router.replace('/'); }}
          className="m-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white/90 text-left transition-colors"
        >
          Çıkış
        </button>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

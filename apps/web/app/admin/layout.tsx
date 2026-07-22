'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { PowerButton } from '@/components/PowerButton';

const NAV_GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: 'Admin',
    items: [
      { href: '/admin/parents', label: 'Kullanıcılar' },
    ],
  },
  {
    title: 'Sporcu Paneli',
    items: [
      // 'Ders' artık Sekmeler > Dersler kartının içinde yönetiliyor
      { href: '/admin/settings/tabs', label: 'Sekmeler' },
      { href: '/admin/settings/labels', label: 'Yazılar & Etiketler' },
      { href: '/admin/settings/board', label: 'Görünüm — Tahta & Taş' },
    ],
  },
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
        <div className="p-4 border-b border-white/10 text-center">
          <p className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-400 drop-shadow-[0_0_14px_rgba(34,211,238,0.45)]">
            Admin Paneli
          </p>
          <p className="text-[0.7rem] n-muted mt-1.5 tracking-wide uppercase">Bozüyük Satranç Akademisi</p>
          <p className="mt-2 text-3xl font-black tracking-[0.35em] pl-[0.35em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-400 drop-shadow-[0_0_18px_rgba(34,211,238,0.55)]">
            AGEP
          </p>
        </div>
        <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 pt-1 pb-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-cyan-300/50">
                {group.title}
              </p>
              {group.items.map((n) => {
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
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-3">
          <a
            href="/home"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-100 bg-emerald-400/15 border border-emerald-400/40 hover:bg-emerald-400/25 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Kullanıcı Ekranı
          </a>
          <Link
            href="/admin/parents"
            className="block text-center px-3 py-2 rounded-lg text-sm font-semibold text-cyan-100 bg-cyan-400/15 border border-cyan-400/40 hover:bg-cyan-400/25 transition-all"
          >
            Ana Sayfaya Dön
          </Link>
          <div className="flex justify-center">
            <PowerButton onClick={() => { auth.logout(); router.replace('/'); }} />
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

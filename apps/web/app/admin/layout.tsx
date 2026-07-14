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

  if (!ready) return <p className="p-6">Yükleniyor...</p>;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-white/10">
          <p className="font-bold">Admin Paneli</p>
          <p className="text-xs opacity-60">Bozüyük Satranç Akademisi</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => { auth.logout(); router.replace('/'); }}
          className="m-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 text-left"
        >
          Çıkış
        </button>
      </aside>
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  );
}

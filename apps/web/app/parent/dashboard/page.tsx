'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { avatarEmoji } from '@/lib/avatars';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Child { id: number; display_name: string; age: number; avatar: string; }

export default function ParentDashboardPage() {
  const router = useRouter();
  const auth = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/parent-login'); return; }
    fetch(`${API_BASE}/children`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setChildren(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  return (
    <main id="main-content" className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Çocuklarım</h1>
        <button onClick={() => { auth.logout(); router.push('/parent-login'); }} className="text-sm underline opacity-70">
          Çıkış
        </button>
      </div>

      {loading ? (
        <p>Yükleniyor...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {children.map((c) => (
              <Link key={c.id} href={`/parent/child/${c.id}`}>
                <div className="p-4 bg-white rounded-2xl shadow flex items-center gap-3 cursor-pointer hover:shadow-lg transition-shadow">
                  <span className="text-4xl">{avatarEmoji(c.avatar)}</span>
                  <div>
                    <p className="font-bold">{c.display_name}</p>
                    <p className="text-sm opacity-60">{c.age} yaşında</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/parent/add-child" className="block text-center bg-blue-600 text-white py-3 rounded-lg">
              + Çocuk Ekle
            </Link>
            {children.length > 0 && (
              <Link href="/child-login" className="block text-center bg-green-600 text-white py-3 rounded-lg">
                🎮 Çocuk Moduna Geç
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}

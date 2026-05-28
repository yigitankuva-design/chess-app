'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';

interface Klass { id: number; name: string; join_code: string; }

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Klass[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const token = getToken();
    if (!token) { router.push('/parent-login'); return; }
    try {
      const res = await fetch(`${API_BASE}/teacher/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setClasses(await res.json());
      else setError('Sınıflar yüklenemedi');
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createClass() {
    if (!newName.trim()) return;
    const token = getToken();
    if (!token) { router.push('/parent-login'); return; }
    const res = await fetch(`${API_BASE}/teacher/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName(''); setCreating(false); load();
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🏫 Sınıflarım</h1>
      <button
        onClick={() => setCreating(!creating)}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        + Yeni Sınıf Oluştur
      </button>
      {creating && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg space-y-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Sınıf adı (örn: 4-A Satranç)"
            className="w-full p-2 border rounded"
            onKeyDown={e => e.key === 'Enter' && createClass()}
          />
          <div className="flex gap-2">
            <button onClick={createClass} className="px-3 py-1 bg-green-600 text-white rounded">
              Oluştur
            </button>
            <button onClick={() => setCreating(false)} className="px-3 py-1 bg-gray-400 text-white rounded">
              İptal
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-red-600">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Yükleniyor...</p>
      ) : classes.length === 0 ? (
        <p className="text-gray-500">Henüz sınıf oluşturmadınız. Yukarıdan başlayın!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classes.map(c => (
            <Link key={c.id} href={`/classes/${c.id}`} className="block p-4 bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <h2 className="text-xl font-bold">{c.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Katılım kodu: <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-blue-600">{c.join_code}</code>
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

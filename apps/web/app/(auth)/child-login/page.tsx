'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceFingerprint } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { avatarEmoji } from '@/lib/avatars';
import { apiClient, ApiError } from '@/lib/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Child {
  id: number;
  display_name: string;
  avatar: string;
  age: number;
}

export default function ChildLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<number | null>(null);

  useEffect(() => {
    const fp = getDeviceFingerprint();
    fetch(`${API_BASE}/auth/device/children?device_fingerprint=${encodeURIComponent(fp)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setChildren(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function enterChild(c: Child) {
    setError(null);
    setEnteringId(c.id);
    try {
      const data = await apiClient.childEnter({
        child_profile_id: c.id,
        device_fingerprint: getDeviceFingerprint(),
      });
      auth.login(data.access_token, 'child', data.child_profile_id);
      router.push('/home');
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError('Bu cihaz tanımlı değil. Veli girişinden ekleyin.');
      } else {
        setError('Giriş başarısız, tekrar dene');
      }
      setEnteringId(null);
    }
  }

  if (loading) return <p className="text-center">Yükleniyor...</p>;

  if (children.length === 0) {
    return (
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Çocuk profili yok</h1>
        <p className="opacity-75">Bu cihazda kayıtlı çocuk yok. Veli önce çocuk eklemeli.</p>
        <a
          href="/parent-login"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Veli Girişi
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Kim oynuyor?</h1>
      {error && <p className="text-red-600 font-medium text-center">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => enterChild(c)}
            disabled={enteringId !== null}
            className="flex flex-col items-center gap-2 p-6 bg-white rounded-2xl shadow hover:shadow-lg transition disabled:opacity-50"
          >
            <span className="text-5xl">{avatarEmoji(c.avatar)}</span>
            <span className="font-bold">{c.display_name}</span>
            {enteringId === c.id && <span className="text-xs opacity-60">Giriliyor...</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

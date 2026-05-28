'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceFingerprint } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { avatarEmoji } from '@/lib/avatars';

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
  const [selected, setSelected] = useState<Child | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  async function submitPin(fullPin: string) {
    if (!selected) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/child/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_profile_id: selected.id,
          pin: fullPin,
          device_fingerprint: getDeviceFingerprint(),
        }),
      });
      if (res.status === 401) {
        setError('Yanlış PIN, tekrar dene');
        setPin('');
        return;
      }
      if (res.status === 403) {
        setError('Bu cihaz tanımlı değil. Veli girişinden ekleyin.');
        setPin('');
        return;
      }
      if (!res.ok) {
        setError('Giriş başarısız');
        setPin('');
        return;
      }
      const data = await res.json();
      auth.login(data.access_token, 'child', data.child_profile_id);
      router.push('/home');
    } catch {
      setError('Bir hata oluştu');
      setPin('');
    }
  }

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) submitPin(next);
  }

  if (loading) return <p className="text-center">Yükleniyor...</p>;

  // No children on this device
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

  // Profile picker
  if (!selected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-center">Kim oynuyor?</h1>
        <div className="grid grid-cols-2 gap-4">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelected(c);
                setPin('');
                setError(null);
              }}
              className="flex flex-col items-center gap-2 p-6 bg-white rounded-2xl shadow hover:shadow-lg transition"
            >
              <span className="text-5xl">{avatarEmoji(c.avatar)}</span>
              <span className="font-bold">{c.display_name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // PIN pad
  return (
    <div className="space-y-6 text-center">
      <button
        onClick={() => {
          setSelected(null);
          setPin('');
          setError(null);
        }}
        className="text-sm underline opacity-70 hover:opacity-100 transition"
      >
        ← Geri
      </button>
      <div>
        <div className="text-5xl mb-2">{avatarEmoji(selected.avatar)}</div>
        <h1 className="text-xl font-bold">{selected.display_name}, PIN&apos;ini gir</h1>
      </div>
      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full ${i < pin.length ? 'bg-blue-600' : 'bg-gray-300'}`}
          />
        ))}
      </div>
      {error && <p className="text-red-600 font-medium">{error}</p>}
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => pressDigit(d)}
            className="p-4 text-2xl font-bold bg-white rounded-xl shadow hover:bg-gray-50 transition"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => pressDigit('0')}
          className="p-4 text-2xl font-bold bg-white rounded-xl shadow hover:bg-gray-50 transition"
        >
          0
        </button>
        <button
          onClick={() => setPin(pin.slice(0, -1))}
          className="p-4 text-xl bg-white rounded-xl shadow hover:bg-gray-50 transition"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { saveAthleteName } from '@/lib/auth-storage';

export default function AthleteSetupPage() {
  const router = useRouter();
  const auth = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError('Sporcu adı soyadı gerekli'); return; }
    setSaving(true);
    try {
      const ath = await apiClient.athleteCreate({ full_name: name.trim() });
      auth.login(ath.access_token, 'child', ath.child_profile_id);
      saveAthleteName(ath.display_name);
      router.push('/home');
    } catch {
      setError('Kaydedilemedi, tekrar dene');
      setSaving(false);
    }
  }

  return (
    <main className="neon-shell flex flex-col items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-xs neon-card neon-cyan p-7 space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold n-text">Sporcu Bilgisi</h1>
          <p className="text-sm n-muted mt-1">Uygulamayı kullanacak sporcunun adını girin</p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sporcu Adı Soyadı"
          className="neon-input"
        />
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <button type="submit" disabled={saving} className="neon-btn">
          {saving ? 'Kaydediliyor...' : 'Devam'}
        </button>
      </form>
    </main>
  );
}

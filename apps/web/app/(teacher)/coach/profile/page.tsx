'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTeacherName, getToken } from '@/lib/auth-storage';
import { PowerButton } from '@/components/PowerButton';
import { pressed } from '@/components/ui/neumorphic';

/**
 * Madde 2026-09-07 (Antrenör Paneli, 3): antrenörün "Profil" bölümü —
 * Zafer'in belirttiği gibi içeriği sporcunun Profil sayfasından (bkz.
 * components/profile/ProfileView.tsx) BİLEREK FARKLI. Şimdilik SADECE
 * kimlik + çıkış — asıl içerik (hangi kartlar/bilgiler olacağı) Zafer'in
 * vereceği SONRAKİ, ayrı görevlerle doldurulacak.
 */
export default function CoachProfilePage() {
  const router = useRouter();
  const auth = useAuth();
  const { role, hydrated } = auth;
  const [authReady, setAuthReady] = useState(false);
  const [teacherName, setTeacherName] = useState<string | null>(null);

  // bkz. lib/auth-context.tsx `hydrated` doc-comment'i — role henüz
  // çözülmeden karar verirsek F5'te geçerli antrenör bile dışarı atılır.
  useEffect(() => {
    if (!hydrated) return;
    if (!getToken() || role !== 'teacher') { router.replace('/'); return; }
    setAuthReady(true);
  }, [role, hydrated, router]);

  useEffect(() => { setTeacherName(getTeacherName()); }, []);

  function handleLogout() {
    auth.logout();
    router.replace('/');
  }

  if (!authReady) return <p className="t-muted p-4">Yükleniyor...</p>;

  return (
    <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-6">
      <div style={{ ...pressed(18), padding: '1.25rem 1.1rem' }} className="flex items-center gap-3">
        <span className="text-3xl">🎓</span>
        <div>
          <p className="text-xs t-muted uppercase tracking-widest">Antrenör</p>
          <p className="text-xl font-extrabold t-premium">{teacherName ?? '—'}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <PowerButton onClick={handleLogout} />
      </div>
    </main>
  );
}

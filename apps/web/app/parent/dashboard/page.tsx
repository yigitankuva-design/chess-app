'use client';
import { useAuth } from '@/lib/auth-context';

export default function ParentDashboardPlaceholder() {
  const auth = useAuth();
  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Hoş geldin{auth.userId ? `, kullanıcı #${auth.userId}` : ''}</h1>
      <p className="opacity-75">Veli panel sürümleri Plan 7&apos;de gelir. Şu an sadece auth çalıştığı görünüyor.</p>
      <button
        onClick={auth.logout}
        className="mt-6 px-4 py-2 border rounded"
      >Çıkış yap</button>
    </main>
  );
}

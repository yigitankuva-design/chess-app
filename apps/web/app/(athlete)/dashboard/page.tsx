'use client';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function AthleteDashboard() {
  const { logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="text-center py-6">
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="text-2xl font-bold">Sporcu Paneli</h1>
        <p className="t-muted text-sm mt-1">14+ Sporcu Hesabı</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a href="/child/play" className="t-feat">
          <span className="text-3xl">♟️</span>
          <span className="text-sm font-semibold">Bot ile Oyna</span>
        </a>
        <a href="/child/puzzle" className="t-feat">
          <span className="text-3xl">🧩</span>
          <span className="text-sm font-semibold">Taktik Puzzle</span>
        </a>
        <a href="/child/modules" className="t-feat">
          <span className="text-3xl">📚</span>
          <span className="text-sm font-semibold">Dersler</span>
        </a>
        <a href="/child/srs" className="t-feat">
          <span className="text-3xl">🔁</span>
          <span className="text-sm font-semibold">Tekrar</span>
        </a>
      </div>

      <div className="pt-4 border-t t-line">
        <button
          onClick={handleLogout}
          className="w-full t-btn-ghost py-3 text-sm"
        >
          Çıkış Yap
        </button>
      </div>
    </main>
  );
}

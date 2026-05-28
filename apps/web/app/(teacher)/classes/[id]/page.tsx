'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { Leaderboard } from '@/components/Leaderboard';
import { AssignmentForm } from '@/components/AssignmentForm';
import { ClassroomGrid } from '@/components/ClassroomGrid';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Tab = 'students' | 'assignment' | 'leaderboard';

interface Student { id: number; display_name: string; avatar: string; age: number; }
interface LeaderboardEntry { child_id: number; display_name: string; avatar: string; xp_total: number; rank_name: string; }

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const classId = parseInt(id);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/parent-login'); return; }

    async function loadAll() {
      const token = getToken()!;
      try {
        const [studRes, lbRes] = await Promise.all([
          fetch(`${API_BASE}/teacher/classes/${classId}/students`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/teacher/classes/${classId}/leaderboard`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (studRes.ok) setStudents(await studRes.json());
        if (lbRes.ok) setLeaderboard(await lbRes.json());
        setLoading(false);
      } catch {
        setError('Veriler yüklenemedi');
        setLoading(false);
      }
    }
    loadAll();
  }, [classId, router]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'students', label: '👥 Öğrenciler' },
    { key: 'assignment', label: '📝 Ödev Ver' },
    { key: 'leaderboard', label: '🏆 Lider Tablosu' },
  ];

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push('/classes')} className="text-blue-600 underline mb-4 block">
        ← Sınıflarıma Dön
      </button>
      <h1 className="text-3xl font-bold mb-6">Sınıf Detayı</h1>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 -mb-px font-medium ${tab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Yükleniyor...</p>
      ) : (
        <>
          {tab === 'students' && <ClassroomGrid students={students} />}
          {tab === 'assignment' && <AssignmentForm classId={classId} />}
          {tab === 'leaderboard' && <Leaderboard entries={leaderboard} />}
        </>
      )}
    </main>
  );
}

'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { Leaderboard } from '@/components/Leaderboard';
import { AssignmentForm } from '@/components/AssignmentForm';
import { ClassroomGrid } from '@/components/ClassroomGrid';
import { avatarEmoji } from '@/lib/avatars';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Tab = 'students' | 'assignment' | 'leaderboard';

interface Student { id: number; display_name: string; avatar: string; age: number; }
interface SearchResult { id: number; display_name: string; avatar: string; class_id: number | null; }
interface LeaderboardEntry { child_id: number; display_name: string; avatar: string; xp_total: number; rank_name: string; }

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Student search / add state
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const classId = parseInt(id);

  const loadStudents = useCallback(async () => {
    const token = getToken()!;
    const res = await fetch(`${API_BASE}/teacher/classes/${classId}/students`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setStudents(await res.json());
  }, [classId]);

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

  async function handleSearch() {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const token = getToken()!;
      const res = await fetch(`${API_BASE}/teacher/students/search?q=${encodeURIComponent(searchQ)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSearchResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(childId: number) {
    setAddingId(childId);
    try {
      const token = getToken()!;
      await fetch(`${API_BASE}/teacher/classes/${classId}/students/${childId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadStudents();
      setSearchResults((prev) => prev.filter((s) => s.id !== childId));
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemove(childId: number) {
    setRemovingId(childId);
    try {
      const token = getToken()!;
      await fetch(`${API_BASE}/teacher/classes/${classId}/students/${childId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents((prev) => prev.filter((s) => s.id !== childId));
    } finally {
      setRemovingId(null);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'students',    label: '👥 Öğrenciler' },
    { key: 'assignment',  label: '📝 Ödev Ver' },
    { key: 'leaderboard', label: '🏆 Liderlik' },
  ];

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push('/classes')} className="text-blue-600 underline mb-4 block text-sm">
        ← Sınıflarıma Dön
      </button>
      <h1 className="text-2xl font-bold mb-5">Sınıf Detayı</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 -mb-px font-medium text-sm transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ── STUDENTS TAB ── */}
          {tab === 'students' && (
            <div className="space-y-6">

              {/* Current students list */}
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Sınıftaki Öğrenciler ({students.length})
                </h2>
                {students.length === 0 ? (
                  <p className="text-gray-400 text-sm">Henüz öğrenci yok. Aşağıdan ekleyin.</p>
                ) : (
                  <div className="space-y-2">
                    {students.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                        <span className="text-2xl w-8 text-center">{avatarEmoji(s.avatar)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{s.display_name}</p>
                          <p className="text-xs text-gray-400">{s.age} yaş</p>
                        </div>
                        <button
                          onClick={() => handleRemove(s.id)}
                          disabled={removingId === s.id}
                          className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition disabled:opacity-50"
                        >
                          {removingId === s.id ? '...' : 'Çıkar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add student section */}
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Öğrenci Ekle
                </h2>
                <div className="flex gap-2 mb-3">
                  <input
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Öğrenci adı ara..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchQ.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50 hover:bg-blue-700 transition"
                  >
                    {searching ? '...' : 'Ara'}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="text-2xl w-8 text-center">{avatarEmoji(s.avatar)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{s.display_name}</p>
                          {s.class_id && s.class_id !== classId && (
                            <p className="text-xs text-amber-600">Başka sınıfta kayıtlı — önce o sınıftan çıkarılmalı</p>
                          )}
                          {s.class_id === classId && (
                            <p className="text-xs text-green-600">Zaten bu sınıfta</p>
                          )}
                        </div>
                        {!s.class_id && (
                          <button
                            onClick={() => handleAdd(s.id)}
                            disabled={addingId === s.id}
                            className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition disabled:opacity-50"
                          >
                            {addingId === s.id ? '...' : 'Ekle'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {tab === 'assignment' && <AssignmentForm classId={classId} />}
          {tab === 'leaderboard' && <Leaderboard entries={leaderboard} />}
        </>
      )}
    </main>
  );
}

'use client';
import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';
import { avatarEmoji } from '@/lib/avatars';
import { WeeklyActivityChart } from '@/components/WeeklyActivityChart';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Summary {
  child_id: number;
  display_name: string;
  avatar: string;
  age: number;
  lessons_completed: number;
  badges_earned: number;
  rank_name: string;
  xp_total: number;
  daily_minutes_limit: number | null;
  activity_7days: { date: string; minutes: number; lessons: number; puzzles: number; games: number }[];
}

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [limitInput, setLimitInput] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/parent/children/${id}/summary`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data: Summary = await res.json();
      setSummary(data);
      setLimitInput(data.daily_minutes_limit ? String(data.daily_minutes_limit) : '');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveLimit() {
    const token = getToken();
    const minutes = parseInt(limitInput, 10);
    if (isNaN(minutes) || minutes < 1) return;
    await fetch(`${API_BASE}/parent/children/${id}/time-limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ daily_minutes: minutes }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <main className="p-6">Yükleniyor...</main>;
  if (!summary) return <main className="p-6">Bulunamadı.</main>;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <Link href="/parent/dashboard" className="text-blue-600 underline text-sm">
        ← Panele dön
      </Link>

      <div className="flex items-center gap-4">
        <span className="text-5xl">{avatarEmoji(summary.avatar)}</span>
        <div>
          <h1 className="text-2xl font-bold">{summary.display_name}</h1>
          <p className="opacity-60">
            {summary.age} yaşında · {summary.rank_name} · {summary.xp_total} XP
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-2xl shadow text-center">
          <p className="text-3xl font-bold">{summary.lessons_completed}</p>
          <p className="text-sm opacity-60">Tamamlanan ders</p>
        </div>
        <div className="p-4 bg-white rounded-2xl shadow text-center">
          <p className="text-3xl font-bold">{summary.badges_earned}</p>
          <p className="text-sm opacity-60">Rozet</p>
        </div>
      </div>

      <div className="p-4 bg-white rounded-2xl shadow">
        <h2 className="font-bold mb-3">Son 7 gün</h2>
        <WeeklyActivityChart data={summary.activity_7days} />
      </div>

      <div className="p-4 bg-white rounded-2xl shadow">
        <h2 className="font-bold mb-3">Günlük süre sınırı</h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            placeholder="Dakika"
            className="w-32 p-3 border rounded"
          />
          <span className="opacity-60">dakika/gün</span>
          <button
            onClick={saveLimit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Kaydet
          </button>
          {saved && <span className="text-green-600">✓ Kaydedildi</span>}
        </div>
        <p className="text-xs opacity-50 mt-2">
          Boş bırakıp kaydetme = sınır yok. Çocuk bu süreyi aşınca yeni aktivite başlatamaz.
        </p>
      </div>
    </main>
  );
}

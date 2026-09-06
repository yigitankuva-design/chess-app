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
  // Madde 2026-09-07 (GRUP C): Sporcu Profili "İletişim Bilgileri" kartının
  // ön-doldurma verisi — hiçbiri girilmediyse null.
  province: string | null;
  athlete_phone: string | null;
  athlete_email: string | null;
  father_name: string | null;
  father_phone: string | null;
  father_email: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  mother_email: string | null;
}

/** Madde 2026-09-07 (GRUP C): Sporcu Profili "İletişim Bilgileri" kartının
 *  verisini veli burada girer/günceller (bkz. PATCH /parent/children/{id}/
 *  contact-info) — sunucu bu alanları /gamification/me üzerinden sporcunun
 *  kendi profiline de döner. */
interface ContactInfo {
  province: string;
  athlete_phone: string;
  athlete_email: string;
  father_name: string;
  father_phone: string;
  father_email: string;
  mother_name: string;
  mother_phone: string;
  mother_email: string;
}
const EMPTY_CONTACT: ContactInfo = {
  province: '', athlete_phone: '', athlete_email: '',
  father_name: '', father_phone: '', father_email: '',
  mother_name: '', mother_phone: '', mother_email: '',
};

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [limitInput, setLimitInput] = useState('');
  const [saved, setSaved] = useState(false);
  /** Madde 2026-09-07 (GRUP C): "İletişim Bilgileri" formu. */
  const [contact, setContact] = useState<ContactInfo>(EMPTY_CONTACT);
  const [contactSaved, setContactSaved] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/parent/children/${id}/summary`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data: Summary = await res.json();
      setSummary(data);
      setLimitInput(data.daily_minutes_limit ? String(data.daily_minutes_limit) : '');
      setContact({
        province: data.province ?? '',
        athlete_phone: data.athlete_phone ?? '', athlete_email: data.athlete_email ?? '',
        father_name: data.father_name ?? '', father_phone: data.father_phone ?? '', father_email: data.father_email ?? '',
        mother_name: data.mother_name ?? '', mother_phone: data.mother_phone ?? '', mother_email: data.mother_email ?? '',
      });
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

  /** Madde 2026-09-07 (GRUP C): boş bırakılan alan sunucuya GÖNDERİLMEZ
   *  (backend'in kısmi güncelleme/PATCH semantiği ile uyumlu) — böylece
   *  bu formda boş bırakmak, önceden girilmiş bir değeri SİLMEZ. Silmek
   *  isteyen veli alanı gerçekten temizleyip kaydetmeli — bu davranış
   *  basitlik için kabul edilen bir sınır (boş string de gönderilebilir
   *  hâle getirmek isterse Zafer belirtsin). */
  async function saveContactInfo() {
    setContactSaving(true);
    const token = getToken();
    const payload: Partial<ContactInfo> = {};
    (Object.keys(contact) as (keyof ContactInfo)[]).forEach((key) => {
      if (contact[key].trim() !== '') payload[key] = contact[key].trim();
    });
    try {
      await fetch(`${API_BASE}/parent/children/${id}/contact-info`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2000);
    } finally {
      setContactSaving(false);
    }
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

      {/* Madde 2026-09-07 (GRUP C): Sporcu Profili "İletişim Bilgileri"
          kartının verisi burada girilir — il + sporcu/baba/anne telefon-e-posta. */}
      <div className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-bold">İletişim Bilgileri</h2>
        <p className="text-xs opacity-50">
          Burada girdiğin bilgiler {summary.display_name}&apos;in Sporcu Profili sayfasında görünür.
        </p>

        <div>
          <label htmlFor="contact-province" className="block text-sm font-medium mb-1">İl</label>
          <input
            id="contact-province" value={contact.province}
            onChange={(e) => setContact((c) => ({ ...c, province: e.target.value }))}
            placeholder="Örn. Bilecik" className="w-full p-2 border rounded"
          />
        </div>

        {([
          ['Sporcu', 'athlete_phone', 'athlete_email'],
          ['Baba', 'father_phone', 'father_email'],
          ['Anne', 'mother_phone', 'mother_email'],
        ] as const).map(([label, phoneKey, emailKey]) => (
          <div key={label} className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`contact-${phoneKey}`} className="block text-sm font-medium mb-1">{label} Telefon</label>
              <input
                id={`contact-${phoneKey}`} value={contact[phoneKey]}
                onChange={(e) => setContact((c) => ({ ...c, [phoneKey]: e.target.value }))}
                placeholder="05XX XXX XX XX" className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label htmlFor={`contact-${emailKey}`} className="block text-sm font-medium mb-1">{label} E-posta</label>
              <input
                id={`contact-${emailKey}`} type="email" value={contact[emailKey]}
                onChange={(e) => setContact((c) => ({ ...c, [emailKey]: e.target.value }))}
                placeholder="ornek@eposta.com" className="w-full p-2 border rounded"
              />
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={saveContactInfo}
            disabled={contactSaving}
            className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white rounded-lg"
          >
            {contactSaving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          {contactSaved && <span className="text-green-600">✓ Kaydedildi</span>}
        </div>
      </div>
    </main>
  );
}

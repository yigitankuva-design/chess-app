'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { fetchMyClasses, fetchClassStudents } from '@/lib/homeworkApi';
import type { TeacherClass, ClassStudent } from '@/lib/homeworkApi';
import { avatarEmoji } from '@/lib/avatars';

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 2): "Sınıf Listesi" butonuyla
 * gelinen, bir sınıftaki sporcuları gösteren sayfa. Sporcu adına tıklayınca
 * GERÇEK Sporcu Profili açılır (/students/[id] — GRUP B'de oluşturulmuş,
 * salt-okunur profil sayfası; bu sayfa ona ilk gerçek bağlantıyı sağlıyor).
 */
export default function ClassRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const classId = Number(id);
  const router = useRouter();
  const { role, hydrated } = useAuth();

  const [cls, setCls] = useState<TeacherClass | null | undefined>(undefined);
  const [students, setStudents] = useState<ClassStudent[] | null>(null);

  useEffect(() => {
    if (!hydrated || role !== 'teacher') return;
    fetchMyClasses().then((list) => setCls(list.find((c) => c.id === classId) ?? null));
    fetchClassStudents(classId).then(setStudents);
  }, [hydrated, role, classId]);

  if (!hydrated) return null;
  if (role !== 'teacher') {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Bu sayfa yalnızca antrenörler içindir.</p></main>;
  }

  return (
    <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-extrabold t-premium">
        {cls === undefined ? 'Sınıf Listesi' : cls === null ? 'Sınıf bulunamadı' : cls.name}
      </h1>
      {cls?.join_code && (
        <p className="text-xs font-mono tracking-widest t-muted -mt-3">Kod: {cls.join_code}</p>
      )}

      <div className="t-card p-4">
        {students === null ? (
          <p className="text-xs t-muted">Yükleniyor…</p>
        ) : students.length === 0 ? (
          <p className="text-xs t-muted">Bu sınıfta henüz sporcu yok.</p>
        ) : (
          <div className="space-y-1">
            {students.map((s, i) => (
              <button key={s.id} type="button"
                onClick={() => router.push(`/students/${s.id}`)}
                className="w-full flex items-center gap-3 py-2 text-left"
                style={{ borderBottom: i < students.length - 1 ? '1px solid var(--t-border)' : undefined }}>
                <span className="text-lg">{avatarEmoji(s.avatar)}</span>
                <span className="text-sm font-semibold flex-1">{s.display_name}</span>
                {s.age != null && <span className="text-xs t-muted">{s.age}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => router.push('/coach/classes')}
        className="text-sm t-muted underline">← Sınıflarım&apos;a dön</button>
    </main>
  );
}

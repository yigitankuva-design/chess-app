'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  fetchMyClasses, fetchClassStudents, moveStudent, changeStudentClass,
} from '@/lib/homeworkApi';
import type { TeacherClass, ClassStudent } from '@/lib/homeworkApi';
import { avatarEmoji } from '@/lib/avatars';
import { EditSheet } from '@/components/profile/ProfileEditors';

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 2): "Sınıf Listesi" butonuyla
 * gelinen, bir sınıftaki sporcuları gösteren sayfa. Sporcu adına tıklayınca
 * GERÇEK Sporcu Profili açılır (/students/[id] — GRUP B'de oluşturulmuş,
 * salt-okunur profil sayfası; bu sayfa ona ilk gerçek bağlantıyı sağlıyor).
 *
 * Madde 2026-09-13 (devam, sporcu yönetimi): avatar artık gerçek foto
 * (varsa) veya mevcut emoji avatar — ProfileView.tsx'teki AYNI foto/emoji
 * geri düşüş deseni; solunda sıra numarası. İsmin yanında nickname (varsa).
 * ▲/▼ ile sınıf içi sıralama (Sınıflarım'daki sınıf sıralamasıyla AYNI
 * desen, sporcu seviyesinde). Yaş rozeti kaldırıldı, yerine "Sınıf
 * Değiştir" — mevcut add_student ucu force=true ile tekrar kullanılıyor.
 */
export default function ClassRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const classId = Number(id);
  const router = useRouter();
  const { role, hydrated } = useAuth();

  const [cls, setCls] = useState<TeacherClass | null | undefined>(undefined);
  const [allClasses, setAllClasses] = useState<TeacherClass[] | null>(null);
  const [students, setStudents] = useState<ClassStudent[] | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const [changingClassFor, setChangingClassFor] = useState<ClassStudent | null>(null);
  const [targetClassId, setTargetClassId] = useState<number | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeErr, setChangeErr] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || role !== 'teacher') return;
    fetchMyClasses().then((list) => {
      setAllClasses(list);
      setCls(list.find((c) => c.id === classId) ?? null);
    });
    fetchClassStudents(classId).then(setStudents);
  }, [hydrated, role, classId]);

  async function handleMove(childId: number, direction: 'up' | 'down') {
    if (!students) return;
    const idx = students.findIndex((s) => s.id === childId);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || neighborIdx < 0 || neighborIdx >= students.length) return;
    setActionBusyId(childId);
    const ok = await moveStudent(classId, childId, direction);
    setActionBusyId(null);
    if (!ok) return;
    setStudents((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      [next[idx], next[neighborIdx]] = [next[neighborIdx], next[idx]];
      return next;
    });
  }

  function startChangeClass(s: ClassStudent) {
    setChangeErr(null);
    setTargetClassId(null);
    setChangingClassFor(s);
  }

  async function saveChangeClass() {
    if (!changingClassFor || targetClassId == null) { setChangeErr('Bir sınıf seç.'); return; }
    setChangeBusy(true);
    const ok = await changeStudentClass(targetClassId, changingClassFor.id);
    setChangeBusy(false);
    if (!ok) { setChangeErr('Taşınamadı, tekrar dene.'); return; }
    setStudents((prev) => (prev ? prev.filter((s) => s.id !== changingClassFor.id) : prev));
    setChangingClassFor(null);
  }

  if (!hydrated) return null;
  if (role !== 'teacher') {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Bu sayfa yalnızca antrenörler içindir.</p></main>;
  }

  const otherClasses = (allClasses ?? []).filter((c) => c.id !== classId);

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
          <div className="space-y-2">
            {students.map((s, i) => (
              <div key={s.id} className="py-2"
                style={{ borderBottom: i < students.length - 1 ? '1px solid var(--t-border)' : undefined }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold t-muted w-6 text-right shrink-0">{i + 1}.</span>
                  <button type="button" onClick={() => router.push(`/students/${s.id}`)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 overflow-hidden"
                      style={{ background: 'var(--t-surface-2)' }}>
                      {s.photo_data_url
                        ? <img src={s.photo_data_url} alt={s.display_name} className="w-full h-full object-cover" />
                        : avatarEmoji(s.avatar)}
                    </div>
                    <span className="text-sm font-semibold truncate">
                      {s.display_name}{s.nickname ? ` - ${s.nickname}` : ''}
                    </span>
                  </button>
                  <div className="flex flex-col shrink-0" style={{ color: 'var(--t-text-2)' }}>
                    <button type="button" onClick={() => handleMove(s.id, 'up')}
                      disabled={i === 0 || actionBusyId === s.id}
                      aria-label={`${s.display_name} yukarı taşı`}
                      className="p-0.5 disabled:opacity-25">
                      <ChevronUpIcon />
                    </button>
                    <button type="button" onClick={() => handleMove(s.id, 'down')}
                      disabled={i === students.length - 1 || actionBusyId === s.id}
                      aria-label={`${s.display_name} aşağı taşı`}
                      className="p-0.5 disabled:opacity-25">
                      <ChevronDownIcon />
                    </button>
                  </div>
                </div>
                <div className="flex justify-end mt-1 pl-8">
                  <button type="button" onClick={() => startChangeClass(s)}
                    className="text-xs font-bold px-2 py-1 rounded-md"
                    style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)' }}>
                    Sınıf Değiştir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => router.push('/coach/classes')}
        className="text-sm t-muted underline">← Sınıflarım&apos;a dön</button>

      {changingClassFor && (
        <EditSheet title={`${changingClassFor.display_name} — Sınıf Değiştir`} busy={changeBusy} err={changeErr}
          onSave={saveChangeClass} onCancel={() => setChangingClassFor(null)}>
          {otherClasses.length === 0 ? (
            <p className="text-sm t-muted">Taşınacak başka sınıfın yok.</p>
          ) : (
            <label className="block text-[10px] font-bold uppercase tracking-wide t-muted">
              Yeni Sınıf
              <select value={targetClassId ?? ''} onChange={(e) => setTargetClassId(Number(e.target.value))}
                aria-label="Yeni Sınıf"
                className="rounded-lg px-3 py-2 text-sm w-full mt-1"
                style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }}>
                <option value="" disabled>Seç…</option>
                {otherClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </EditSheet>
      )}
    </main>
  );
}

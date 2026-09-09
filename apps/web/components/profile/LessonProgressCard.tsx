'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  isSubtopicUnlocked, isLessonCompleted, thresholdFor,
} from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap, ThresholdMap } from '@/lib/practice/unlock';
import { fetchLessonScores, fetchPracticeDetail, fetchAttemptsSummary, fetchAttempts } from '@/lib/practice/practiceApi';
import type { PracticeDetail, AttemptsSummary, AttemptRow } from '@/lib/practice/practiceApi';
import { fetchMyActiveStepIds } from '@/lib/assignmentsApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Madde 2026-09-05: Sporcu Profili — "Ders İlerlemesi" + "Ödevlerim".
 * Zafer'in gönderdiği görsele göre gerçek hiyerarşi: Düzey (TD/BD/OD/İD) →
 * Konu (1-8 kutucuk) → Alt Konu → mod (Ödevini Yap/Süreli Pratik Yap/
 * Kendini Test Et) → soru bazlı yeşil/kırmızı kare.
 *
 * Madde 2026-09-06 (Görsel 6/7): "Süreli Pratik Yap" ve "Kendini Test Et"
 * de artık gerçek veriye bağlı — üçü de TAMAMLANDI:
 *   - Ödevini Yap: en iyi denemenin soru bazlı yeşil/kırmızı kareleri.
 *   - Süreli Pratik Yap: Günlük/Haftalık/Aylık/Yıllık istatistik tablosu
 *     (child_practice_attempts'in TAKVİM dönemlerine göre toplamı).
 *   - Kendini Test Et: her deneme kendi "Sınav-N" sekmesi, seçilenin soru
 *     bazlı kareleri gösterilir.
 *
 * Madde 2026-09-06 (v2 düzeltmeleri — Zafer'in yeni görselleri):
 *   - Görsel 5: seçili modun (Ödevini Yap/Süreli Pratik Yap/Kendini Test Et)
 *     içeriği ÖNCEDEN tüm Alt Konu listesinin en altına render ediliyordu
 *     (yanlış yerdeydi). Artık ilgili Alt Konu'nun kendi mod-sekmeleri
 *     satırının HEMEN ALTINDA, bir sonraki Alt Konu kartının ÜSTÜNDE.
 *   - Görsel 6: "Süreli Pratik Yap" istatistik satırı mobilde sığmayıp alt
 *     satıra kayıyordu — "Doğru Sayısı"/"Yanlış Sayısı" kısaltıldı
 *     ("Doğru"/"Yanlış") ve 4 sütun (bkz. STAT_ROW_COLS) her satırda AYNI
 *     genişlikte tutulup satırlar arasında hizalandı (simetrik görünüm).
 *
 * Madde 2026-09-07 (GRUP D): Antrenör'ün "Ödev Gönder" ikonuyla verdiği bir
 * Alt Konu ödevi (bkz. lib/assignmentsApi.ts fetchMyActiveStepIds) bu Alt
 * Konu'nun normal zincir kilidini EZER (assignedStepIds'te olan bir alt
 * konu her zaman tıklanabilir) ve "Ödevini Yap" pill'i, sporcu henüz
 * geçmediyse MAVİ görünür — geçince mevcut "tamamlandı" (var(--t-accent))
 * rengine döner (yeni renk İCAT EDİLMEDİ). Sadece kendi profilinde
 * (childId YOKKEN) çalışır — antrenör görünümünde bu uç child-token
 * gerektirdiği için çağrılmaz (KURAL #3: mevcut davranış bozulmaz).
 */

// Kodlar Zafer'in verdiği sırayla (TD-BD-OD-İD); isimler gerçek modül
// adlarıyla AYNI (scripts/reset_curriculum.py) — profile/page.tsx'teki
// mevcut LEVEL_ORDER/LEVEL_NAMES ile BİREBİR aynı sabitler (madde 5).
type LevelCode = 'TD' | 'BD' | 'OD' | 'İD';
const LEVEL_ORDER: LevelCode[] = ['TD', 'BD', 'OD', 'İD'];
const LEVEL_NAMES: Record<LevelCode, string> = {
  TD: 'Temel Düzey', BD: 'Başlangıç Düzeyi', OD: 'Orta Düzey', 'İD': 'İleri Düzey',
};

const MODE_TABS: { slug: PracticeMode; label: string }[] = [
  { slug: 'suresiz', label: 'Ödevini Yap' },
  { slug: 'sureli', label: 'Süreli Pratik Yap' },
  { slug: 'test', label: 'Kendini Test Et' },
];

/**
 * Madde 2026-09-06 (Görsel 6 - v2): "Süreli Pratik Yap" istatistik satırı
 * (Günlük/Haftalık/Aylık/Yıllık) — 4 sütun DAİMA aynı genişlikte olsun diye
 * (satırlar arasında hizalı/simetrik görünsün) tüm satırlarda AYNI grid
 * tanımı kullanılır. Genişlikler eşit DEĞİL (1fr yerine) — "Başarı Oranı"
 * en uzun etiket olduğu için ona biraz daha pay verilir, dar (mobil)
 * ekranlarda metin alt satıra kaymasın diye.
 */
const STAT_ROW_COLS = '1fr 0.85fr 0.85fr 1.5fr';

interface ModuleSummary { id: number; name: string; lessons_count: number }
interface LessonSummary { id: number; order_index: number; title: string }
interface Subtopic { stepId: number; title: string }

interface LessonProgressCardProps {
  /** Madde 2026-09-07 (GRUP B): antrenörün salt-okunur Sporcu Profili
   *  görünümü — verilirse skor/deneme uçları `/teacher/students/{childId}/
   *  practice/...`'e gider (bkz. lib/practice/practiceApi.ts). Verilmezse
   *  mevcut davranış (kendi çocuk token'ı) DEĞİŞMEZ. */
  childId?: number;
}

export function LessonProgressCard({ childId }: LessonProgressCardProps = {}) {
  const [level, setLevel] = useState<LevelCode>('TD');
  const [modules, setModules] = useState<ModuleSummary[] | null>(null);
  const [lessonsByModule, setLessonsByModule] = useState<Record<number, LessonSummary[]>>({});
  const [subtopicsByLesson, setSubtopicsByLesson] = useState<Record<number, Subtopic[]>>({});
  const [scoresByLesson, setScoresByLesson] = useState<Record<number, ScoreMap | null>>({});
  const [thresholdsByLesson, setThresholdsByLesson] = useState<Record<number, ThresholdMap>>({});

  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [openSubtopic, setOpenSubtopic] = useState<{ lessonId: number; stepId: number; title: string } | null>(null);
  const [openMode, setOpenMode] = useState<PracticeMode | null>(null);
  const [practiceDetail, setPracticeDetail] = useState<PracticeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  /** Madde 2026-09-06 (Görsel 6): "Süreli Pratik Yap" — Günlük/Haftalık/Aylık/Yıllık. */
  const [attemptsSummary, setAttemptsSummary] = useState<AttemptsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  /** Madde 2026-09-06 (Görsel 7): "Kendini Test Et" — "Sınav-N" geçmişi. */
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [selectedAttemptIdx, setSelectedAttemptIdx] = useState(0);
  /** Madde 2026-09-07 (GRUP D): Antrenör'ün Alt Konu bazlı ödev verdiği
   *  lesson_step id'leri — boş küme = normal kilit davranışı (KURAL #3). */
  const [assignedStepIds, setAssignedStepIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (childId != null) return; // antrenör görünümü: child-token gerektiren uç, atlanır.
    fetchMyActiveStepIds().then(setAssignedStepIds);
  }, [childId]);

  useEffect(() => {
    fetch(`${API_BASE}/modules`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setModules(Array.isArray(list) ? list : []))
      .catch(() => setModules([]));
  }, []);

  const currentModule = modules?.find((m) => m.name === LEVEL_NAMES[level]) ?? null;

  const loadSubtopics = useCallback(async (lessonId: number) => {
    try {
      const detail = await fetch(`${API_BASE}/lessons/${lessonId}`).then((r) => (r.ok ? r.json() : { steps: [] }));
      const subs: Subtopic[] = (detail.steps ?? [])
        .filter((s: { type: string; content_json?: { title?: string } }) => s.type === 'explanation' && s.content_json?.title)
        .map((s: { id: number; content_json: { title: string } }) => ({ stepId: s.id, title: s.content_json.title }));
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: subs }));
      const thresholds: ThresholdMap = {};
      for (const s of (detail.steps ?? []) as { id: number; content_json?: { success_scores?: Record<string, number> } }[]) {
        const raw = s.content_json?.success_scores;
        if (!raw) continue;
        const entry: Partial<Record<PracticeMode, number>> = {};
        if (typeof raw.board_exercises === 'number') entry.suresiz = raw.board_exercises;
        if (typeof raw.board_exercises_timed === 'number') entry.sureli = raw.board_exercises_timed;
        if (typeof raw.board_exercises_test === 'number') entry.test = raw.board_exercises_test;
        if (Object.keys(entry).length > 0) thresholds[s.id] = entry;
      }
      setThresholdsByLesson((prev) => ({ ...prev, [lessonId]: thresholds }));
      const scoreMap = await fetchLessonScores(lessonId, childId);
      setScoresByLesson((prev) => ({ ...prev, [lessonId]: scoreMap }));
    } catch {
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: [] }));
    }
  }, [childId]);

  // Madde 10 ile AYNI mantık (home/page.tsx): bir düzeyin dersleri gelince,
  // HEPSİNİN alt konu+skor bilgisi ÖNCEDEN çekilir — hem "N/N konu
  // tamamlandı" başlığı hem kutucukların üstündeki gösterge bunsuz hesaplanamaz.
  useEffect(() => {
    if (!currentModule || lessonsByModule[currentModule.id]) return;
    const moduleId = currentModule.id;
    fetch(`${API_BASE}/modules/${moduleId}/lessons`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: LessonSummary[]) => {
        const lessons = Array.isArray(list) ? list : [];
        setLessonsByModule((prev) => ({ ...prev, [moduleId]: lessons }));
        void Promise.all(lessons.map((l) => loadSubtopics(l.id)));
      })
      .catch(() => setLessonsByModule((prev) => ({ ...prev, [moduleId]: [] })));
  }, [currentModule, lessonsByModule, loadSubtopics]);

  const lessons = currentModule ? lessonsByModule[currentModule.id] : undefined;
  const totalLessons = lessons?.length ?? 0;
  const completedLessons = (lessons ?? []).filter((l) => {
    const subs = subtopicsByLesson[l.id];
    if (!subs) return false;
    return isLessonCompleted(subs.map((s) => s.stepId), scoresByLesson[l.id] ?? undefined, thresholdsByLesson[l.id]);
  }).length;

  function selectLevel(code: LevelCode) {
    setLevel(code);
    setOpenLessonId(null);
    setOpenSubtopic(null);
    setOpenMode(null);
    setPracticeDetail(null);
    setAttemptsSummary(null);
    setAttempts(null);
  }

  function toggleLesson(lessonId: number) {
    setOpenLessonId((prev) => (prev === lessonId ? null : lessonId));
    setOpenSubtopic(null);
    setOpenMode(null);
    setPracticeDetail(null);
    setAttemptsSummary(null);
    setAttempts(null);
  }

  function toggleSubtopic(lessonId: number, sub: Subtopic) {
    setOpenSubtopic((prev) => (prev?.stepId === sub.stepId ? null : { lessonId, stepId: sub.stepId, title: sub.title }));
    setOpenMode(null);
    setPracticeDetail(null);
    setAttemptsSummary(null);
    setAttempts(null);
  }

  function selectMode(mode: PracticeMode) {
    setOpenMode((prev) => (prev === mode ? null : mode));
    setPracticeDetail(null);
    setAttemptsSummary(null);
    setAttempts(null);
    if (!openSubtopic) return;
    if (mode === 'suresiz') {
      setDetailLoading(true);
      fetchPracticeDetail(openSubtopic.stepId, 'suresiz', childId)
        .then(setPracticeDetail)
        .finally(() => setDetailLoading(false));
    } else if (mode === 'sureli') {
      setSummaryLoading(true);
      fetchAttemptsSummary(openSubtopic.stepId, 'sureli', childId)
        .then(setAttemptsSummary)
        .finally(() => setSummaryLoading(false));
    } else if (mode === 'test') {
      setAttemptsLoading(true);
      setSelectedAttemptIdx(0);
      fetchAttempts(openSubtopic.stepId, 'test', childId)
        .then(setAttempts)
        .finally(() => setAttemptsLoading(false));
    }
  }

  const openLessonSubs = openLessonId != null ? subtopicsByLesson[openLessonId] : undefined;
  const openLessonScores = openLessonId != null ? scoresByLesson[openLessonId] : undefined;
  const openLessonThresholds = openLessonId != null ? thresholdsByLesson[openLessonId] : undefined;
  const orderedStepIds = (openLessonSubs ?? []).map((s) => s.stepId);

  const passThreshold = openSubtopic ? thresholdFor(openLessonThresholds, openSubtopic.stepId, 'suresiz') : 85;
  const suresizCompleted = practiceDetail != null && practiceDetail.best_score >= passThreshold;

  return (
    <div className="t-card p-4">
      <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
        <span className="text-xs font-bold uppercase tracking-wide t-muted">Ders İlerlemesi</span>
        <div className="flex gap-1.5">
          {LEVEL_ORDER.map((code) => (
            <button
              key={code} type="button" onClick={() => selectLevel(code)} aria-pressed={level === code}
              className="font-mono text-xs font-bold px-2.5 py-1 rounded-full transition-colors"
              style={{
                background: level === code ? 'var(--t-accent)' : 'var(--t-surface-2)',
                color: level === code ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
              }}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm font-bold mb-2.5">
        {LEVEL_NAMES[level]} · {completedLessons}/{totalLessons} konu tamamlandı
      </p>

      {lessons === undefined && <p className="text-xs t-muted py-1">Yükleniyor...</p>}
      {lessons?.length === 0 && <p className="text-xs t-muted py-1">Bu düzeyde henüz ders yok.</p>}

      {/* Madde 2026-09-06 (Görsel 5): sabit 4'lü satır ızgarası (auto-fill DEĞİL). */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {(lessons ?? []).map((l, i) => {
          const subs = subtopicsByLesson[l.id];
          const done = subs
            ? isLessonCompleted(subs.map((s) => s.stepId), scoresByLesson[l.id] ?? undefined, thresholdsByLesson[l.id])
            : false;
          // Madde 2026-09-05: sadece "Ödevini Yap" gerçek veriye bağlı — bu
          // konudaki TÜM alt konuların suresiz'i geçmiş mi? Süreli/Test için
          // görseller henüz gelmedi, o iki gösterge şimdilik boş kalır.
          const homeworkDone = subs != null && subs.length > 0 && subs.every((s) => {
            const score = scoresByLesson[l.id]?.[s.stepId]?.suresiz ?? 0;
            return score >= thresholdFor(thresholdsByLesson[l.id], s.stepId, 'suresiz');
          });
          return (
            <div key={l.id} className="text-center">
              <div className="flex gap-0.5 justify-center mb-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: homeworkDone ? 'var(--t-accent)' : 'var(--t-surface-2)' }} />
                <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--t-surface-2)' }} />
                <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--t-surface-2)' }} />
              </div>
              <button
                type="button"
                onClick={() => toggleLesson(l.id)}
                aria-pressed={openLessonId === l.id}
                aria-label={`${i + 1}. konu: ${l.title}`}
                className="w-full aspect-square rounded-md flex items-center justify-center p-1 text-center transition-colors"
                style={{
                  background: openLessonId === l.id || done ? 'var(--t-accent)' : 'var(--t-surface-2)',
                  color: openLessonId === l.id || done ? 'var(--t-accent-fg)' : 'var(--t-text-1)',
                }}
              >
                {/* Zafer'in isteği (2026-09-09): kart artık salt sıra
                    numarası değil, ait olduğu dersin adını gösteriyor. */}
                <span className="text-[10px] leading-tight font-bold line-clamp-3">{l.title}</span>
              </button>
            </div>
          );
        })}
      </div>

      {openLessonId != null && (() => {
        const lessonId = openLessonId;
        return (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--t-border)' }}>
          {openLessonSubs === undefined && <p className="text-xs t-muted py-1">Yükleniyor...</p>}
          {openLessonSubs?.length === 0 && <p className="text-xs t-muted py-1">Alt konu bulunamadı.</p>}
          <div className="flex flex-col gap-1.5">
            {openLessonSubs?.map((sub) => {
              const subOpen = openSubtopic?.stepId === sub.stepId;
              // Madde 2026-09-07 (GRUP D): Antrenör'ün Alt Konu bazlı ödevi
              // varsa (assignedStepIds), normal zincir kilidi EZİLİR.
              const assigned = assignedStepIds.has(sub.stepId);
              const locked = openLessonScores != null
                && !isSubtopicUnlocked(orderedStepIds, sub.stepId, openLessonScores, openLessonThresholds)
                && !assigned;
              const suresizScore = openLessonScores?.[sub.stepId]?.suresiz ?? 0;
              const subSuresizDone = suresizScore >= thresholdFor(openLessonThresholds, sub.stepId, 'suresiz');
              return (
                <div key={sub.stepId}>
                  <button
                    type="button"
                    onClick={() => { if (!locked) toggleSubtopic(lessonId, sub); }}
                    aria-pressed={subOpen}
                    aria-disabled={locked}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: subOpen ? 'var(--t-accent)' : 'var(--t-surface-2)',
                      color: subOpen ? 'var(--t-accent-fg)' : 'var(--t-text-1)',
                      opacity: locked ? 0.5 : 1,
                    }}
                  >
                    {locked ? `🔒 ${sub.title}` : sub.title}
                  </button>

                  {subOpen && (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 mt-1.5 mb-2">
                        {MODE_TABS.map((m) => {
                          // Madde 2026-09-07 (GRUP D): "Ödevini Yap" pill'i —
                          // ödev atanmış VE henüz geçilmemişse MAVİ, geçilmişse
                          // mevcut "tamamlandı" (var(--t-accent)) rengi. Ödev
                          // atanmamışsa davranış AYNEN eskisi gibi (KURAL #3).
                          let background = openMode === m.slug ? 'var(--t-accent)' : 'var(--t-surface-2)';
                          let color = openMode === m.slug ? 'var(--t-accent-fg)' : 'var(--t-text-2)';
                          if (m.slug === 'suresiz' && assigned) {
                            if (subSuresizDone) {
                              background = 'var(--t-accent)'; color = 'var(--t-accent-fg)';
                            } else {
                              background = '#3b82f6'; color = '#fff';
                            }
                          }
                          return (
                            <button
                              key={m.slug} type="button" onClick={() => selectMode(m.slug)}
                              aria-pressed={openMode === m.slug}
                              className="px-2 py-1.5 rounded-lg text-xs font-bold transition-colors"
                              style={{ background, color }}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Madde 2026-09-06 (Görsel 5 - v2): seçili modun içeriği
                          artık "Ödevini Yap" (mod sekmeleri) kartının HEMEN
                          ALTINDA ve bir sonraki Alt Konu kartının ÜSTÜNDE —
                          önceden tüm Alt Konu listesinin en altına render
                          ediliyordu, o yüzden yanlış yerde görünüyordu. */}
                      {openMode === 'sureli' && (
                        <div className="mb-2 pt-2 border-t" style={{ borderColor: 'var(--t-border)' }}>
                          {summaryLoading && <p className="text-xs t-muted py-1 text-center">Yükleniyor...</p>}
                          {!summaryLoading && attemptsSummary && (
                            <div className="flex flex-col">
                              {([
                                ['Günlük', attemptsSummary.daily],
                                ['Haftalık', attemptsSummary.weekly],
                                ['Aylık', attemptsSummary.monthly],
                                ['Yıllık', attemptsSummary.yearly],
                              ] as const).map(([label, stat], i) => (
                                <div key={label}
                                  className="grid items-center gap-1 py-2"
                                  style={{
                                    gridTemplateColumns: STAT_ROW_COLS,
                                    borderTop: i === 0 ? 'none' : '1px solid var(--t-border)',
                                  }}>
                                  {/* Zafer'in isteği (2026-09-09): "Günlük/Haftalık/Aylık/Yıllık"
                                      etiketleri farklı uzunlukta olduğu için sayı hizasız
                                      duruyordu — etiket artık sabit genişlikte bir alt-span,
                                      sayı her satırda AYNI x konumundan başlıyor. */}
                                  <span className="text-[11px] font-bold whitespace-nowrap flex items-baseline gap-1">
                                    <span className="inline-block" style={{ width: '52px' }}>{label}:</span>
                                    <span>{stat.total}</span>
                                  </span>
                                  <span className="text-[11px] whitespace-nowrap">Doğru: <b style={{ color: 'var(--t-ok-text)' }}>{stat.correct}</b></span>
                                  <span className="text-[11px] whitespace-nowrap">Yanlış: <b style={{ color: 'var(--t-err-text)' }}>{stat.wrong}</b></span>
                                  <span className="text-[11px] whitespace-nowrap text-right">Başarı Oranı: <b>%{stat.success_rate}</b></span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {openMode === 'test' && (
                        <div className="mb-2 pt-2 border-t" style={{ borderColor: 'var(--t-border)' }}>
                          {attemptsLoading && <p className="text-xs t-muted py-1 text-center">Yükleniyor...</p>}
                          {!attemptsLoading && attempts && attempts.length === 0 && (
                            <p className="text-xs t-muted py-1 text-center">Bu alt konuda henüz bir sınav denemesi yok.</p>
                          )}
                          {!attemptsLoading && attempts && attempts.length > 0 && (() => {
                            const selected = attempts[selectedAttemptIdx] ?? attempts[0];
                            const testThreshold = openSubtopic ? thresholdFor(openLessonThresholds, openSubtopic.stepId, 'test') : 85;
                            const selectedScore = selected.total_count > 0
                              ? Math.round((selected.correct_count / selected.total_count) * 100) : 0;
                            const passed = selectedScore >= testThreshold;
                            return (
                              <>
                                <div className="flex gap-1.5 flex-wrap mb-3">
                                  {attempts.map((a, i) => (
                                    <button
                                      key={a.attempt_no} type="button" onClick={() => setSelectedAttemptIdx(i)}
                                      aria-pressed={i === selectedAttemptIdx}
                                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                      style={{
                                        background: i === selectedAttemptIdx ? 'var(--t-accent)' : 'var(--t-surface-2)',
                                        color: i === selectedAttemptIdx ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
                                      }}
                                    >
                                      Sınav - {a.attempt_no}
                                    </button>
                                  ))}
                                </div>
                                {selected.total_count > 0 && (
                                  <div
                                    className="grid gap-1.5 mx-auto mb-3"
                                    style={{ gridTemplateColumns: `repeat(${Math.min(selected.total_count, 8)}, 22px)`, maxWidth: '100%' }}
                                  >
                                    {Array.from({ length: selected.total_count }, (_, i) => {
                                      const result = selected.per_question_correct?.[i];
                                      const bg = result === true ? 'var(--t-ok-text)' : result === false ? 'var(--t-err-text)' : 'var(--t-surface-2)';
                                      return <div key={i} className="aspect-square rounded-md" style={{ background: bg }} />;
                                    })}
                                  </div>
                                )}
                                <p className="text-xs text-center" style={{ color: passed ? 'var(--t-ok-text)' : 'var(--t-err-text)' }}>
                                  {passed
                                    ? 'Tebrikler, sınav performansınız başarı eşiğinin üzerinde.'
                                    : 'Maalesef sınav performansınız kritik eşiğin altındadır. Başarı sınırını geçmek için yeniden sınava girebilirsiniz.'}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {openMode === 'suresiz' && openSubtopic && (
                        <div className="mb-2 pt-2 border-t" style={{ borderColor: 'var(--t-border)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wide t-muted">Ödevlerim</span>
                          </div>
                          {detailLoading && <p className="text-xs t-muted py-1 text-center">Yükleniyor...</p>}
                          {!detailLoading && practiceDetail && (
                            /* Madde 2026-09-06 (Görsel 5): cümle + kare kartlar ortalanır. */
                            <div className="text-center">
                              <p className="text-sm font-bold italic mb-2">
                                {/* Zafer'in isteği (2026-09-09): "{başlık} - {sıra} konusuna
                                    ait ödev..." eki, başlığın kendisi zaten "- N" ile bitince
                                    "- 1 - 1" gibi TEKRARA yol açıyordu — kaldırıldı, sadece
                                    alt konunun kendi başlığı kullanılıyor. */}
                                {openSubtopic.title} konusuna ait
                                ödev {suresizCompleted ? 'tamamlanmıştır' : 'tamamlanmamıştır'}.
                              </p>
                              {practiceDetail.pool_size === 0 ? (
                                <p className="text-xs t-muted py-1">Bu alt konu için henüz soru eklenmedi.</p>
                              ) : (
                                // Zafer'in isteği: soru kartları %20 büyütüldü (22px → 26px) ve ortalandı.
                                <div
                                  className="grid gap-1.5 mx-auto justify-center"
                                  style={{ gridTemplateColumns: `repeat(${Math.min(practiceDetail.pool_size, 5)}, 26px)`, maxWidth: '100%' }}
                                >
                                  {Array.from({ length: practiceDetail.pool_size }, (_, i) => {
                                    const result = practiceDetail.per_question_correct?.[i];
                                    const bg = result === true ? 'var(--t-ok-text)' : result === false ? 'var(--t-err-text)' : 'var(--t-surface-2)';
                                    return <div key={i} className="aspect-square rounded-md" style={{ background: bg }} />;
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

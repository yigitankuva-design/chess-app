'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getAthleteName } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';
import { visibleTabsInOrder } from '@/lib/settings/defaults';
import type { TabKey } from '@/lib/settings/defaults';
import {
  isModeUnlocked, isSubtopicUnlocked, isLessonCompleted, isLessonUnlocked,
} from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap } from '@/lib/practice/unlock';
import { fetchLessonScores } from '@/lib/practice/practiceApi';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import { useRouter } from 'next/navigation';
import { usePresenceCount } from '@/lib/presence/PresenceContext';
import { ActivePlayersBadge, activeColor } from '@/components/play/ActivePlayersBadge';
import { listCustomTabs } from '@/lib/customTabsApi';
import type { CustomTabSummary } from '@/lib/customTabsApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Düzey ikonları sırayla kullanılır — düzeylerin kendisi admin'den (DB) gelir. */
const LEVEL_EMOJIS = ['🌱', '😊', '😎', '🔥', '⭐', '👑', '🚀', '🏆'];

const EGLENCE_GAMES = [
  { slug: 'bulmaca-duellosu', emoji: '⚔️', label: 'Bulmaca Düellosu' },
  { slug: 'bulmaca-firtinasi', emoji: '🌪️', label: 'Bulmaca Fırtınası' },
  { slug: 'koordinat-yarisi', emoji: '🏁', label: 'Koordinat Yarışı' },
  { slug: 'acilisi-tahmin-et', emoji: '🎯', label: 'Açılışı Tahmin Et' },
];

const FEATURE_COLORS = {
  play: '#34d399',
  lessons: '#38bdf8',
  analiz: '#a78bfa',
  eglence: '#f472b6',
};

const SUBTOPIC_EMOJIS = ['📋', '🎯', '🛤️', '♟️', '🏁', '✅', '📖', '🧩', '👑', '⭐'];

/** Admin'in eklediği ek sekmeler için sırayla kullanılan renkler */
const CUSTOM_TAB_COLORS = ['#fbbf24', '#2dd4bf', '#fb7185', '#60a5fa', '#c084fc'];

/* ── Modern çizgi ikonlar (emoji yerine) ─────────────────────────────── */
const svgBase = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

const IconBot = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <rect x="4" y="8" width="16" height="12" rx="3.5" />
    <path d="M12 8V5.2" /><circle cx="12" cy="3.6" r="1.3" />
    <circle cx="9" cy="13.6" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13.6" r="1.15" fill="currentColor" stroke="none" />
    <path d="M9.6 17h4.8" />
  </svg>
);
const IconFriends = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <circle cx="9" cy="7.8" r="3.2" />
    <path d="M3.6 19.2v-1.1a4.6 4.6 0 0 1 4.6-4.6h1.6a4.6 4.6 0 0 1 4.6 4.6v1.1" />
    <path d="M16.2 5.2a3.2 3.2 0 0 1 0 6.2" />
    <path d="M17.6 13.7a4.6 4.6 0 0 1 2.8 4.4v1.1" />
  </svg>
);
const IconTrophy = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <path d="M8 4h8v4.6a4 4 0 0 1-8 0z" />
    <path d="M8 5.4H5.4v1.4a2.6 2.6 0 0 0 2.6 2.6" />
    <path d="M16 5.4h2.6v1.4a2.6 2.6 0 0 1-2.6 2.6" />
    <path d="M12 12.6v3.2" /><path d="M8.6 20h6.8" /><path d="M10 20l.5-4.2h3l.5 4.2" />
  </svg>
);

/** Tempo ve Süre sütunlarının satırları hizalı kalsın diye sabit satır yüksekliği */


/* Zorluk göstergesi — dolu çubuk sayısı seviyeyi anlatır */

/* Dairesel seçim (radio) düğmesi */

const PRACTICE_MODES = [
  { slug: 'suresiz', emoji: '♾️', label: 'Süresiz Pratik Yap', color: '#2dd4bf' },
  { slug: 'sureli',  emoji: '⏱️', label: 'Süreli Pratik Yap',  color: '#fbbf24' },
  { slug: 'test',    emoji: '📝', label: 'Kendini Test Et',    color: '#a78bfa' },
];

const QA_STATE_KEY = 'bea_qa_state_v2';

interface ModuleSummary { id: number; order_index: number; name: string; lessons_count: number }
interface LessonSummary { id: number; order_index: number; title: string; estimated_minutes: number }
interface Subtopic { stepId: number; title: string }

/* ── Yumuşak kabartma yüzeyler — gölgeler tema renginden türetilir ────── */
const SH_DARK = 'color-mix(in srgb, var(--t-surface) 55%, #000)';
const SH_LIGHT = 'color-mix(in srgb, var(--t-surface) 84%, #fff)';

function raised(radius: number | string = 14, depth = 5): React.CSSProperties {
  return {
    background: 'var(--t-surface)',
    borderRadius: radius,
    border: 'none',
    boxShadow: `${depth}px ${depth}px ${depth * 2}px ${SH_DARK}, -${depth}px -${depth}px ${depth * 2}px ${SH_LIGHT}`,
  };
}
function pressed(radius: number | string = 14, depth = 4): React.CSSProperties {
  return {
    background: 'var(--t-surface)',
    borderRadius: radius,
    border: 'none',
    boxShadow: `inset ${depth}px ${depth}px ${depth * 2}px ${SH_DARK}, inset -${depth}px -${depth}px ${depth * 2}px ${SH_LIGHT}`,
  };
}

/* Patika düğümü: yuvarlak kabartma buton + yanında etiket */
function PathNode({
  emoji, label, active, size, onClick, labelColor,
}: { emoji: string; label: string; active: boolean; size: number; onClick: () => void; labelColor?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left transition-transform active:scale-[0.98]"
      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ ...(active ? pressed(999, 3) : raised(999, 4)), width: size, height: size, fontSize: size * 0.44 }}
      >
        {emoji}
      </span>
      <span
        className="font-bold leading-tight"
        style={{
          fontSize: size >= 40 ? '0.86rem' : size >= 34 ? '0.8rem' : '0.75rem',
          color: active ? (labelColor ?? 'var(--t-accent)') : 'var(--t-text-1)',
        }}
      >
        {label}
      </span>
    </button>
  );
}

/* Katmanlar arası kesikli bağlantı çizgisi */
function Branch({ offset, children }: { offset: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginLeft: offset,
        paddingLeft: 18,
        borderLeft: `2px dashed ${SH_LIGHT}`,
        marginTop: 10,
        display: 'grid',
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

export default function ChildHomePage() {
  const { settings } = useSettings();
  const activeCount = usePresenceCount();
  // Tek seferde yalnızca bir sekme açık (akordiyon)
  const [openTab, setOpenTab] = useState<TabKey | null>(null);
  const showLevels = openTab === 'lessons';
  const showEglence = openTab === 'eglence';
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [customTabs, setCustomTabs] = useState<CustomTabSummary[]>([]);
  useEffect(() => { listCustomTabs().then(setCustomTabs); }, []);

  const [modules, setModules] = useState<ModuleSummary[] | null>(null);
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [lessonsByLevel, setLessonsByLevel] = useState<Record<number, LessonSummary[]>>({});
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [subtopicsByLesson, setSubtopicsByLesson] = useState<Record<number, Subtopic[]>>({});
  /** lessonId → skor haritası. null değer = kilit uygulanmaz (token yok). */
  const [scoresByLesson, setScoresByLesson] = useState<Record<number, ScoreMap | null>>({});
  const [openSubtopic, setOpenSubtopic] = useState<{ lessonId: number; stepId: number; title: string } | null>(null);

  // Maç Yap: Oyun türü → Zorluk → Tempo → Süre
  const showPlay = openTab === 'play';
  const router = useRouter();
  const [openBot, setOpenBot] = useState(false);

  const L = settings.labels;
  const orderedTabs = visibleTabsInOrder(settings);

  /** Bir sekmeye tıklayınca diğerleri kapanır ve iç seçimleri sıfırlanır. */
  function toggleTab(key: TabKey) {
    setOpenTab((prev) => (prev === key ? null : key));
    if (key === 'lessons' && openTab !== 'lessons' && modules === null) loadModules();
    // Dersler dalı
    setOpenLevel(null); setOpenLessonId(null); setOpenSubtopic(null);
    // Maç Yap dalı
    setOpenBot(false);
  }

  useEffect(() => { setAthleteName(getAthleteName()); }, []);

  // Düzeyler admin'deki Ders İçeriği'nden (DB) gelir — ekleme/ad değişikliği anında yansır
  const loadModules = useCallback(async () => {
    try {
      const list: ModuleSummary[] = await fetch(`${API_BASE}/modules`).then((r) => (r.ok ? r.json() : []));
      setModules(Array.isArray(list) ? list : []);
    } catch {
      setModules([]);
    }
  }, []);

  const loadLessons = useCallback(async (levelId: number) => {
    setLessonsByLevel((prev) => (prev[levelId] ? prev : { ...prev, [levelId]: [] }));
    try {
      const lessons: LessonSummary[] = await fetch(`${API_BASE}/modules/${levelId}/lessons`).then((r) => (r.ok ? r.json() : []));
      setLessonsByLevel((prev) => ({ ...prev, [levelId]: Array.isArray(lessons) ? lessons : [] }));
      // Madde 10: ders kilidi "onceki ders bitti mi" sorusuna dayanir; bu yuzden
      // bu duzeydeki TUM derslerin alt konu ve skor bilgisi onceden cekilir.
      if (Array.isArray(lessons)) {
        void Promise.all(lessons.map((l) => loadSubtopics(l.id)));
      }
    } catch {
      setLessonsByLevel((prev) => ({ ...prev, [levelId]: [] }));
    }
    // loadSubtopics kasten bagimlilikta degil: [] ile olusturuldugu icin
    // kimligi hic degismez, eklemek sonsuz yeniden olusturma riski yaratir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubtopics = useCallback(async (lessonId: number) => {
    setSubtopicsByLesson((prev) => (prev[lessonId] ? prev : { ...prev, [lessonId]: [] }));
    try {
      const detail = await fetch(`${API_BASE}/lessons/${lessonId}`).then((r) => (r.ok ? r.json() : { steps: [] }));
      const subs: Subtopic[] = (detail.steps ?? [])
        .filter((s: { type: string; content_json?: { title?: string } }) => s.type === 'explanation' && s.content_json?.title)
        .map((s: { id: number; content_json: { title: string } }) => ({ stepId: s.id, title: s.content_json.title }));
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: subs }));
      const scoreMap = await fetchLessonScores(lessonId);
      setScoresByLesson((prev) => ({ ...prev, [lessonId]: scoreMap }));
    } catch {
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: [] }));
    }
  }, []);

  // Not: Hiyerarşi durumu KASITLI olarak saklanmaz — kullanıcı her girişte
  // akışa baştan başlar (Düzey/Oyun türü → ... ) ve tıklayarak ilerler.
  // Eski oturumlardan kalan kayıt varsa temizlenir.
  useEffect(() => {
    try { sessionStorage.removeItem(QA_STATE_KEY); } catch { /* ignore */ }
  }, []);

  function toggleLevel(levelId: number) {
    const opening = openLevel !== levelId;
    setOpenLevel(opening ? levelId : null);
    setOpenLessonId(null);
    setOpenSubtopic(null);
    if (opening && !lessonsByLevel[levelId]) loadLessons(levelId);
  }

  function toggleLesson(lessonId: number) {
    const opening = openLessonId !== lessonId;
    setOpenLessonId(opening ? lessonId : null);
    setOpenSubtopic(null);
    if (opening && !subtopicsByLesson[lessonId]) loadSubtopics(lessonId);
  }

  function toggleSubtopic(lessonId: number, sub: Subtopic) {
    const opening = !(openSubtopic?.lessonId === lessonId && openSubtopic.stepId === sub.stepId);
    setOpenSubtopic(opening ? { lessonId, stepId: sub.stepId, title: sub.title } : null);
  }

  /* Sekme kartı — kabartma, açıkken gömük */
  function FeatureTab({ emoji, label, color, active, onClick, href }: {
    emoji: string; label: string; color: string; active?: boolean; onClick?: () => void; href?: string;
  }) {
    const style: React.CSSProperties = {
      ...(active ? pressed(16) : raised(16)),
      padding: '1rem 0.5rem',
      minHeight: 88,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.4rem',
      cursor: 'pointer',
      textDecoration: 'none',
    };
    const inner = (
      <>
        <span className="text-3xl leading-none">{emoji}</span>
        <span className="text-xs font-bold leading-tight text-center" style={{ color }}>{label}</span>
      </>
    );
    return href
      ? <Link href={href} style={style}>{inner}</Link>
      : <button onClick={onClick} style={style}>{inner}</button>;
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-8">
      {athleteName && (
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏅</span>
          <div>
            <p className="text-xs t-muted uppercase tracking-widest">Sporcu</p>
            <p className="text-2xl font-extrabold t-premium">{athleteName}</p>
          </div>
        </div>
      )}

      <section aria-label={L.sections.quickAccess}>
        <p className="text-sm font-bold t-premium uppercase tracking-widest mb-3">
          {L.sections.quickAccess}
        </p>

        {/* Sekmeler — admin sırasına göre; aynı anda yalnızca biri açık */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {orderedTabs.map((key) => {
            if (key === 'analiz') {
              return (
                <FeatureTab key={key} emoji="🔍" label={L.features.analiz}
                  color={FEATURE_COLORS.analiz} href="/analiz" />
              );
            }
            const meta = {
              play:    { emoji: '🎮', label: L.features.play,    color: FEATURE_COLORS.play },
              lessons: { emoji: '📚', label: L.features.lessons, color: FEATURE_COLORS.lessons },
              eglence: { emoji: '🎉', label: L.features.eglence, color: FEATURE_COLORS.eglence },
            }[key];
            return (
              <FeatureTab
                key={key} emoji={meta.emoji} label={meta.label} color={meta.color}
                active={openTab === key} onClick={() => toggleTab(key)}
              />
            );
          })}

          {/* Zafer hocanın eklediği ek sekmeler */}
          {customTabs.map((ct, i) => (
            <FeatureTab
              key={ct.id} emoji={ct.emoji} label={ct.label}
              color={CUSTOM_TAB_COLORS[i % CUSTOM_TAB_COLORS.length]} href={`/custom/${ct.id}`}
            />
          ))}
        </div>

        {/* Maç Yap patikası — Oyun türü › Zorluk › Tempo › Süre */}
        {showPlay && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }} className="mb-4">
            <p className="text-xs font-bold t-muted uppercase tracking-widest mb-4">
              {L.features.play} — Nasıl Oynayalım?
            </p>

            {/* Arkadaşla Oyna — kriter ekranıyla teklif akışına gider */}
            <Link href="/play?mode=friend" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
              <span className="flex items-center justify-center flex-shrink-0"
                style={{
                  ...raised(999, 4), width: 44, height: 44,
                  // Sayi bilinmiyorken varsayilan renk korunur (uydurma renk yok).
                  color: activeCount === null ? 'var(--t-text-1)' : activeColor(activeCount),
                }}>
                <IconFriends s={20} />
              </span>
              <span className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--t-text-1)' }}>
                Arkadaşla Oyna
                {activeCount !== null && <ActivePlayersBadge count={activeCount} />}
              </span>
            </Link>

            <div style={{ width: 2, height: 14, background: SH_LIGHT, marginLeft: 21, borderRadius: 9, opacity: 0.7 }} />

            {/* Bota Karşı — açılır seçim tablosu */}
            <button
              onClick={() => setOpenBot((v) => !v)}
              className="flex items-center gap-3 w-full text-left transition-transform active:scale-[0.98]"
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <span className="flex items-center justify-center flex-shrink-0"
                style={{ ...(openBot ? pressed(999, 3) : raised(999, 4)), width: 44, height: 44, color: 'var(--t-text-1)' }}>
                <IconBot s={20} />
              </span>
              <span className="font-bold text-sm" style={{ color: openBot ? 'var(--t-accent)' : 'var(--t-text-1)' }}>
                Bota Karşı Oyna
              </span>
            </button>

            {openBot && (
              /* Madde 5: bu ekran eskiden AYRI bir seçim tablosuydu (zorluk /
                 tempo / süre radyo satırları). Artık maç sayfasındaki
                 "Ayarları değiştir" ekranıyla AYNI bileşen kullanılıyor —
                 sporcu iki yerde farklı tasarım görmüyor. */
              <div className="mt-3">
                <MatchCriteria
                  startLabel="Maça Başla"
                  onStart={(v) => {
                    router.push(
                      `/play?mode=bot&skill=${v.level.level}`
                      + `&tc=${encodeURIComponent(v.timeControl.label)}`
                      + `&color=${v.colorChoice}`,
                    );
                  }}
                />
              </div>
            )}

            <div style={{ width: 2, height: 14, background: SH_LIGHT, marginLeft: 21, borderRadius: 9, opacity: 0.7 }} />

            {/* Turnuvaya Katıl */}
            <Link href="/play?mode=tournament" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
              <span className="flex items-center justify-center flex-shrink-0"
                style={{ ...raised(999, 4), width: 44, height: 44, color: 'var(--t-text-1)' }}>
                <IconTrophy s={20} />
              </span>
              <span className="font-bold text-sm" style={{ color: 'var(--t-text-1)' }}>Turnuvaya Katıl</span>
            </Link>
          </div>
        )}

        {/* Dikey Patika — Düzey › Ders › Alt Konu › Pratik */}
        {showLevels && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }} className="mb-4">
            <p className="text-xs font-bold t-muted uppercase tracking-widest mb-4">
              {L.sections.lessonsPick}
            </p>

            {modules === null && <p className="text-xs t-muted py-1">Düzeyler yükleniyor...</p>}
            {modules?.length === 0 && <p className="text-xs t-muted py-1">Henüz düzey eklenmemiş.</p>}

            {modules?.map((lv, li) => {
              const levelOpen = openLevel === lv.id;
              const lessons = lessonsByLevel[lv.id];
              return (
                <div key={lv.id}>
                  {li > 0 && (
                    <div style={{ width: 2, height: 14, background: SH_LIGHT, marginLeft: 21, borderRadius: 9, opacity: 0.7 }} />
                  )}
                  <PathNode
                    emoji={LEVEL_EMOJIS[li % LEVEL_EMOJIS.length]}
                    label={`${li + 1}. ${lv.name}`}
                    active={levelOpen}
                    size={44}
                    onClick={() => toggleLevel(lv.id)}
                  />

                  {levelOpen && (
                    <Branch offset={21}>
                      {lessons === undefined && <p className="text-xs t-muted py-1">Yükleniyor...</p>}
                      {lessons?.length === 0 && <p className="text-xs t-muted py-1">Bu düzeyde henüz ders yok.</p>}
                      {lessons?.map((les) => {
                        const lessonOpen = openLessonId === les.id;
                        /* Madde 10: onceki ders bitmediyse bu ders KILITLI. */
                        const lessonLocked = !isLessonUnlocked(
                          (lessons ?? []).map((l) => l.id),
                          les.id,
                          Object.fromEntries((lessons ?? []).map((l) => {
                            const st = (subtopicsByLesson[l.id] ?? []).map((x) => x.stepId);
                            const sc = scoresByLesson[l.id];
                            // null da "henuz bilinmiyor" demektir — kilit uygulanmaz.
                            return [l.id, sc == null ? undefined : isLessonCompleted(st, sc)];
                          })),
                        );
                        const subs = subtopicsByLesson[les.id];
                        const lessonScores = scoresByLesson[les.id];
                        const orderedStepIds = (subs ?? []).map((s) => s.stepId);
                        /** Kilit YALNIZCA skor haritası gerçekten alındıysa uygulanır. */
                        const subLocked = (stepId: number) =>
                          lessonScores != null && !isSubtopicUnlocked(orderedStepIds, stepId, lessonScores);
                        const modeLocked = (stepId: number, slug: string) =>
                          lessonScores != null &&
                          !isModeUnlocked(orderedStepIds, stepId, slug as PracticeMode, lessonScores);
                        return (
                          <div key={les.id}>
                            <PathNode
                              emoji="📘"
                              label={lessonLocked ? `🔒 ${les.title}` : les.title}
                              active={lessonOpen}
                              size={36}
                              onClick={() => { if (!lessonLocked) toggleLesson(les.id); }}
                            />
                            {lessonLocked && (
                              <p className="text-xs t-muted py-1">
                                Bir önceki dersi tamamlaman gerekiyor.
                              </p>
                            )}

                            {lessonOpen && (
                              <Branch offset={17}>
                                {subs === undefined && <p className="text-xs t-muted py-1">Yükleniyor...</p>}
                                {subs?.length === 0 && <p className="text-xs t-muted py-1">Alt konu bulunamadı.</p>}
                                {subs?.map((sub, si) => {
                                  const subOpen = openSubtopic?.lessonId === les.id && openSubtopic.stepId === sub.stepId;
                                  return (
                                    <div key={sub.stepId}>
                                      <PathNode
                                        emoji={SUBTOPIC_EMOJIS[si % SUBTOPIC_EMOJIS.length]}
                                        label={subLocked(sub.stepId) ? `🔒 ${sub.title}` : sub.title}
                                        active={subOpen}
                                        size={32}
                                        onClick={() => toggleSubtopic(les.id, sub)}
                                      />

                                      {subOpen && (
                                        <div style={{ marginLeft: 15, paddingLeft: 17, borderLeft: `2px dashed ${SH_LIGHT}`, marginTop: 10 }}>
                                          <div className="grid grid-cols-2 gap-3">
                                            {PRACTICE_MODES.map((m, idx) => {
                                              const isLocked = modeLocked(sub.stepId, m.slug);
                                              const boxStyle = {
                                                ...raised(14),
                                                padding: '0.85rem 0.5rem',
                                                display: 'flex',
                                                flexDirection: 'column' as const,
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                textDecoration: 'none',
                                                gridColumn: idx === PRACTICE_MODES.length - 1 ? '1 / -1' : undefined,
                                                opacity: isLocked ? 0.45 : 1,
                                              };
                                              const inner = (
                                                <>
                                                  <span className="text-2xl leading-none">
                                                    {isLocked ? '🔒' : m.emoji}
                                                  </span>
                                                  <span className="text-[0.68rem] font-bold text-center leading-tight"
                                                    style={{ color: m.color }}>
                                                    {m.label}
                                                  </span>
                                                </>
                                              );
                                              // Kilitliyken Link YOK — tıklama tamamen devre dışı.
                                              return isLocked ? (
                                                <div key={m.slug} style={boxStyle} aria-disabled="true">{inner}</div>
                                              ) : (
                                                <Link
                                                  key={m.slug}
                                                  href={`/pratik/${m.slug}?konu=${encodeURIComponent(sub.title)}&step=${sub.stepId}&ders=${les.id}`}
                                                  style={boxStyle}
                                                >
                                                  {inner}
                                                </Link>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </Branch>
                            )}
                          </div>
                        );
                      })}
                    </Branch>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Eğlence — aynı patika dili */}
        {showEglence && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }}>
            <p className="text-xs font-bold t-muted uppercase tracking-widest mb-4">
              {L.features.eglence}
            </p>
            <div className="grid gap-3">
              {EGLENCE_GAMES.map((g) => (
                <Link key={g.slug} href={`/eglence/${g.slug}`} className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ ...raised(999, 4), width: 40, height: 40, fontSize: 18 }}
                  >
                    {g.emoji}
                  </span>
                  <span className="font-bold text-sm" style={{ color: 'var(--t-text-1)' }}>{g.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

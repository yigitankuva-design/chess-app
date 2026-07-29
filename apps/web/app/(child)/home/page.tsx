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
import { HOME_BOT_LEVELS as BOT_LEVELS, HOME_TEMPO_GROUPS as TIME_GROUPS } from './botShortcut';
import { usePresenceCount } from '@/lib/presence/PresenceContext';
import { ActivePlayersBadge, activeColor } from '@/components/play/ActivePlayersBadge';

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
const IconBolt = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}><path d="M13 2.5 4.8 13.6H11l-1 7.9 9.2-11.8H13z" /></svg>
);
const IconGauge = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <path d="M4 18.5a8.5 8.5 0 1 1 16 0" />
    <path d="M12 18.5 16.4 13" />
    <circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);
const IconClock = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}><circle cx="12" cy="12" r="8.6" /><path d="M12 7.2V12l3.2 2.1" /></svg>
);
const IconInfinity = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <path d="M7 15.6c-2 0-3.6-1.6-3.6-3.6S5 8.4 7 8.4c3.1 0 4 7.2 8 7.2 2 0 3.6-1.6 3.6-3.6S17 8.4 15 8.4c-3.1 0-4 7.2-8 7.2z" />
  </svg>
);
const IconPlay = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}><path d="M7.5 4.8 19 12 7.5 19.2z" /></svg>
);
const IconBook = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <path d="M4 5.2a1.6 1.6 0 0 1 1.6-1.6H10a2.4 2.4 0 0 1 2 1.1 2.4 2.4 0 0 1 2-1.1h4.4A1.6 1.6 0 0 1 20 5.2v12a1.6 1.6 0 0 1-1.6 1.6H14a2.4 2.4 0 0 0-2 1.1 2.4 2.4 0 0 0-2-1.1H5.6A1.6 1.6 0 0 1 4 17.2z" />
    <path d="M12 4.7v15.2" />
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
const TEMPO_ROW_H = 48;

const TEMPO_ICONS: Record<string, ({ s }: { s?: number }) => React.JSX.Element> = {
  'Yıldırım': IconBolt, 'Hızlı': IconGauge, 'Klasik': IconClock, 'Süresiz': IconInfinity,
};

/* Zorluk göstergesi — dolu çubuk sayısı seviyeyi anlatır */
function LevelBars({ n, s = 18 }: { n: number; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={0.8 + (i - 1) * 3.9} y={16.5 - i * 2.7} width="2.6" height={i * 2.7} rx="1.2"
          fill="currentColor" opacity={i <= n ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}

/* Dairesel seçim (radio) düğmesi */
function Radio({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <span
      className="flex items-center justify-center flex-shrink-0"
      style={{ ...(on ? pressed(999, 2) : raised(999, 2)), width: size, height: size }}
    >
      {on && <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: 999, background: 'var(--t-accent)' }} />}
    </span>
  );
}

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
  const [openBot, setOpenBot] = useState(false);
  const [openSkill, setOpenSkill] = useState<number | null>(null);
  const [openTempo, setOpenTempo] = useState<string | null>(null);
  const [selTime, setSelTime] = useState<string | null>(null);

  const L = settings.labels;
  const orderedTabs = visibleTabsInOrder(settings);

  /** Bir sekmeye tıklayınca diğerleri kapanır ve iç seçimleri sıfırlanır. */
  function toggleTab(key: TabKey) {
    setOpenTab((prev) => (prev === key ? null : key));
    if (key === 'lessons' && openTab !== 'lessons' && modules === null) loadModules();
    // Dersler dalı
    setOpenLevel(null); setOpenLessonId(null); setOpenSubtopic(null);
    // Maç Yap dalı
    setOpenBot(false); setOpenSkill(null); setOpenTempo(null); setSelTime(null);
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
          {(settings.customTabs ?? []).map((ct, i) => (
            <FeatureTab
              key={ct.id} emoji={ct.emoji} label={ct.label}
              color={CUSTOM_TAB_COLORS[i % CUSTOM_TAB_COLORS.length]} href={ct.href}
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
              onClick={() => { setOpenBot((v) => !v); setOpenSkill(null); setOpenTempo(null); setSelTime(null); }}
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

            {openBot && (() => {
              const bot = BOT_LEVELS.find((b) => b.skill === openSkill) ?? null;
              const tempo = TIME_GROUPS.find((t) => t.cat === openTempo) ?? null;
              const ready = !!bot && !!tempo && !!selTime;
              const href = ready
                ? `/play?skill=${bot!.skill}&depth=${bot!.depth}&tc=${encodeURIComponent(selTime!)}`
                : '#';

              return (
                <div style={{ ...raised(16), padding: '0.9rem 0.75rem', marginTop: 12 }}>
                  {/* Dar ekranda alt alta, geniş ekranda yan yana (dikey çizgiyle) */}
                  <div className="flex flex-col sm:flex-row sm:items-stretch" style={{ gap: 18 }}>
                    {/* ── 1. ZORLUK ── */}
                    <div className="flex-shrink-0">
                      <p className="text-[0.75rem] font-extrabold t-muted uppercase tracking-widest mb-2.5">1 · Zorluk</p>
                      <div className="grid gap-2.5">
                        {BOT_LEVELS.map((bl) => {
                          const on = openSkill === bl.skill;
                          return (
                            <button
                              key={bl.skill}
                              onClick={() => { setOpenSkill(on ? null : bl.skill); setOpenTempo(null); setSelTime(null); }}
                              className="flex items-center gap-2.5 transition-transform active:scale-[0.98]"
                              style={{ ...(on ? pressed(12) : raised(12)), padding: '0.6rem 0.75rem', cursor: 'pointer' }}
                            >
                              <Radio on={on} size={18} />
                              <span style={{ color: on ? 'var(--t-accent)' : 'var(--t-text-2)', display: 'flex' }}>
                                <LevelBars n={bl.bars} s={21} />
                              </span>
                              <span className="font-bold whitespace-nowrap"
                                style={{ fontSize: '0.85rem', color: on ? 'var(--t-accent)' : 'var(--t-text-1)' }}>
                                {bl.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ayırma çizgisi — geniş ekranda dikey, dar ekranda yatay */}
                    <div
                      className="w-full h-0.5 sm:w-0.5 sm:h-auto"
                      style={{ background: SH_LIGHT, borderRadius: 9, flexShrink: 0, opacity: 0.85 }}
                    />

                    {/* ── 2. TEMPO ── */}
                    <div className="flex-shrink-0" style={{ opacity: openSkill === null ? 0.4 : 1, pointerEvents: openSkill === null ? 'none' : 'auto' }}>
                      <p className="text-[0.75rem] font-extrabold t-muted uppercase tracking-widest mb-2.5">2 · Tempo</p>
                      <div className="grid gap-2.5">
                        {TIME_GROUPS.map((tg) => {
                          const on = openTempo === tg.cat;
                          const Icon = TEMPO_ICONS[tg.cat];
                          return (
                            <button
                              key={tg.cat}
                              onClick={() => { setOpenTempo(on ? null : tg.cat); setSelTime(null); }}
                              className="flex items-center gap-2.5 transition-transform active:scale-[0.98]"
                              style={{ ...(on ? pressed(12) : raised(12)), padding: '0 0.75rem', height: TEMPO_ROW_H, cursor: 'pointer', minWidth: 122 }}
                            >
                              <Radio on={on} size={17} />
                              <span style={{ color: on ? tg.color : 'var(--t-text-2)', display: 'flex' }}><Icon s={20} /></span>
                              <span className="font-bold whitespace-nowrap"
                                style={{ fontSize: '0.825rem', color: on ? tg.color : 'var(--t-text-1)' }}>
                                {tg.cat}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tempo ile Süre arasındaki ayırma çizgisi */}
                    <div
                      className="w-full h-0.5 sm:w-0.5 sm:h-auto"
                      style={{
                        background: SH_LIGHT, borderRadius: 9, flexShrink: 0,
                        opacity: openSkill === null ? 0.35 : 0.85,
                      }}
                    />

                    {/* ── 3. SÜRE ── */}
                    <div className="flex-shrink-0" style={{ opacity: openSkill === null ? 0.4 : 1, pointerEvents: openSkill === null ? 'none' : 'auto' }}>
                      <p className="text-[0.75rem] font-extrabold t-muted uppercase tracking-widest mb-2.5">3 · Süre</p>
                      <div className="grid gap-2.5">
                        {TIME_GROUPS.map((tg) => {
                          const on = openTempo === tg.cat;
                          return (
                            <div
                              key={tg.cat}
                              className="flex items-center gap-2"
                              style={{ height: TEMPO_ROW_H, opacity: on ? 1 : 0.35, pointerEvents: on ? 'auto' : 'none' }}
                            >
                              {tg.items.map((t) => {
                                const tOn = on && selTime === t;
                                return (
                                  <button
                                    key={t}
                                    onClick={() => setSelTime(tOn ? null : t)}
                                    className="flex items-center justify-center transition-transform active:scale-95"
                                    style={{
                                      ...(tOn ? pressed(999, 3) : raised(999, 3)),
                                      width: 44, height: 44, cursor: 'pointer', flexShrink: 0,
                                    }}
                                  >
                                    <span className="font-extrabold"
                                      style={{ fontSize: '0.7rem', color: tOn ? tg.color : 'var(--t-text-1)' }}>
                                      {t}
                                    </span>
                                  </button>
                                );
                              })}
                              {tg.items.length === 0 && (
                                <span className="text-[0.725rem] t-muted whitespace-nowrap">saat yok</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Maça başla */}
                  <div className="mt-4">
                    {ready ? (
                      <Link
                        href={href}
                        className="flex items-center justify-center gap-2.5"
                        style={{ ...raised(14), padding: '0.85rem', textDecoration: 'none', color: 'var(--t-accent)' }}
                      >
                        <IconPlay s={21} />
                        <span className="font-extrabold" style={{ fontSize: '1.09rem' }}>Maça Başla</span>
                      </Link>
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{ ...pressed(14), padding: '0.85rem', opacity: 0.65 }}
                      >
                        <span className="font-bold t-muted" style={{ fontSize: '0.94rem' }}>
                          {!bot ? 'Önce zorluk seç' : !tempo ? 'Şimdi tempo seç' : 'Şimdi süre seç'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div style={{ width: 2, height: 14, background: SH_LIGHT, marginLeft: 21, borderRadius: 9, opacity: 0.7 }} />

            {/* Açılış Pratiği Yap — açılış seçimi /play tarafında yapılır */}
            <Link href="/play?mode=opening" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
              <span className="flex items-center justify-center flex-shrink-0"
                style={{ ...raised(999, 4), width: 44, height: 44, color: 'var(--t-text-1)' }}>
                <IconBook s={20} />
              </span>
              <span className="font-bold text-sm" style={{ color: 'var(--t-text-1)' }}>Açılış Pratiği Yap</span>
            </Link>

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

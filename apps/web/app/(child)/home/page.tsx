'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getAthleteName } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const LEVEL_META = [
  { id: 1, emoji: '🌱' },
  { id: 2, emoji: '😊' },
  { id: 3, emoji: '😎' },
  { id: 4, emoji: '🔥' },
];

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

/* Maç Yap hiyerarşisi — /play sayfasındaki gerçek seçeneklerle birebir */
const BOT_LEVELS = [
  { label: 'Çok Kolay', skill: 0,  depth: 1,  bars: 1 },
  { label: 'Kolay',     skill: 3,  depth: 4,  bars: 2 },
  { label: 'Orta',      skill: 8,  depth: 8,  bars: 3 },
  { label: 'Zor',       skill: 14, depth: 10, bars: 4 },
  { label: 'Çok Zor',   skill: 20, depth: 12, bars: 5 },
];

const TIME_GROUPS = [
  { cat: 'Yıldırım', color: '#fbbf24', items: ['3+2', '5+0', '5+3'] },
  { cat: 'Hızlı',    color: '#38bdf8', items: ['10+0', '10+5', '15+10'] },
  { cat: 'Klasik',   color: '#2dd4bf', items: ['30+0', '30+10', '30+20'] },
  { cat: 'Süresiz',  color: '#a78bfa', items: [] as string[] },
];

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
  const [showLevels, setShowLevels] = useState(false);
  const [showEglence, setShowEglence] = useState(false);
  const [athleteName, setAthleteName] = useState<string | null>(null);

  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [lessonsByLevel, setLessonsByLevel] = useState<Record<number, LessonSummary[]>>({});
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [subtopicsByLesson, setSubtopicsByLesson] = useState<Record<number, Subtopic[]>>({});
  const [openSubtopic, setOpenSubtopic] = useState<{ lessonId: number; stepId: number; title: string } | null>(null);

  // Maç Yap: Oyun türü → Zorluk → Tempo → Süre
  const [showPlay, setShowPlay] = useState(false);
  const [openBot, setOpenBot] = useState(false);
  const [openSkill, setOpenSkill] = useState<number | null>(null);
  const [openTempo, setOpenTempo] = useState<string | null>(null);
  const [selTime, setSelTime] = useState<string | null>(null);

  const L = settings.labels;

  useEffect(() => { setAthleteName(getAthleteName()); }, []);

  const loadLessons = useCallback(async (levelId: number) => {
    setLessonsByLevel((prev) => (prev[levelId] ? prev : { ...prev, [levelId]: [] }));
    try {
      const lessons: LessonSummary[] = await fetch(`${API_BASE}/modules/${levelId}/lessons`).then((r) => (r.ok ? r.json() : []));
      setLessonsByLevel((prev) => ({ ...prev, [levelId]: Array.isArray(lessons) ? lessons : [] }));
    } catch {
      setLessonsByLevel((prev) => ({ ...prev, [levelId]: [] }));
    }
  }, []);

  const loadSubtopics = useCallback(async (lessonId: number) => {
    setSubtopicsByLesson((prev) => (prev[lessonId] ? prev : { ...prev, [lessonId]: [] }));
    try {
      const detail = await fetch(`${API_BASE}/lessons/${lessonId}`).then((r) => (r.ok ? r.json() : { steps: [] }));
      const subs: Subtopic[] = (detail.steps ?? [])
        .filter((s: { type: string; content_json?: { title?: string } }) => s.type === 'explanation' && s.content_json?.title)
        .map((s: { id: number; content_json: { title: string } }) => ({ stepId: s.id, title: s.content_json.title }));
      setSubtopicsByLesson((prev) => ({ ...prev, [lessonId]: subs }));
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

        {/* Sekmeler */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {settings.tabs.play && (
            <FeatureTab
              emoji="🎮" label={L.features.play} color={FEATURE_COLORS.play}
              active={showPlay} onClick={() => setShowPlay((v) => !v)}
            />
          )}
          <FeatureTab
            emoji="📚" label={L.features.lessons} color={FEATURE_COLORS.lessons}
            active={showLevels} onClick={() => setShowLevels((v) => !v)}
          />
        </div>

        {/* Maç Yap patikası — Oyun türü › Zorluk › Tempo › Süre */}
        {settings.tabs.play && showPlay && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }} className="mb-4">
            <p className="text-xs font-bold t-muted uppercase tracking-widest mb-4">
              {L.features.play} — Nasıl Oynayalım?
            </p>

            {/* Arkadaşla Oyna — doğrudan gider */}
            <Link href="/play/online" className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
              <span className="flex items-center justify-center flex-shrink-0"
                style={{ ...raised(999, 4), width: 44, height: 44, color: 'var(--t-text-1)' }}>
                <IconFriends s={20} />
              </span>
              <span className="font-bold text-sm" style={{ color: 'var(--t-text-1)' }}>Arkadaşla Oyna</span>
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
              const unlimited = tempo?.items.length === 0;
              const ready = !!bot && !!tempo && (unlimited || !!selTime);
              const href = ready
                ? `/play?skill=${bot!.skill}&depth=${bot!.depth}&tc=${unlimited ? 'suresiz' : encodeURIComponent(selTime!)}`
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

                    {/* ── 2. TEMPO + 3. SÜRE ── */}
                    <div className="flex-shrink-0" style={{ opacity: openSkill === null ? 0.4 : 1, pointerEvents: openSkill === null ? 'none' : 'auto' }}>
                      <p className="text-[0.75rem] font-extrabold t-muted uppercase tracking-widest mb-2.5">2 · Tempo &nbsp;·&nbsp; 3 · Süre</p>
                      <div className="grid gap-2.5">
                        {TIME_GROUPS.map((tg) => {
                          const on = openTempo === tg.cat;
                          const Icon = TEMPO_ICONS[tg.cat];
                          return (
                            <div key={tg.cat} className="flex items-center" style={{ gap: 14 }}>
                              <button
                                onClick={() => { setOpenTempo(on ? null : tg.cat); setSelTime(null); }}
                                className="flex items-center gap-2.5 transition-transform active:scale-[0.98]"
                                style={{ ...(on ? pressed(12) : raised(12)), padding: '0.6rem 0.75rem', cursor: 'pointer', minWidth: 122 }}
                              >
                                <Radio on={on} size={17} />
                                <span style={{ color: on ? tg.color : 'var(--t-text-2)', display: 'flex' }}><Icon s={20} /></span>
                                <span className="font-bold whitespace-nowrap"
                                  style={{ fontSize: '0.825rem', color: on ? tg.color : 'var(--t-text-1)' }}>
                                  {tg.cat}
                                </span>
                              </button>

                              {/* Süreler — dairesel kartlar */}
                              <div className="flex items-center gap-2" style={{ opacity: on ? 1 : 0.35, pointerEvents: on ? 'auto' : 'none' }}>
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
          </div>
        )}

        {/* Dikey Patika — Düzey › Ders › Alt Konu › Pratik */}
        {showLevels && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }} className="mb-4">
            <p className="text-xs font-bold t-muted uppercase tracking-widest mb-4">
              {L.sections.lessonsPick}
            </p>

            {LEVEL_META.map((lv, li) => {
              const levelOpen = openLevel === lv.id;
              const lessons = lessonsByLevel[lv.id];
              return (
                <div key={lv.id}>
                  {li > 0 && (
                    <div style={{ width: 2, height: 14, background: SH_LIGHT, marginLeft: 21, borderRadius: 9, opacity: 0.7 }} />
                  )}
                  <PathNode
                    emoji={lv.emoji}
                    label={`${lv.id}. ${L.levels[String(lv.id)] ?? ''}`}
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
                        const subs = subtopicsByLesson[les.id];
                        return (
                          <div key={les.id}>
                            <PathNode
                              emoji="📘"
                              label={les.title}
                              active={lessonOpen}
                              size={36}
                              onClick={() => toggleLesson(les.id)}
                            />

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
                                        label={sub.title}
                                        active={subOpen}
                                        size={32}
                                        onClick={() => toggleSubtopic(les.id, sub)}
                                      />

                                      {subOpen && (
                                        <div style={{ marginLeft: 15, paddingLeft: 17, borderLeft: `2px dashed ${SH_LIGHT}`, marginTop: 10 }}>
                                          <div className="grid grid-cols-2 gap-3">
                                            {PRACTICE_MODES.map((m, idx) => (
                                              <Link
                                                key={m.slug}
                                                href={`/pratik/${m.slug}?konu=${encodeURIComponent(sub.title)}&step=${sub.stepId}`}
                                                style={{
                                                  ...raised(14),
                                                  padding: '0.85rem 0.5rem',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  alignItems: 'center',
                                                  gap: '0.35rem',
                                                  textDecoration: 'none',
                                                  gridColumn: idx === PRACTICE_MODES.length - 1 ? '1 / -1' : undefined,
                                                }}
                                              >
                                                <span className="text-2xl leading-none">{m.emoji}</span>
                                                <span className="text-[0.68rem] font-bold text-center leading-tight" style={{ color: m.color }}>
                                                  {m.label}
                                                </span>
                                              </Link>
                                            ))}
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

        {/* Analiz Et + Eğlence */}
        {(settings.tabs.analiz || settings.tabs.eglence) && (
          <div className="grid grid-cols-2 gap-4">
            {settings.tabs.analiz && (
              <FeatureTab emoji="🔍" label={L.features.analiz} color={FEATURE_COLORS.analiz} href="/analiz" />
            )}
            {settings.tabs.eglence && (
              <FeatureTab
                emoji="🎉" label={L.features.eglence} color={FEATURE_COLORS.eglence}
                active={showEglence} onClick={() => setShowEglence((v) => !v)}
              />
            )}
          </div>
        )}

        {/* Eğlence — aynı patika dili */}
        {settings.tabs.eglence && showEglence && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }} className="mt-4">
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

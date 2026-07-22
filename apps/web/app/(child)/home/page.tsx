'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  { label: 'Çok Kolay', skill: 0,  depth: 1,  emoji: '🐣' },
  { label: 'Kolay',     skill: 3,  depth: 4,  emoji: '🙂' },
  { label: 'Orta',      skill: 8,  depth: 8,  emoji: '😎' },
  { label: 'Zor',       skill: 14, depth: 10, emoji: '🔥' },
  { label: 'Çok Zor',   skill: 20, depth: 12, emoji: '👑' },
];

const TIME_GROUPS = [
  { cat: 'Yıldırım', emoji: '⚡', color: '#fbbf24', items: ['3+2', '5+0', '5+3'] },
  { cat: 'Hızlı',    emoji: '🚀', color: '#38bdf8', items: ['10+0', '10+5', '15+10'] },
  { cat: 'Klasik',   emoji: '🐢', color: '#2dd4bf', items: ['30+0', '30+10', '30+20'] },
  { cat: 'Süresiz',  emoji: '♾️', color: '#a78bfa', items: [] as string[] },
];

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

  const L = settings.labels;
  const restored = useRef(false);

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

  // Geri dönünce açık kaldığı yere dön
  useEffect(() => {
    try {
      const st = JSON.parse(sessionStorage.getItem(QA_STATE_KEY) || '{}');
      if (st.showLevels) setShowLevels(true);
      if (st.showEglence) setShowEglence(true);
      if (st.openLevel) { setOpenLevel(st.openLevel); loadLessons(st.openLevel); }
      if (st.openLessonId) { setOpenLessonId(st.openLessonId); loadSubtopics(st.openLessonId); }
      if (st.openSubtopic) setOpenSubtopic(st.openSubtopic);
      if (st.showPlay) setShowPlay(true);
      if (st.openBot) setOpenBot(true);
      if (typeof st.openSkill === 'number') setOpenSkill(st.openSkill);
      if (st.openTempo) setOpenTempo(st.openTempo);
    } catch { /* ignore */ }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(QA_STATE_KEY, JSON.stringify({
        showLevels, showEglence, openLevel, openLessonId, openSubtopic,
        showPlay, openBot, openSkill, openTempo,
      }));
    } catch { /* ignore */ }
  }, [showLevels, showEglence, openLevel, openLessonId, openSubtopic, showPlay, openBot, openSkill, openTempo]);

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
                style={{ ...raised(999, 4), width: 44, height: 44, fontSize: 19 }}>🤝</span>
              <span className="font-bold text-sm" style={{ color: 'var(--t-text-1)' }}>Arkadaşla Oyna</span>
            </Link>

            <div style={{ width: 2, height: 14, background: SH_LIGHT, marginLeft: 21, borderRadius: 9, opacity: 0.7 }} />

            {/* Bota Karşı — açılır */}
            <PathNode
              emoji="🤖" label="Bota Karşı Oyna" active={openBot} size={44}
              onClick={() => { setOpenBot((v) => !v); setOpenSkill(null); setOpenTempo(null); }}
            />

            {openBot && (
              <Branch offset={21}>
                {BOT_LEVELS.map((bl) => {
                  const skillOpen = openSkill === bl.skill;
                  return (
                    <div key={bl.skill}>
                      <PathNode
                        emoji={bl.emoji} label={bl.label} active={skillOpen} size={36}
                        onClick={() => { setOpenSkill(skillOpen ? null : bl.skill); setOpenTempo(null); }}
                      />

                      {skillOpen && (
                        <Branch offset={17}>
                          {TIME_GROUPS.map((tg) => {
                            const tempoOpen = openTempo === tg.cat;
                            const isUnlimited = tg.items.length === 0;
                            // Süresiz'in alt seçeneği yok — doğrudan oyunu başlatır
                            if (isUnlimited) {
                              return (
                                <Link
                                  key={tg.cat}
                                  href={`/play?skill=${bl.skill}&depth=${bl.depth}&tc=suresiz`}
                                  className="flex items-center gap-3"
                                  style={{ textDecoration: 'none' }}
                                >
                                  <span className="flex items-center justify-center flex-shrink-0"
                                    style={{ ...raised(999, 4), width: 32, height: 32, fontSize: 14 }}>{tg.emoji}</span>
                                  <span className="font-bold" style={{ fontSize: '0.75rem', color: tg.color }}>
                                    {tg.cat}
                                  </span>
                                </Link>
                              );
                            }
                            return (
                              <div key={tg.cat}>
                                <PathNode
                                  emoji={tg.emoji} label={tg.cat} active={tempoOpen} size={32}
                                  labelColor={tg.color}
                                  onClick={() => setOpenTempo(tempoOpen ? null : tg.cat)}
                                />

                                {tempoOpen && (
                                  <div style={{ marginLeft: 15, paddingLeft: 17, borderLeft: `2px dashed ${SH_LIGHT}`, marginTop: 10 }}>
                                    <div className="grid grid-cols-3 gap-2.5">
                                      {tg.items.map((t) => (
                                        <Link
                                          key={t}
                                          href={`/play?skill=${bl.skill}&depth=${bl.depth}&tc=${encodeURIComponent(t)}`}
                                          style={{
                                            ...raised(12),
                                            padding: '0.7rem 0.3rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            textDecoration: 'none',
                                          }}
                                        >
                                          <span className="font-bold" style={{ fontSize: '0.78rem', color: tg.color }}>{t}</span>
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

'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getAthleteName } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';
import { visibleTabsInOrder } from '@/lib/settings/defaults';
import type { TabKey } from '@/lib/settings/defaults';
import {
  isModeUnlocked, isSubtopicUnlocked, isLessonCompleted, isLessonUnlocked, PRACTICE_MODE_FIELDS,
} from '@/lib/practice/unlock';
import type { PracticeMode, ScoreMap, ThresholdMap } from '@/lib/practice/unlock';
import { fetchLessonScores } from '@/lib/practice/practiceApi';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import { useRouter } from 'next/navigation';
import { usePresenceCount } from '@/lib/presence/PresenceContext';
import { ActivePlayersBadge, activeColor } from '@/components/play/ActivePlayersBadge';
import { listCustomTabs, getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabSummary, CustomTabDetail } from '@/lib/customTabsApi';
import { CustomTabPanel } from '@/components/custom/CustomTabPanel';
import { raised, pressed, PathNode, Branch, SH_LIGHT, VerticalDivider } from '@/components/ui/neumorphic';

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

/* Hızlı Erişim sekme ikonları — kullanıcının 2026-08-19 tarif ettiği
   şekiller (çapraz kılıç, kitap, büyüteçli adam, yapboz parçası,
   satranç oynayan adam). Emoji değil — mevcut çizgi-ikon üslubunda. */
const IconSwords = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <line x1="4" y1="20" x2="20" y2="4" />
    <line x1="20" y1="20" x2="4" y2="4" />
    <path d="M3 21l2-2M21 21l-2-2M3 3l2 2M21 3l-2 2" />
  </svg>
);
const IconBook = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11a1 1 0 0 1 1 1v15a1 1 0 0 0-1-1H5.5A1.5 1.5 0 0 1 4 17.5z" />
    <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13a1 1 0 0 0-1 1v15a1 1 0 0 1 1-1h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
  </svg>
);
const IconAnalyst = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <circle cx="8.5" cy="5" r="2.2" />
    <path d="M8.5 7.2c-2.2 0-4 1.6-4 4.3V17h4.5" />
    <circle cx="16" cy="14" r="3.2" />
    <path d="M18.3 16.3L21 19" />
  </svg>
);
const IconPuzzle = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <path d="M5 4h4.5a1.5 1.5 0 0 1 3 0H17a1 1 0 0 1 1 1v4.5a1.5 1.5 0 0 0 0 3V17a1 1 0 0 1-1 1h-4.5a1.5 1.5 0 0 0-3 0H5a1 1 0 0 1-1-1v-4.5a1.5 1.5 0 0 0 0-3V5a1 1 0 0 1 1-1z" />
  </svg>
);
const IconChessPlayer = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <circle cx="7.5" cy="5" r="2.2" />
    <path d="M7.5 7.2c-2.2 0-4 1.6-4 4.3V17h5.5" />
    <path d="M3 20h18" />
    <path d="M15 20v-3.3c0-.8.5-1.2 1.1-1.6.6-.3.9-.7.9-1.3 0-.8-.7-1.4-1.5-1.4S14 12.9 14 13.7" />
    <path d="M13.2 16.7h3.6" />
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

/* Yumuşak kabartma yüzeyler artık components/ui/neumorphic.tsx'te — Pratik
   Yap ekranı da (CustomTabPanel, OpeningPractice) aynı tasarımı kullanıyor
   (2026-08-19). */

export default function ChildHomePage() {
  const { settings } = useSettings();
  const activeCount = usePresenceCount();
  // Tek seferde yalnızca bir sekme açık (akordiyon)
  // Sayı değer = Zafer hocanın eklediği özel sekmenin id'si — yerleşik
  // sekmelerle AYNI akordiyona girer (aynı anda tek sekme açık).
  const [openTab, setOpenTab] = useState<TabKey | number | null>(null);
  const showLevels = openTab === 'lessons';
  const showEglence = openTab === 'eglence';
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [customTabs, setCustomTabs] = useState<CustomTabSummary[]>([]);
  /** Açılan özel sekmenin alt sekmeleri — açılınca yüklenir, tekrar açılınca
   *  yeniden istek atılmaz. */
  const [customTabDetails, setCustomTabDetails] = useState<Record<number, CustomTabDetail>>({});
  useEffect(() => { listCustomTabs().then(setCustomTabs); }, []);

  const [modules, setModules] = useState<ModuleSummary[] | null>(null);
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [lessonsByLevel, setLessonsByLevel] = useState<Record<number, LessonSummary[]>>({});
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [subtopicsByLesson, setSubtopicsByLesson] = useState<Record<number, Subtopic[]>>({});
  /** lessonId → skor haritası. null değer = kilit uygulanmaz (token yok). */
  const [scoresByLesson, setScoresByLesson] = useState<Record<number, ScoreMap | null>>({});
  /** lessonId → hoca'nın alt konu + mod başına girdiği başarı puanları. */
  const [thresholdsByLesson, setThresholdsByLesson] = useState<Record<number, ThresholdMap>>({});
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

  /** Özel sekme kutucuğu — yerleşik sekmelerle aynı akordiyon kuralına girer. */
  function toggleCustomTab(id: number) {
    setOpenTab((prev) => (prev === id ? null : id));
    setOpenLevel(null); setOpenLessonId(null); setOpenSubtopic(null);
    setOpenBot(false);
    if (!customTabDetails[id]) {
      getCustomTab(id).then((detail) => {
        if (detail) setCustomTabDetails((prev) => ({ ...prev, [id]: detail }));
      });
    }
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
      // Hoca'nın alt konu + mod başına girdiği başarı puanları — girilmeyen
      // mod isModeUnlocked/isSubtopicUnlocked/isLessonCompleted içinde eskisi
      // gibi UNLOCK_THRESHOLD (85) kullanır.
      const thresholds: ThresholdMap = {};
      for (const s of (detail.steps ?? []) as { id: number; content_json?: { success_scores?: Record<string, number> } }[]) {
        const raw = s.content_json?.success_scores;
        if (!raw) continue;
        const entry: Partial<Record<PracticeMode, number>> = {};
        for (const key of Object.keys(PRACTICE_MODE_FIELDS) as PracticeMode[]) {
          const field = PRACTICE_MODE_FIELDS[key];
          if (typeof raw[field] === 'number') entry[key] = raw[field];
        }
        if (Object.keys(entry).length > 0) thresholds[s.id] = entry;
      }
      setThresholdsByLesson((prev) => ({ ...prev, [lessonId]: thresholds }));
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

  /* Sekme kartı — kabartma, açıkken gömük. Arkasında seçiliyken turkuaz
     yanan bir LED var (madde 2, 2026-08-19): sadece seçili sekmenin LED'i
     yanık kalır, diğerleri söner. */
  function FeatureTab({ icon, label, color, active, onClick, href }: {
    icon: React.ReactNode; label: string; color: string; active?: boolean; onClick?: () => void; href?: string;
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
      position: 'relative',
    };
    const inner = (
      <>
        <span aria-hidden="true" className="qa-led" data-active={active ? 'true' : 'false'} />
        <span className="leading-none" style={{ color }}>{icon}</span>
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
                <FeatureTab key={key} icon={<IconAnalyst s={30} />} label={L.features.analiz}
                  color={FEATURE_COLORS.analiz} href="/analiz" />
              );
            }
            const meta = {
              play:    { icon: <IconSwords s={30} />, label: L.features.play,    color: FEATURE_COLORS.play },
              lessons: { icon: <IconBook s={30} />,    label: L.features.lessons, color: FEATURE_COLORS.lessons },
              eglence: { icon: <IconPuzzle s={30} />,  label: L.features.eglence, color: FEATURE_COLORS.eglence },
            }[key];
            return (
              <FeatureTab
                key={key} icon={meta.icon} label={meta.label} color={meta.color}
                active={openTab === key} onClick={() => toggleTab(key)}
              />
            );
          })}

          {/* Zafer hocanın eklediği ek sekmeler — ayrı sayfaya GİTMEZ, yerleşik
              sekmeler gibi ana ekranda açılır (kullanıcı kararı 2026-08-09).
              "Pratik Yap" özel bir ikon alır (satranç oynayan adam,
              2026-08-19); diğer özel sekmeler admin'in kendi emoji'sini
              kullanmaya devam eder. */}
          {customTabs.map((ct, i) => (
            <FeatureTab
              key={ct.id}
              icon={ct.label === 'Pratik Yap' ? <IconChessPlayer s={30} /> : ct.emoji}
              label={ct.label}
              color={CUSTOM_TAB_COLORS[i % CUSTOM_TAB_COLORS.length]}
              active={openTab === ct.id} onClick={() => toggleCustomTab(ct.id)}
            />
          ))}
        </div>

        {/* Açık özel sekmenin alt sekmeleri — aynı ekranda */}
        {typeof openTab === 'number' && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }} className="mb-4">
            {customTabDetails[openTab]
              ? <CustomTabPanel tab={customTabDetails[openTab]} />
              : <p className="text-sm t-muted">Yükleniyor...</p>}
          </div>
        )}

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

            <VerticalDivider />

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

            <VerticalDivider />

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
                    <VerticalDivider />
                  )}
                  <PathNode
                    icon={LEVEL_EMOJIS[li % LEVEL_EMOJIS.length]}
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
                            return [l.id, sc == null ? undefined : isLessonCompleted(st, sc, thresholdsByLesson[l.id])];
                          })),
                        );
                        const subs = subtopicsByLesson[les.id];
                        const lessonScores = scoresByLesson[les.id];
                        const lessonThresholds = thresholdsByLesson[les.id];
                        const orderedStepIds = (subs ?? []).map((s) => s.stepId);
                        /** Kilit YALNIZCA skor haritası gerçekten alındıysa uygulanır. */
                        const subLocked = (stepId: number) =>
                          lessonScores != null
                          && !isSubtopicUnlocked(orderedStepIds, stepId, lessonScores, lessonThresholds);
                        const modeLocked = (stepId: number, slug: string) =>
                          lessonScores != null &&
                          !isModeUnlocked(orderedStepIds, stepId, slug as PracticeMode, lessonScores, lessonThresholds);
                        return (
                          <div key={les.id}>
                            <PathNode
                              icon="📘"
                              label={lessonLocked ? `🔒 ${les.title}` : les.title}
                              active={lessonOpen}
                              size={36}
                              onClick={() => { if (!lessonLocked) toggleLesson(les.id); }}
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
                                        icon={SUBTOPIC_EMOJIS[si % SUBTOPIC_EMOJIS.length]}
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

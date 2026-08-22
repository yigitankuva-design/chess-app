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

interface FunActivity { id: number; name: string; description: string; emoji: string }

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
/* Daha belirgin çapraz kılıç: uzun bilezikler + çapraz muhafaza (guard)
   çentiği + kabza (pommel) noktası — sadece X değil, kılıç OKUNSUN diye
   (2026-08-19 güncellemesi). */
const IconSwords = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} {...svgBase}>
    <line x1="5" y1="19" x2="19" y2="5" />
    <line x1="7" y1="17" x2="11" y2="13" />
    <circle cx="4" cy="20" r="1.1" fill="currentColor" stroke="none" />
    <line x1="19" y1="19" x2="5" y2="5" />
    <line x1="17" y1="17" x2="13" y2="13" />
    <circle cx="20" cy="20" r="1.1" fill="currentColor" stroke="none" />
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

/** Tempo ve Süre sütunlarının satırları hizalı kalsın diye sabit satır yüksekliği */


/* Zorluk göstergesi — dolu çubuk sayısı seviyeyi anlatır */

/* Dairesel seçim (radio) düğmesi */

const PRACTICE_MODES = [
  { slug: 'suresiz', emoji: '♾️', label: 'Süresiz Pratik Yap', color: '#2dd4bf' },
  { slug: 'sureli',  emoji: '⏱️', label: 'Süreli Pratik Yap',  color: '#fbbf24' },
  { slug: 'test',    emoji: '📝', label: 'Kendini Test Et',    color: '#a78bfa' },
];

const QA_STATE_KEY = 'bea_qa_state_v2';

interface ModuleSummary { id: number; order_index: number; name: string; lessons_count: number; icon?: string }
interface LessonSummary { id: number; order_index: number; title: string; estimated_minutes: number; icon?: string | null }
interface Subtopic { stepId: number; title: string; icon?: string }

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
  /** Eğlence sekmesindeki oyun/yarışma kartları — admin'den gelir (madde:
   *  2026-08-21). null = henüz yüklenmedi; sekme açılmadan istek atılmaz. */
  const [funActivities, setFunActivities] = useState<FunActivity[] | null>(null);
  useEffect(() => {
    if (!showEglence || funActivities !== null) return;
    fetch(`${API_BASE}/fun-activities`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setFunActivities(Array.isArray(d) ? d : []))
      .catch(() => setFunActivities([]));
  }, [showEglence, funActivities]);
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
        .map((s: { id: number; content_json: { title: string; icon?: string } }) => ({ stepId: s.id, title: s.content_json.title, icon: s.content_json.icon }));
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

  /* Sekme kartı — kabartma, açıkken gömük. Arkasında turkuaz yanan bir LED
     var. BAŞLANGIÇTA (hiç sekme seçilmemişken) TÜMÜ yanık durur; sporcu bir
     sekmeye tıklayınca sadece O sekmenin LED'i yanık kalır, diğerleri söner
     (madde 1, 2026-08-19). `active` kabartma/gömük görünümünü belirler —
     LED bundan AYRI bir kavram: `ledOn` verilmezse `active` ile aynı davranır. */
  function FeatureTab({ icon, label, color, active, ledOn, onClick, href }: {
    icon: React.ReactNode; label: string; color: string; active?: boolean; ledOn?: boolean;
    onClick?: () => void; href?: string;
  }) {
    const lit = ledOn ?? active ?? false;
    const style: React.CSSProperties = {
      ...(active ? pressed(16) : raised(16)),
      padding: '1.5rem 0.75rem',
      minHeight: 132,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.6rem',
      cursor: 'pointer',
      textDecoration: 'none',
      position: 'relative',
    };
    /* LED yanan kartta ikon+yazı parlar; sönük karttaki matlaşır — tab'ın
       kendi rengiyle ışıldar. */
    const contentStyle: React.CSSProperties = lit
      ? { color, opacity: 1, filter: `drop-shadow(0 0 5px ${color})` }
      : { color, opacity: 0.4 };
    /* Madde 1 (2026-08-20): ikon+isim %50 büyütüldü. Emoji ikonlara (admin
       ikon havuzundan seçilen) SVG yedek ikonlarla (s=45) AYNI görsel taban
       için açık font-size verilir — yoksa emoji tarayıcı varsayılan boyutta
       (~1em) kalır ve SVG'den küçük görünürdü. */
    const inner = (
      <>
        <span aria-hidden="true" className="qa-led" data-active={lit ? 'true' : 'false'} />
        <span className="leading-none" style={{ ...contentStyle, fontSize: '2.8125rem' }}>{icon}</span>
        <span className="text-lg font-bold leading-tight text-center" style={contentStyle}>{label}</span>
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
            // Madde 1 (2026-08-19): admin ikon havuzundan seçtiyse (L.icons.X)
            // o kullanılır; seçmediyse eski sabit çizgi-ikona düşer.
            if (key === 'analiz') {
              return (
                <FeatureTab key={key} icon={L.icons.analiz || <IconAnalyst s={45} />} label={L.features.analiz}
                  color={FEATURE_COLORS.analiz} href="/analiz" ledOn={openTab === null} />
              );
            }
            const meta = {
              play:    { icon: L.icons.play || <IconSwords s={45} />, label: L.features.play,    color: FEATURE_COLORS.play },
              lessons: { icon: L.icons.lessons || <IconBook s={45} />, label: L.features.lessons, color: FEATURE_COLORS.lessons },
              eglence: { icon: L.icons.eglence || <IconPuzzle s={45} />, label: L.features.eglence, color: FEATURE_COLORS.eglence },
            }[key];
            return (
              <FeatureTab
                key={key} icon={meta.icon} label={meta.label} color={meta.color}
                active={openTab === key} ledOn={openTab === key || openTab === null}
                onClick={() => toggleTab(key)}
              />
            );
          })}

          {/* Zafer hocanın eklediği ek sekmeler — ayrı sayfaya GİTMEZ, yerleşik
              sekmeler gibi ana ekranda açılır (kullanıcı kararı 2026-08-09).
              İkonu admin'in ikon havuzundan seçtiği emoji belirler (madde
              1/3, 2026-08-19) — Pratik Yap dahil hepsi aynı kurala uyar. */}
          {customTabs.map((ct, i) => (
            <FeatureTab
              key={ct.id}
              icon={ct.emoji}
              label={ct.label}
              color={CUSTOM_TAB_COLORS[i % CUSTOM_TAB_COLORS.length]}
              active={openTab === ct.id} ledOn={openTab === ct.id || openTab === null}
              onClick={() => toggleCustomTab(ct.id)}
            />
          ))}
        </div>

        {/* Açık özel sekmenin alt sekmeleri — aynı ekranda. accentColor:
            alt sekme cümleleri sekmenin kendi rengiyle aynı olsun diye
            (madde 2, 2026-08-19) — kartın ÜSTÜNDEKİ renkle BİREBİR aynı
            hesap kullanılır. */}
        {typeof openTab === 'number' && (() => {
          const ctIdx = customTabs.findIndex((ct) => ct.id === openTab);
          const accentColor = ctIdx >= 0 ? CUSTOM_TAB_COLORS[ctIdx % CUSTOM_TAB_COLORS.length] : undefined;
          return (
            <div style={{ ...pressed(18), padding: '1.1rem 1rem' }} className="mb-4">
              {customTabDetails[openTab]
                ? <CustomTabPanel tab={customTabDetails[openTab]} accentColor={accentColor} />
                : <p className="text-sm t-muted">Yükleniyor...</p>}
            </div>
          );
        })()}

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
              <span className="font-bold text-sm flex items-center gap-2" style={{ color: FEATURE_COLORS.play }}>
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
              <span className="font-bold text-sm" style={{ color: FEATURE_COLORS.play }}>
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
              <span className="font-bold text-sm" style={{ color: FEATURE_COLORS.play }}>Turnuvaya Katıl</span>
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
                    icon={lv.icon && lv.icon !== 'default' ? lv.icon : LEVEL_EMOJIS[li % LEVEL_EMOJIS.length]}
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
                              icon={les.icon || '📘'}
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
                                        icon={sub.icon || SUBTOPIC_EMOJIS[si % SUBTOPIC_EMOJIS.length]}
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

        {/* Eğlence — madde 2026-08-21: alt sekmeler kaldırıldı, admin'in
            eklediği oyun/yarışma türleri artık dairesel kartlar olarak
            İKİ SÜTUNLU bir ızgarada gösterilir (Düzey seçim ekranındaki
            dairesel rozetlerle AYNI ruh, ama yazı da kartın İÇİNDE). */}
        {showEglence && (
          <div style={{ ...pressed(18), padding: '1.1rem 1rem' }}>
            <p className="text-xs font-bold t-muted uppercase tracking-widest mb-4">
              {L.features.eglence}
            </p>
            {funActivities === null && (
              <p className="text-xs t-muted py-1">Yükleniyor...</p>
            )}
            {funActivities?.length === 0 && (
              <p className="text-xs t-muted py-1">Henüz oyun/yarışma eklenmedi.</p>
            )}
            {funActivities && funActivities.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {funActivities.map((a) => (
                  <Link
                    key={a.id}
                    href={`/eglence/${a.id}`}
                    className="aspect-square rounded-full flex flex-col items-center justify-center text-center gap-1 p-3"
                    style={{ ...raised(999, 4), textDecoration: 'none' }}
                  >
                    <span className="text-3xl leading-none">{a.emoji}</span>
                    <span className="font-bold text-xs leading-tight" style={{ color: FEATURE_COLORS.eglence }}>
                      {a.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

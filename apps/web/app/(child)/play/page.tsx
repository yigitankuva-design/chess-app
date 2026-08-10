'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BotGame } from '@/components/BotGame';
import { OfferBoard } from '@/components/play/OfferBoard';
import { OpeningPractice } from '@/components/play/OpeningPractice';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { LEVELS, ALL_TIMES } from '@/lib/play/levels';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor, ColorChoice } from '@/lib/play/color';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { usePresenceCount } from '@/lib/presence/PresenceContext';
import { ActivePlayersBadge } from '@/components/play/ActivePlayersBadge';
import { getCustomTab } from '@/lib/customTabsApi';
import { PositionPoolPractice } from '@/components/play/PositionPoolPractice';
import type { PoolPosition } from '@/lib/play/positionPool';

/** "pool" ana ekrandaki özel sekme alt sekmesinden gelir — kart listesinde YOKTUR. */
type Mode = 'friend' | 'bot' | 'opening' | 'tournament' | 'pool';

const MODE_CARDS: { mode: Mode; emoji: string; title: string; subtitle: string }[] = [
  { mode: 'friend',     emoji: '🤝', title: 'Arkadaşla Oyna',     subtitle: 'Aktif sporcuya teklif gönder' },
  { mode: 'bot',        emoji: '🤖', title: 'Bota Karşı Oyna',    subtitle: 'Bilgisayara karşı maç' },
  { mode: 'opening',    emoji: '📖', title: 'Açılışı Pratiği Yap', subtitle: 'Seçtiğin açılıştan başla' },
  { mode: 'tournament', emoji: '🏆', title: 'Turnuvaya Katıl',    subtitle: 'Çok oyunculu etkinlik' },
];

const ChevronRight = () => (
  <svg className="flex-shrink-0 t-muted" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

export default function PlayPage() {
  return (
    <Suspense fallback={<main id="main-content" className="px-4 pt-5 max-w-lg mx-auto"><p className="text-sm t-muted">Yükleniyor...</p></main>}>
      <PlayInner />
    </Suspense>
  );
}

function PlayInner() {
  useTabGuard('play');
  const activeCount = usePresenceCount();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hızlı Erişim patikasından (skill+tc) gelinmişse doğrudan bot maçına gir.
  // "skill" param adı tarihseldir — artık ham Stockfish skill değeri DEĞİL,
  // LEVELS'teki düzey numarasını (1-10) taşır (10 seviyeli sisteme geçişte
  // skill değerleri artık düzeyler arasında benzersiz olmadığı için).
  const skillParam = searchParams.get('skill');
  const tcParam = searchParams.get('tc');
  const quickLevel = skillParam !== null ? LEVELS.find((l) => l.level === Number(skillParam)) : undefined;
  const quickTc = tcParam ? ALL_TIMES.find((t) => t.label === tcParam) : undefined;
  const colorParam = searchParams.get('color');
  const quickColor: ColorChoice =
    colorParam === 'white' || colorParam === 'black' || colorParam === 'random'
      ? colorParam
      : 'white';
  const quickStart: MatchCriteriaValue | null = quickLevel && quickTc
    ? { level: quickLevel, timeControl: quickTc, colorChoice: quickColor }
    : null;

  // Ana sayfadaki maç türü kartından gelinmişse o akışı doğrudan aç.
  // "pool" modu ana ekrandaki özel sekme alt sekmesinden gelir; kriterler zaten
  // seçilmiş olduğu için quickStart'tan ÖNCE değerlendirilir.
  const modeParam = searchParams.get('mode');
  const sectionParam = searchParams.get('section');
  const tabParam = searchParams.get('tab');
  const initialMode: Mode | null =
    modeParam === 'pool' && sectionParam && tabParam
      ? 'pool'
      : quickStart
        ? 'bot'
        : MODE_CARDS.some((c) => c.mode === modeParam)
          ? (modeParam as Mode)
          : null;

  const [mode, setMode] = useState<Mode | null>(initialMode);
  const [botCriteria, setBotCriteria] = useState<MatchCriteriaValue | null>(quickStart);
  const [botColor, setBotColor] = useState<PieceColor>(
    quickStart ? resolveColor(quickStart.colorChoice) : 'w',
  );
  const [gameKey, setGameKey] = useState(0);

  /** pool modu: seçilen alt sekmenin konum havuzu. undefined = henüz yükleniyor. */
  const [poolPositions, setPoolPositions] = useState<PoolPosition[] | undefined>(undefined);
  const [poolTitle, setPoolTitle] = useState('');

  useEffect(() => {
    if (initialMode !== 'pool' || !tabParam || !sectionParam) return;
    getCustomTab(Number(tabParam)).then((detail) => {
      const section = detail?.sections.find((s) => s.id === Number(sectionParam));
      setPoolPositions(section?.practice_positions ?? []);
      setPoolTitle(section?.title ?? '');
    });
  }, [initialMode, tabParam, sectionParam]);

  /** Secimleri ADRESE yazar. Boylece F5/yenile sonrasi sporcu ayni ekranda
   *  kalir; React durumu kaybolsa da adres bilgiyi tasir (madde 4 ve 9). */
  function writeUrl(next: { mode?: Mode | null; criteria?: MatchCriteriaValue | null }) {
    const q = new URLSearchParams();
    const m = next.mode !== undefined ? next.mode : mode;
    if (m) q.set('mode', m);
    const c = next.criteria !== undefined ? next.criteria : botCriteria;
    if (c) {
      // Adrese DÜZEY NUMARASI yazılır (1-10). Ham skill değeri 10 seviyeli
      // sistemde düzeyler arasında benzersiz DEĞİL — okuyucu taraf (quickLevel)
      // bunu düzey numarası olarak arıyor.
      q.set('skill', String(c.level.level));
      q.set('tc', c.timeControl.label);
      q.set('color', c.colorChoice);
    }
    router.replace(q.toString() ? `/play?${q}` : '/play');
  }

  function startBot(v: MatchCriteriaValue) {
    setBotCriteria(v);
    setBotColor(resolveColor(v.colorChoice));
    setGameKey((k) => k + 1);
    writeUrl({ mode: 'bot', criteria: v });
  }

  // ── Mod seçimi (4 kart) ────────────────────────────────────────────────────
  if (!mode) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest">Maç Türü Seç</p>
        {MODE_CARDS.map((c) => (
          <button key={c.mode} onClick={() => { setMode(c.mode); writeUrl({ mode: c.mode, criteria: null }); }}
            className="t-card-i w-full flex items-center gap-4 px-4 py-4 text-left">
            <span className="text-2xl">{c.emoji}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm flex items-center gap-2">
                {c.title}
                {c.mode === 'friend' && activeCount !== null && (
                  <ActivePlayersBadge count={activeCount} />
                )}
              </p>
              <p className="text-xs t-muted mt-0.5">{c.subtitle}</p>
            </div>
            <ChevronRight />
          </button>
        ))}
      </main>
    );
  }

  /** 4 karta donus. "Maç Türü" YAZISI kaldirildi (madde 4 ve 8); ok kaldi
   *  cunku ust cubuktaki geri oku /play'den tamamen cikarir — Mac Yap
   *  icindeki gecisler adres degistirmiyor. */
  const backBtn = (
    <button onClick={() => { setMode(null); setBotCriteria(null); writeUrl({ mode: null, criteria: null }); }}
      aria-label="Maç türü seçimine dön"
      className="t-btn-ghost text-base px-3 py-1.5">
      ←
    </button>
  );

  // ── Konum havuzu pratiği (özel sekme alt sekmesinden gelindi) ──────────────
  if (mode === 'pool') {
    return (
      <main className="pb-12">
        {poolPositions === undefined ? (
          <p className="px-4 pt-3 text-sm t-muted">Yükleniyor...</p>
        ) : poolPositions.length === 0 ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
              <p className="font-semibold text-sm">🎯 {poolTitle || 'Pratik'}</p>
            </div>
            <p className="px-4 text-sm t-muted">Bu bölümde henüz konum yok.</p>
          </>
        ) : (
          /* Başlık (bölüm adı + konum kodu) bileşenin KENDİSİ çizer — kod o an
             oynanan konumdan gelir ve konum değişince kendiliğinden güncellenir. */
          <PositionPoolPractice
            title={poolTitle || 'Pratik'}
            positions={poolPositions}
            initialCriteria={quickStart ?? undefined}
          />
        )}
      </main>
    );
  }

  // ── Turnuva: henüz özellikleri belirlenmedi ────────────────────────────────
  if (mode === 'tournament') {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">🏆 Turnuvaya Katıl</p>
          {backBtn}
        </div>
        <div className="t-card-i p-5 text-center space-y-2">
          <p className="text-3xl">🚧</p>
          <p className="font-bold text-sm">Yakında</p>
          <p className="text-xs t-muted">Turnuva özellikleri hazırlanıyor.</p>
        </div>
      </main>
    );
  }

  // ── Açılış Pratiği ─────────────────────────────────────────────────────────
  if (mode === 'opening') {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">📖 Açılışı Pratiği Yap</p>
          {backBtn}
        </div>
        <OpeningPractice />
      </main>
    );
  }

  // ── Arkadaşla Oyna ─────────────────────────────────────────────────────────
  if (mode === 'friend') {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">🤝 Arkadaşla Oyna</p>
          {backBtn}
        </div>
        <OfferBoard />
      </main>
    );
  }

  // ── Bota Karşı Oyna: kriter seçimi ─────────────────────────────────────────
  if (!botCriteria) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">🤖 Bota Karşı Oyna</p>
          {backBtn}
        </div>
        <MatchCriteria startLabel="Maça Başla" onStart={startBot} />
      </main>
    );
  }

  // ── Bota Karşı Oyna: maç ───────────────────────────────────────────────────
  return (
    <main className="pb-12">
      <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <p className="font-semibold text-sm">
          🤖 Bot — Düzey {botCriteria.level.level} · {botCriteria.timeControl.label} ·{' '}
          {botColor === 'w' ? 'Beyaz' : 'Siyah'}
        </p>
        <button onClick={() => { setBotCriteria(null); writeUrl({ mode: 'bot', criteria: null }); }}
          className="t-btn-ghost text-xs px-3 py-1.5">
          Ayarları değiştir
        </button>
      </div>

      <BotGame
        key={gameKey}
        skillLevel={botCriteria.level.skill}
        depth={botCriteria.level.depth}
        blunderChance={botCriteria.level.blunderChance}
        timeControl={botCriteria.timeControl}
        studentColor={botColor}
        onGameEnd={() => {}}
        onRematch={() => { setBotColor(resolveColor(botCriteria.colorChoice)); setGameKey((k) => k + 1); }}
      />
    </main>
  );
}

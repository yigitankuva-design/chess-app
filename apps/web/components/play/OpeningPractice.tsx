'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { FriendChallenge } from '@/components/play/FriendChallenge';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { StepCard } from '@/components/play/StepCard';
import {
  isCriteriaUnlocked, isOpeningUnlocked, openingSummary, categorySummary,
} from '@/lib/play/openingSteps';
import type { BotStepKey } from '@/lib/play/openingSteps';
import { OPENING_CATEGORIES, groupOpenings, normalizeCategory } from '@/lib/play/openingCategories';
import type { OpeningCategory } from '@/lib/play/openingCategories';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';
import { pickDifferentPosition } from '@/lib/play/positionPool';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Opening { id: number; name: string; start_fen: string; category?: string | null }

interface Props {
  /**
   * Doğrudan-başlat: /play sayfası, CustomTabPanel'den yönlendirilince bunu
   * verir — seçim adımları (tür/açılış/kriter) ATLANIR, doğrudan bu açılış
   * id'si ve kriterle maça girilir. İkisi de dolu değilse normal akordiyon
   * akışı çalışır (madde: 2026-08-19).
   */
  initialOpeningId?: number;
  initialCriteria?: MatchCriteriaValue;
  /**
   * Verilirse, kriter seçilip "Pratiğe Başla"ya tıklanınca BotGame BURADA
   * render EDİLMEZ — bunun yerine bu callback çağrılır, navigasyon çağırana
   * bırakılır. CustomTabPanel bunu kullanarak sporcuyu /play sayfasına
   * yönlendirir (pratik ayrı sayfada oynanır). Verilmezse (örn. /play
   * sayfasının kendisi) maç eskisi gibi burada açılır.
   */
  onReadyToStart?: (opening: Opening, criteria: MatchCriteriaValue) => void;
}

/** Acilis pratigi: sirali ve kilitli acilir kartlar (akordiyon).
 *  Dis katman: bot / arkadas. Ic katman (bot): tur -> acilis -> kriterler. */
export function OpeningPractice({ initialOpeningId, initialCriteria, onReadyToStart }: Props = {}) {
  const [openOuter, setOpenOuter] = useState<'bot' | 'friend' | null>(null);
  // Madde 4: acilis listesi BASTAN gorunmez — sporcu basliga tiklamadan
  // tum acilislari gormemeli.
  const [openInner, setOpenInner] = useState<BotStepKey | null>(null);
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [category, setCategory] = useState<OpeningCategory | null>(null);
  const [chosen, setChosen] = useState<Opening | null>(null);
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [color, setColor] = useState<PieceColor>('w');
  const [matchKey, setMatchKey] = useState(0);

  /** initialOpeningId+initialCriteria ikisi de doluysa doğrudan-başlat modu. */
  const directStart = initialOpeningId !== undefined && !!initialCriteria;

  const loadOpenings = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/openings`);
      const data = r.ok ? await r.json() : null;
      setOpenings(Array.isArray(data) ? data : []);
    } catch {
      setOpenings([]);
    }
  }, []);

  // Acilislar YALNIZCA bir dal acildiginda yuklenir — gereksiz istek atilmaz.
  useEffect(() => {
    if (openOuter !== null && openings === null) void loadOpenings();
  }, [openOuter, openings, loadOpenings]);

  // Dogrudan-baslat: dal acilmasi beklenmez, liste hemen cekilir.
  useEffect(() => {
    if (directStart && openings === null) void loadOpenings();
  }, [directStart, openings, loadOpenings]);

  // Dogrudan-baslat: liste gelince eslesen acilisi bul, kategori+kriterleri uygula.
  useEffect(() => {
    if (!directStart || !openings || chosen) return;
    const found = openings.find((o) => o.id === initialOpeningId);
    if (found && initialCriteria) {
      setChosen(found);
      setCategory(normalizeCategory(found.category));
      setCriteria(initialCriteria);
      setColor(resolveColor(initialCriteria.colorChoice));
    }
  }, [directStart, openings, initialOpeningId, initialCriteria, chosen]);

  /** Tur degisince secili acilis SIFIRLANIR — yanlis turden kalan bir
   *  acilisla mac baslamasin. */
  function pickCategory(key: OpeningCategory) {
    setCategory(key);
    setChosen(null);
  }

  const groups = groupOpenings(openings ?? []);

  /** Tur listesi iki dalda da AYNI — tek yerde durur, kopyalanmaz.
   *  Akordiyon gorunumu: TEK cerceve, satirlar arasinda ince ayirici cizgi —
   *  her secenek kendi basina isiltili/kenarlikli bir "kart" DEGIL (madde 1). */
  const typeList = (onPicked: () => void) => (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-border)' }}>
      {OPENING_CATEGORIES.map((c, i) => (
        <button key={c.key} type="button"
          onClick={() => { pickCategory(c.key); onPicked(); }}
          className="w-full flex items-center px-4 py-3 text-left"
          style={{
            background: 'var(--t-surface)',
            borderTop: i === 0 ? 'none' : '1px solid var(--t-border)',
          }}>
          <span className="font-medium text-sm flex-1">{c.title}</span>
        </button>
      ))}
    </div>
  );

  /** Secili turdeki acilislar. Ayni akordiyon gorunumu (madde 3) — ikon KALIR. */
  const openingList = (onPicked: () => void) => {
    const rows = category === null ? [] : groups[category];
    return (
      <div>
        {openings === null && <p className="text-sm t-muted">Yükleniyor…</p>}
        {openings !== null && rows.length === 0 && (
          <p className="text-sm t-muted">Bu türde henüz açılış yok.</p>
        )}
        {rows.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-border)' }}>
            {rows.map((o, i) => (
              <button key={o.id} type="button"
                onClick={() => { setChosen(o); onPicked(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{
                  background: 'var(--t-surface)',
                  borderTop: i === 0 ? 'none' : '1px solid var(--t-border)',
                }}>
                <span className="text-xl">📖</span>
                <span className="font-medium text-sm flex-1">{o.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Dogrudan-baslat: acilis bulununcaya kadar bilgilendirme goster.
  if (directStart && !(criteria && chosen)) {
    if (openings === null) return <p className="text-sm t-muted">Yükleniyor…</p>;
    const found = openings.find((o) => o.id === initialOpeningId);
    if (!found) return <p className="text-sm t-muted">Açılış bulunamadı.</p>;
    return <p className="text-sm t-muted">Yükleniyor…</p>;
  }

  // Kriterler secildi -> mac basladi; akordiyon yerini tahtaya birakir.
  if (criteria && chosen) {
    return (
      <BotGame
        key={matchKey}
        skillLevel={criteria.level.skill}
        depth={criteria.level.depth}
        blunderChance={criteria.level.blunderChance}
        timeControl={criteria.timeControl}
        studentColor={color}
        startFen={chosen.start_fen}
        onGameEnd={() => {}}
        practiceActions={{
          onPlaySame: () => setMatchKey((k) => k + 1),
          onPlayDifferent: () => {
            if (category === null) return;
            const next = pickDifferentPosition(groups[category], chosen.id);
            setChosen(next);
            setMatchKey((k) => k + 1);
          },
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <StepCard
        emoji="🤖"
        title="Bota Karşı Pratik Yap"
        open={openOuter === 'bot'}
        onToggle={() => setOpenOuter((p) => (p === 'bot' ? null : 'bot'))}
      >
        <div className="space-y-3">
          <StepCard
            stepNumber={1}
            title="Açılış Türünü Seç"
            summary={categorySummary(category)}
            open={openInner === 'type'}
            tone={1}
            onToggle={() => setOpenInner((p) => (p === 'type' ? null : 'type'))}
          >
            {typeList(() => setOpenInner('opening'))}
          </StepCard>

          <StepCard
            stepNumber={2}
            title="Açılış Konumunu Seç"
            summary={openingSummary(chosen?.name ?? null)}
            open={openInner === 'opening'}
            locked={!isOpeningUnlocked(category)}
            tone={2}
            onToggle={() => setOpenInner((p) => (p === 'opening' ? null : 'opening'))}
          >
            {openingList(() => setOpenInner('criteria'))}
          </StepCard>

          <StepCard
            stepNumber={3}
            title="Maç Kriterlerini Seç"
            flush
            open={openInner === 'criteria'}
            locked={!isCriteriaUnlocked(chosen?.name ?? null)}
            tone={3}
            onToggle={() => setOpenInner((p) => (p === 'criteria' ? null : 'criteria'))}
          >
            <MatchCriteria
              startLabel="Pratiğe Başla"
              simplifiedLevels
              onStart={(v) => {
                // Kilit yalnizca gorsel degil: acilis yoksa mac hic baslamaz.
                if (!chosen) return;
                if (onReadyToStart) { onReadyToStart(chosen, v); return; }
                setCriteria(v);
                setColor(resolveColor(v.colorChoice));
              }}
            />
          </StepCard>
        </div>
      </StepCard>

      <StepCard
        emoji="🤝"
        title="Arkadaşına Karşı Pratik Yap"
        open={openOuter === 'friend'}
        onToggle={() => setOpenOuter((p) => (p === 'friend' ? null : 'friend'))}
      >
        {/* Sira: 1) Tur 2) Acilis 3) Kriterler 4) Arkadas */}
        <FriendChallenge
          openingStep={{
            renderTypes: typeList,
            typeSummary: categorySummary(category),
            typePicked: category !== null,
            renderOpenings: openingList,
            openingSummary: openingSummary(chosen?.name ?? null),
            picked: chosen !== null,
            startFen: chosen?.start_fen ?? null,
          }}
        />
      </StepCard>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { FriendChallenge } from '@/components/play/FriendChallenge';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { PathNode, Branch } from '@/components/ui/neumorphic';
import {
  isCriteriaUnlocked, isOpeningUnlocked, isVariantUnlocked,
  openingSummary, categorySummary, variantSummary,
} from '@/lib/play/openingSteps';
import type { BotStepKey } from '@/lib/play/openingSteps';
import { OPENING_CATEGORIES, groupOpenings, normalizeCategory } from '@/lib/play/openingCategories';
import type { OpeningCategory } from '@/lib/play/openingCategories';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';
import { pickDifferentPosition } from '@/lib/play/positionPool';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface OpeningVariant { id: number; name: string; start_fen: string }
export interface Opening { id: number; name: string; category?: string | null; variants: OpeningVariant[] }

interface Props {
  /**
   * Doğrudan-başlat: /play sayfası, CustomTabPanel'den yönlendirilince bunu
   * verir — seçim adımları (tür/açılış/varyant/kriter) ATLANIR, doğrudan bu
   * VARYANT id'si ve kriterle maça girilir. İkisi de dolu değilse normal
   * akordiyon akışı çalışır (madde: 2026-08-19, güncelleme 2026-08-20).
   */
  initialVariantId?: number;
  initialCriteria?: MatchCriteriaValue;
  /**
   * Verilirse, kriter seçilip "Pratiğe Başla"ya tıklanınca BotGame BURADA
   * render EDİLMEZ — bunun yerine bu callback çağrılır, navigasyon çağırana
   * bırakılır. CustomTabPanel bunu kullanarak sporcuyu /play sayfasına
   * yönlendirir (pratik ayrı sayfada oynanır). Verilmezse (örn. /play
   * sayfasının kendisi) maç eskisi gibi burada açılır.
   */
  onReadyToStart?: (variant: OpeningVariant, criteria: MatchCriteriaValue) => void;
  /** Pratik Yap kartının rengiyle AYNI — bkz. CustomTabPanel'in accentColor'ı
   *  (madde 2, 2026-08-19). Verilmezse etiketler varsayılan renkte kalır. */
  tint?: string;
}

/** Acilis pratigi: sirali ve kilitli acilir kartlar (akordiyon).
 *  Dis katman: bot / arkadas. Ic katman (bot): tur -> acilis ismi -> varyant
 *  -> kriterler (madde: 2026-08-20 — "varyant" katmani yeni eklendi). */
export function OpeningPractice({ initialVariantId, initialCriteria, onReadyToStart, tint }: Props = {}) {
  const [openOuter, setOpenOuter] = useState<'bot' | 'friend' | null>(null);
  // Madde 4: acilis listesi BASTAN gorunmez — sporcu basliga tiklamadan
  // tum acilislari gormemeli.
  const [openInner, setOpenInner] = useState<BotStepKey | null>(null);
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [category, setCategory] = useState<OpeningCategory | null>(null);
  const [chosen, setChosen] = useState<Opening | null>(null);
  const [chosenVariant, setChosenVariant] = useState<OpeningVariant | null>(null);
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [color, setColor] = useState<PieceColor>('w');
  const [matchKey, setMatchKey] = useState(0);

  /** initialVariantId+initialCriteria ikisi de doluysa doğrudan-başlat modu. */
  const directStart = initialVariantId !== undefined && !!initialCriteria;

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

  // Dogrudan-baslat: liste gelince eslesen VARYANTI (ve onu tasiyan acilisi) bul.
  useEffect(() => {
    if (!directStart || !openings || chosenVariant) return;
    for (const o of openings) {
      const v = o.variants.find((vv) => vv.id === initialVariantId);
      if (v && initialCriteria) {
        setChosen(o);
        setChosenVariant(v);
        setCategory(normalizeCategory(o.category));
        setCriteria(initialCriteria);
        setColor(resolveColor(initialCriteria.colorChoice));
        break;
      }
    }
  }, [directStart, openings, initialVariantId, initialCriteria, chosenVariant]);

  /** Tur degisince secili acilis/varyant SIFIRLANIR — yanlis turden kalan
   *  bir secimle mac baslamasin. */
  function pickCategory(key: OpeningCategory) {
    setCategory(key);
    setChosen(null);
    setChosenVariant(null);
  }

  /** Acilis ismi degisince secili varyant SIFIRLANIR. */
  function pickOpening(o: Opening) {
    setChosen(o);
    setChosenVariant(null);
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

  /** Secili turdeki acilis İSİMLERİ (FEN yok — o varyantta). Ayni akordiyon
   *  gorunumu (madde 3) — ikon KALIR. */
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
                onClick={() => { pickOpening(o); onPicked(); }}
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

  /** Secili acilisin varyantlari (madde: 2026-08-20 — YENİ kart). */
  const variantList = (onPicked: () => void) => {
    const rows = chosen?.variants ?? [];
    return (
      <div>
        {rows.length === 0 && (
          <p className="text-sm t-muted">Bu açılışta henüz varyant yok.</p>
        )}
        {rows.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--t-border)' }}>
            {rows.map((v, i) => (
              <button key={v.id} type="button"
                onClick={() => { setChosenVariant(v); onPicked(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{
                  background: 'var(--t-surface)',
                  borderTop: i === 0 ? 'none' : '1px solid var(--t-border)',
                }}>
                <span className="text-xl">♟️</span>
                <span className="font-medium text-sm flex-1">{v.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Dogrudan-baslat: varyant bulununcaya kadar bilgilendirme goster.
  if (directStart && !(criteria && chosen && chosenVariant)) {
    if (openings === null) return <p className="text-sm t-muted">Yükleniyor…</p>;
    const found = openings.some((o) => o.variants.some((v) => v.id === initialVariantId));
    if (!found) return <p className="text-sm t-muted">Açılış bulunamadı.</p>;
    return <p className="text-sm t-muted">Yükleniyor…</p>;
  }

  // Kriterler secildi -> mac basladi; akordiyon yerini tahtaya birakir.
  if (criteria && chosen && chosenVariant) {
    return (
      <BotGame
        key={matchKey}
        skillLevel={criteria.level.skill}
        depth={criteria.level.depth}
        blunderChance={criteria.level.blunderChance}
        timeControl={criteria.timeControl}
        studentColor={color}
        startFen={chosenVariant.start_fen}
        onGameEnd={() => {}}
        practiceActions={{
          onPlaySame: () => setMatchKey((k) => k + 1),
          onPlayDifferent: () => {
            if (category === null) return;
            const pool = groups[category].flatMap(
              (o) => o.variants.map((v) => ({ id: v.id, opening: o, variant: v })),
            );
            if (pool.length === 0) return;
            const next = pickDifferentPosition(pool, chosenVariant.id);
            setChosen(next.opening);
            setChosenVariant(next.variant);
            setMatchKey((k) => k + 1);
          },
        }}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <PathNode
          icon="🤖"
          label="Bota Karşı Pratik Yap"
          active={openOuter === 'bot'}
          size={40}
          tint={tint}
          onClick={() => setOpenOuter((p) => (p === 'bot' ? null : 'bot'))}
        />
        {/* Madde 3 (2026-08-19): "Bota Karşı Pratik Yap" açılınca gelen
            adımların cümleleri BEYAZ kalsın diye tint BİLEREK geçilmez —
            sadece dış başlık tab rengini alır. */}
        {openOuter === 'bot' && (
          <Branch offset={20}>
            <div>
              <PathNode
                icon="📖"
                label="1. Açılış Türünü Seç"
                trailing={categorySummary(category) ? (
                  <span className="text-xs t-muted">{categorySummary(category)}</span>
                ) : undefined}
                active={openInner === 'type'}
                size={34}
                onClick={() => setOpenInner((p) => (p === 'type' ? null : 'type'))}
              />
              {openInner === 'type' && (
                <Branch offset={17}>{typeList(() => setOpenInner('opening'))}</Branch>
              )}
            </div>

            <div>
              <PathNode
                icon="📍"
                label="2. Açılış İsmini Seç"
                trailing={openingSummary(chosen?.name ?? null) ? (
                  <span className="text-xs t-muted">{openingSummary(chosen?.name ?? null)}</span>
                ) : undefined}
                active={openInner === 'opening'}
                locked={!isOpeningUnlocked(category)}
                size={34}
                onClick={() => setOpenInner((p) => (p === 'opening' ? null : 'opening'))}
              />
              {openInner === 'opening' && (
                <Branch offset={17}>{openingList(() => setOpenInner('variant'))}</Branch>
              )}
            </div>

            <div>
              <PathNode
                icon="♟️"
                label="3. Varyant Seç"
                trailing={variantSummary(chosenVariant?.name ?? null) ? (
                  <span className="text-xs t-muted">{variantSummary(chosenVariant?.name ?? null)}</span>
                ) : undefined}
                active={openInner === 'variant'}
                locked={!isVariantUnlocked(chosen?.name ?? null)}
                size={34}
                onClick={() => setOpenInner((p) => (p === 'variant' ? null : 'variant'))}
              />
              {openInner === 'variant' && (
                <Branch offset={17}>{variantList(() => setOpenInner('criteria'))}</Branch>
              )}
            </div>

            <div>
              <PathNode
                icon="🎯"
                label="4. Maç Kriterlerini Seç"
                active={openInner === 'criteria'}
                locked={!isCriteriaUnlocked(chosenVariant?.name ?? null)}
                size={34}
                onClick={() => setOpenInner((p) => (p === 'criteria' ? null : 'criteria'))}
              />
              {openInner === 'criteria' && (
                <Branch offset={17}>
                  {/* Madde 1 (2026-08-19): Açılış Pratiği'nde Renk Seç GERİ
                      geldi — sporcu açılışı istediği renkle pratik yapabilsin. */}
                  <MatchCriteria
                    startLabel="Pratiğe Başla"
                    simplifiedLevels
                    onStart={(v) => {
                      // Kilit yalnizca gorsel degil: varyant yoksa mac hic baslamaz.
                      if (!chosenVariant) return;
                      if (onReadyToStart) { onReadyToStart(chosenVariant, v); return; }
                      setCriteria(v);
                      setColor(resolveColor(v.colorChoice));
                    }}
                  />
                </Branch>
              )}
            </div>
          </Branch>
        )}
      </div>

      <div>
        <PathNode
          icon="🤝"
          label="Arkadaşına Karşı Pratik Yap"
          active={openOuter === 'friend'}
          size={40}
          tint={tint}
          onClick={() => setOpenOuter((p) => (p === 'friend' ? null : 'friend'))}
        />
        {openOuter === 'friend' && (
          /* Sira: 1) Tur 2) Acilis ismi 3) Varyant 4) Kriterler 5) Arkadas.
             FriendChallenge kendi ic adimlarini HALA StepCard ile cizer — o
             bilesen ayrica "Arkadasla Oyna" (Pratik Yap'la ilgisiz) akisinda
             da kullanildigi icin degistirilmedi (2026-08-19 kapsam karari). */
          <Branch offset={20}>
            <FriendChallenge
              openingStep={{
                renderTypes: typeList,
                typeSummary: categorySummary(category),
                typePicked: category !== null,
                renderOpenings: openingList,
                openingSummary: openingSummary(chosen?.name ?? null),
                openingPicked: chosen !== null,
                renderVariants: variantList,
                variantSummary: variantSummary(chosenVariant?.name ?? null),
                picked: chosenVariant !== null,
                startFen: chosenVariant?.start_fen ?? null,
              }}
            />
          </Branch>
        )}
      </div>
    </div>
  );
}

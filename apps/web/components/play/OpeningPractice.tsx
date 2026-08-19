'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { FriendChallenge } from '@/components/play/FriendChallenge';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { PathNode, Branch } from '@/components/ui/neumorphic';
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
  /** Pratik Yap kartının rengiyle AYNI — bkz. CustomTabPanel'in accentColor'ı
   *  (madde 2, 2026-08-19). Verilmezse etiketler varsayılan renkte kalır. */
  tint?: string;
}

/** Acilis pratigi: sirali ve kilitli acilir kartlar (akordiyon).
 *  Dis katman: bot / arkadas. Ic katman (bot): tur -> acilis -> kriterler. */
export function OpeningPractice({ initialOpeningId, initialCriteria, onReadyToStart, tint }: Props = {}) {
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
        {/* Madde 3 (2026-08-19): "Bota Karşı Pratik Yap" açılınca gelen 3
            adımın (Tür/Konum/Kriter) cümleleri BEYAZ kalsın diye tint
            BİLEREK geçilmez — sadece dış başlık tab rengini alır. */}
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
                label="2. Açılış Konumunu Seç"
                trailing={openingSummary(chosen?.name ?? null) ? (
                  <span className="text-xs t-muted">{openingSummary(chosen?.name ?? null)}</span>
                ) : undefined}
                active={openInner === 'opening'}
                locked={!isOpeningUnlocked(category)}
                size={34}
                onClick={() => setOpenInner((p) => (p === 'opening' ? null : 'opening'))}
              />
              {openInner === 'opening' && (
                <Branch offset={17}>{openingList(() => setOpenInner('criteria'))}</Branch>
              )}
            </div>

            <div>
              <PathNode
                icon="🎯"
                label="3. Maç Kriterlerini Seç"
                active={openInner === 'criteria'}
                locked={!isCriteriaUnlocked(chosen?.name ?? null)}
                size={34}
                onClick={() => setOpenInner((p) => (p === 'criteria' ? null : 'criteria'))}
              />
              {openInner === 'criteria' && (
                <Branch offset={17}>
                  <MatchCriteria
                    startLabel="Pratiğe Başla"
                    simplifiedLevels
                    showColor={false}
                    onStart={(v) => {
                      // Kilit yalnizca gorsel degil: acilis yoksa mac hic baslamaz.
                      if (!chosen) return;
                      if (onReadyToStart) { onReadyToStart(chosen, v); return; }
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
          /* Sira: 1) Tur 2) Acilis 3) Kriterler 4) Arkadas. FriendChallenge
             kendi ic adimlarini HALA StepCard ile cizer — o bilesen ayrica
             "Arkadasla Oyna" (Pratik Yap'la ilgisiz) akisinda da kullanildigi
             icin degistirilmedi (2026-08-19 kapsam karari). */
          <Branch offset={20}>
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
          </Branch>
        )}
      </div>
    </div>
  );
}

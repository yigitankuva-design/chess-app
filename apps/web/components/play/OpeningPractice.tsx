'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { FriendChallenge } from '@/components/play/FriendChallenge';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { OpeningPicker } from '@/components/play/OpeningPicker';
import type { OpeningTypeDef, Opening, OpeningVariant } from '@/components/play/OpeningPicker';
import { PathNode, Branch } from '@/components/ui/neumorphic';
import { isCriteriaUnlocked, variantSummary } from '@/lib/play/openingSteps';
import type { BotStepKey } from '@/lib/play/openingSteps';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';
import { pickDifferentPosition } from '@/lib/play/positionPool';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type { OpeningVariant, Opening, OpeningTypeDef };

interface Props {
  /**
   * Doğrudan-başlat: /play sayfası, CustomTabPanel'den yönlendirilince bunu
   * verir — seçim adımları (açılış/kriter) ATLANIR, doğrudan bu VARYANT
   * id'si ve kriterle maça girilir. İkisi de dolu değilse normal akordiyon
   * akışı çalışır (madde: 2026-08-19, güncelleme 2026-08-20).
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
 *  Dis katman: bot / arkadas. Ic katman (bot): Acilis Sec (tur -> isim ->
 *  varyant TEK ic ice akordiyonda, bkz. OpeningPicker) -> kriterler
 *  (madde: 2026-08-20, guncelleme — admin'deki drill-down akordiyonla
 *  AYNI desen; ayri numarali "tur/isim/varyant" adimlari kaldirildi). */
export function OpeningPractice({ initialVariantId, initialCriteria, onReadyToStart, tint }: Props = {}) {
  const [openOuter, setOpenOuter] = useState<'bot' | 'friend' | null>(null);
  // Madde 4: acilis listesi BASTAN gorunmez — sporcu basliga tiklamadan
  // tum acilislari gormemeli.
  const [openInner, setOpenInner] = useState<BotStepKey | null>(null);
  const [types, setTypes] = useState<OpeningTypeDef[] | null>(null);
  const [chosenType, setChosenType] = useState<OpeningTypeDef | null>(null);
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
      setTypes(Array.isArray(data) ? data : []);
    } catch {
      setTypes([]);
    }
  }, []);

  // Turler YALNIZCA bir dal acildiginda yuklenir — gereksiz istek atilmaz.
  useEffect(() => {
    if (openOuter !== null && types === null) void loadOpenings();
  }, [openOuter, types, loadOpenings]);

  // Dogrudan-baslat: dal acilmasi beklenmez, liste hemen cekilir.
  useEffect(() => {
    if (directStart && types === null) void loadOpenings();
  }, [directStart, types, loadOpenings]);

  // Dogrudan-baslat: liste gelince eslesen VARYANTI (ve onu tasiyan tur+acilisi) bul.
  useEffect(() => {
    if (!directStart || !types || chosenVariant) return;
    for (const t of types) {
      for (const o of t.openings) {
        const v = o.variants.find((vv) => vv.id === initialVariantId);
        if (v && initialCriteria) {
          setChosenType(t);
          setChosen(o);
          setChosenVariant(v);
          setCriteria(initialCriteria);
          setColor(resolveColor(initialCriteria.colorChoice));
          return;
        }
      }
    }
  }, [directStart, types, initialVariantId, initialCriteria, chosenVariant]);

  /** Dış kart (Bota Karşı / Arkadaşına Karşı) açılıp kapatılırken çağrılır.
   *  Madde 2026-08-21: "Pratiğe Başla"ya basılmadan dışarı çıkılırsa (kart
   *  kapatılırsa ya da diğer dala geçilirse) "Açılış Türü Seç" akışındaki
   *  seçimler İPTAL edilir, kayıtlı kalmaz — sporcu tekrar açtığında sıfırdan
   *  başlar. Maç zaten başladıysa (criteria dolu) bu koddan geçilmez, bu
   *  fonksiyon yalnızca seçim ekranındayken PathNode'lardan çağrılır. */
  function toggleOuter(key: 'bot' | 'friend') {
    setOpenOuter((prev) => {
      const next = prev === key ? null : key;
      setOpenInner(null);
      setChosenType(null);
      setChosen(null);
      setChosenVariant(null);
      return next;
    });
  }

  /** OpeningPicker'da varyant secilince cagirilir. */
  function handlePicked(args: { type: OpeningTypeDef; opening: Opening; variant: OpeningVariant }) {
    setChosenType(args.type);
    setChosen(args.opening);
    setChosenVariant(args.variant);
  }

  // Dogrudan-baslat: varyant bulununcaya kadar bilgilendirme goster.
  if (directStart && !(criteria && chosen && chosenVariant)) {
    if (types === null) return <p className="text-sm t-muted">Yükleniyor…</p>;
    const found = types.some((t) => t.openings.some((o) => o.variants.some((v) => v.id === initialVariantId)));
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
            if (chosenType === null) return;
            const pool = chosenType.openings.flatMap(
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
          onClick={() => toggleOuter('bot')}
        />
        {/* Madde 2026-08-21: "Bota Karşı Pratik Yap" açılınca gelen adımların
            cümleleri her durumda (açık/kapalı) BEYAZ kalsın diye tint sabit
            "#fff" verilir — önceden açıkken accent rengine dönüyordu. */}
        {openOuter === 'bot' && (
          <Branch offset={20}>
            <div>
              <PathNode
                icon="📖"
                label="1. Açılış Seç"
                trailing={variantSummary(chosenVariant?.name ?? null) ? (
                  <span className="text-xs t-muted">{variantSummary(chosenVariant?.name ?? null)}</span>
                ) : undefined}
                active={openInner === 'opening'}
                size={34}
                tint="#fff"
                onClick={() => setOpenInner((p) => (p === 'opening' ? null : 'opening'))}
              />
              {openInner === 'opening' && (
                <Branch offset={17}>
                  <OpeningPicker types={types} onPicked={(args) => {
                    handlePicked(args);
                    setOpenInner('criteria');
                  }} />
                </Branch>
              )}
            </div>

            <div>
              <PathNode
                icon="🎯"
                label="2. Maç Kriterlerini Seç"
                active={openInner === 'criteria'}
                locked={!isCriteriaUnlocked(chosenVariant?.name ?? null)}
                size={34}
                tint="#fff"
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
          onClick={() => toggleOuter('friend')}
        />
        {openOuter === 'friend' && (
          /* Sira: 1) Acilis Sec (tur->isim->varyant ic ice) 2) Kriterler
             3) Arkadas. FriendChallenge kendi ic adimlarini HALA StepCard ile
             cizer — o bilesen ayrica "Arkadasla Oyna" (Pratik Yap'la ilgisiz)
             akisinda da kullanildigi icin degistirilmedi (2026-08-19 kapsam
             karari), yalnizca acilis secim adimi tekile indirgendi (2026-08-20). */
          <Branch offset={20}>
            <FriendChallenge
              openingStep={{
                renderPicker: (onPicked) => (
                  <OpeningPicker types={types} onPicked={(args) => {
                    handlePicked(args);
                    onPicked();
                  }} />
                ),
                summary: variantSummary(chosenVariant?.name ?? null),
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

'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { FriendChallenge } from '@/components/play/FriendChallenge';
import { OpeningPicker } from '@/components/play/OpeningPicker';
import type { OpeningTypeDef, Opening, OpeningVariant } from '@/components/play/OpeningPicker';
import { PathNode, Branch } from '@/components/ui/neumorphic';
import { isColorUnlocked, isMoveLimitUnlocked, variantSummary, colorSummary } from '@/lib/play/openingSteps';
import type { BotStepKey } from '@/lib/play/openingSteps';
import { COLOR_CHOICES, resolveColor } from '@/lib/play/color';
import type { ColorChoice, PieceColor } from '@/lib/play/color';
import { MOVE_LIMIT_OPTIONS } from '@/lib/play/moveLimit';
import type { MoveLimit, OpeningAdvanceCriteria } from '@/lib/play/moveLimit';
import { pickDifferentPosition } from '@/lib/play/positionPool';
import { useSettings } from '@/lib/settings/settings-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type { OpeningVariant, Opening, OpeningTypeDef };

interface Props {
  /**
   * Madde (devam): a) Açılışı Tahmin Et / b) Açılış Teorisini Hatırla artık
   * akordiyon AÇMIYOR — tıklanınca ARA EKRAN (Yükleniyor/Pratiğe Başla)
   * olmadan DOĞRUDAN bu callback çağrılır, navigasyon CustomTabPanel'e
   * bırakılır. Verilmemişse (örn. /play sayfasından initialVariantId ile
   * doğrudan geliniyorsa a/b/c katmanı zaten hiç render edilmiyor) tıklama
   * hiçbir şey yapmaz.
   */
  onOpenKonumPratigi?: () => void;
  onOpenTeoriPratigi?: () => void;
  /**
   * Doğrudan-başlat: /play sayfası, CustomTabPanel'den yönlendirilince bunu
   * verir — seçim adımları (açılış/renk/ilerleme sınırı) ATLANIR, doğrudan
   * bu VARYANT id'si ve kriterle maça girilir. İkisi de dolu değilse normal
   * akordiyon akışı çalışır (madde: 2026-08-19, güncelleme 2026-08-20,
   * 2026-09-06 üçüncü tur).
   */
  initialVariantId?: number;
  initialCriteria?: OpeningAdvanceCriteria;
  /**
   * Verilirse, kriter seçilip "Pratiğe Başla"ya tıklanınca BotGame BURADA
   * render EDİLMEZ — bunun yerine bu callback çağrılır, navigasyon çağırana
   * bırakılır. CustomTabPanel bunu kullanarak sporcuyu /play sayfasına
   * yönlendirir (pratik ayrı sayfada oynanır). Verilmezse (örn. /play
   * sayfasının kendisi) maç eskisi gibi burada açılır.
   */
  onReadyToStart?: (variant: OpeningVariant, criteria: OpeningAdvanceCriteria) => void;
}

/** MatchCriteria.tsx'teki AYNI pill deseni — burada standalone (Renk Seç/
 *  İlerleme Sınırı Belirle artık o bileşeni KULLANMIYOR, bkz. madde
 *  2026-09-06 üçüncü tur/4: Düzey/Tempo kalktı). */
function pill(active: boolean) {
  return {
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  } as const;
}

/** Acilis pratigi: sirali ve kilitli acilir kartlar (akordiyon).
 *  Dis katman: bot / arkadas. Ic katman (bot): Acilis Sec (tur -> isim ->
 *  varyant TEK ic ice akordiyonda, bkz. OpeningPicker) -> Renk Sec ->
 *  Ilerleme Siniri Belirle (madde: 2026-08-20, guncelleme; 2026-09-06
 *  ucuncu tur — eskiden ikisi "Mac Kriterlerini Sec" ATLI tek adimda,
 *  Duzey/Tempo dahil MatchCriteria uzerinden yapiliyordu; Zafer'in onayiyla
 *  Duzey sabit 10. seviyede kaldi, Tempo tamamen kalkti, yerine hamle
 *  sinirlama geldi).
 *  Madde 2026-08-21: etiketler artik HER ZAMAN sabit (var(--t-text-1),
 *  madde 2026-09-02'de #fff'ten degistirildi — acik temalarda gorunmuyordu)
 *  — eskiden disaridan gelen `tint` (Pratik Yap kartinin rengi) kullaniliyordu,
 *  o prop kaldirildi. */
export function OpeningPractice({
  initialVariantId, initialCriteria, onReadyToStart,
  onOpenKonumPratigi, onOpenTeoriPratigi,
}: Props = {}) {
  const { settings } = useSettings();
  // Madde 2026-09-02: Zafer'in şemasına göre "Açılış Pratiği Yap" 3 dala
  // ayrıldı — a) Açılışı Tahmin Et, b) Açılış Teorisini Hatırla (madde devam:
  // tıklanınca akordiyon AÇILMAZ, doğrudan pratiğe geçilir — bkz.
  // onOpenKonumPratigi/onOpenTeoriPratigi), c) Açılış Konumunu İlerlet
  // (aşağıdaki MEVCUT Bota Karşı/Arkadaşına Karşı akışı, bir seviye içeri
  // taşındı — TEK bu dal akordiyon olarak açılır). directStart modu
  // (aşağıda) bu katmanı ATLAR — /play sayfasından doğrudan varyantla
  // gelindiğinde a/b/c hiç gösterilmez.
  const [openMode, setOpenMode] = useState<'uygulama' | null>(null);
  const [openOuter, setOpenOuter] = useState<'bot' | 'friend' | null>(null);
  // Madde 4: acilis listesi BASTAN gorunmez — sporcu basliga tiklamadan
  // tum acilislari gormemeli.
  const [openInner, setOpenInner] = useState<BotStepKey | null>(null);
  const [types, setTypes] = useState<OpeningTypeDef[] | null>(null);
  const [chosenType, setChosenType] = useState<OpeningTypeDef | null>(null);
  const [chosen, setChosen] = useState<Opening | null>(null);
  const [chosenVariant, setChosenVariant] = useState<OpeningVariant | null>(null);
  // 2./3. adımların GEÇİCİ seçimleri — "Pratiğe Başla"ya kadar `criteria`'ya taşınmaz.
  const [colorChoice, setColorChoice] = useState<ColorChoice | null>(null);
  const [moveLimit, setMoveLimit] = useState<MoveLimit | null>(null);
  const [criteria, setCriteria] = useState<OpeningAdvanceCriteria | null>(null);
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
      setColorChoice(null);
      setMoveLimit(null);
      return next;
    });
  }

  /** OpeningPicker'da varyant secilince cagirilir. */
  function handlePicked(args: { type: OpeningTypeDef; opening: Opening; variant: OpeningVariant }) {
    setChosenType(args.type);
    setChosen(args.opening);
    setChosenVariant(args.variant);
  }

  function startPractice() {
    // Kilit yalnizca gorsel degil: varyant/renk/sinir yoksa mac hic baslamaz.
    if (!chosenVariant || !colorChoice || !moveLimit) return;
    const value: OpeningAdvanceCriteria = { colorChoice, moveLimit };
    if (onReadyToStart) { onReadyToStart(chosenVariant, value); return; }
    setCriteria(value);
    setColor(resolveColor(colorChoice));
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
    // Madde 2026-09-06 (üçüncü tur/4): Düzey artık seçilmiyor — Zafer'in
    // onayıyla sabit "10. seviye" (en zor) kullanılır, Tempo/Süre hiç
    // gösterilmez (timeControl verilmez → BotGame süresiz oynar).
    const level = settings.play.levels[9];
    return (
      <BotGame
        key={matchKey}
        skillLevel={level.skill}
        depth={level.depth}
        blunderChance={level.blunderChance}
        studentColor={color}
        startFen={chosenVariant.start_fen}
        moveLimit={criteria.moveLimit}
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
          icon="🎯"
          label="a) Açılışı Tahmin Et"
          active={false}
          size={40}
          tint="var(--t-text-1)"
          onClick={() => onOpenKonumPratigi?.()}
        />
      </div>

      <div>
        <PathNode
          icon="📚"
          label="b) Açılış Teorisini Hatırla"
          active={false}
          size={40}
          tint="var(--t-text-1)"
          onClick={() => onOpenTeoriPratigi?.()}
        />
      </div>

      <div>
        <PathNode
          icon="♟️"
          label="c) Açılış Konumunu İlerlet"
          active={openMode === 'uygulama'}
          size={40}
          tint="var(--t-text-1)"
          onClick={() => setOpenMode((p) => (p === 'uygulama' ? null : 'uygulama'))}
        />
        {openMode === 'uygulama' && (
          <Branch offset={20}>
            <div className="grid gap-3">
              <div>
                <PathNode
                  icon="🤖"
                  label="Bota Karşı Pratik Yap"
                  active={openOuter === 'bot'}
                  size={40}
                  tint="var(--t-text-1)"
                  onClick={() => toggleOuter('bot')}
                />
                {/* Madde 2026-08-21: "Bota Karşı Pratik Yap" açılınca gelen adımların
                    cümleleri her durumda (açık/kapalı) SABİT kalsın diye tint verilir
                    — önceden açıkken accent rengine dönüyordu. Madde 2026-09-02:
                    sabit değer "#fff" idi, açık temalarda (Klasik/Sakin) beyaz zemin
                    üstünde beyaz yazı görünmez oluyordu — var(--t-text-1) ile
                    değiştirildi (her temada okunaklı, hâlâ accent'e dönmez). */}
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
                        tint="var(--t-text-1)"
                        onClick={() => setOpenInner((p) => (p === 'opening' ? null : 'opening'))}
                      />
                      {openInner === 'opening' && (
                        <Branch offset={17}>
                          <OpeningPicker types={types} onPicked={(args) => {
                            handlePicked(args);
                            setOpenInner('color');
                          }} />
                        </Branch>
                      )}
                    </div>

                    <div>
                      <PathNode
                        icon="🎨"
                        label="2. Renk Seç"
                        trailing={colorSummary(colorChoice) ? (
                          <span className="text-xs t-muted">{colorSummary(colorChoice)}</span>
                        ) : undefined}
                        active={openInner === 'color'}
                        locked={!isColorUnlocked(chosenVariant?.name ?? null)}
                        size={34}
                        tint="var(--t-text-1)"
                        onClick={() => setOpenInner((p) => (p === 'color' ? null : 'color'))}
                      />
                      {openInner === 'color' && (
                        <Branch offset={17}>
                          <div className="t-card-i p-4">
                            <div className="grid grid-cols-3 gap-2">
                              {COLOR_CHOICES.map((c) => (
                                <button key={c.value} type="button"
                                  onClick={() => { setColorChoice(c.value); setOpenInner('moveLimit'); }}
                                  className="py-3 rounded-xl text-sm font-bold transition-all"
                                  style={pill(colorChoice === c.value)}>
                                  {c.emoji} {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </Branch>
                      )}
                    </div>

                    <div>
                      <PathNode
                        icon="🔢"
                        label="3. İlerleme Sınırı Belirle"
                        active={openInner === 'moveLimit'}
                        locked={!isMoveLimitUnlocked(colorChoice)}
                        size={34}
                        tint="var(--t-text-1)"
                        onClick={() => setOpenInner((p) => (p === 'moveLimit' ? null : 'moveLimit'))}
                      />
                      {openInner === 'moveLimit' && (
                        <Branch offset={17}>
                          <div className="space-y-3">
                            <div className="t-card-i p-4">
                              <div className="grid grid-cols-3 gap-2">
                                {MOVE_LIMIT_OPTIONS.map((n) => (
                                  <button key={n} type="button" onClick={() => setMoveLimit(n)}
                                    className="py-3 rounded-xl text-sm font-bold transition-all"
                                    style={pill(moveLimit === n)}>
                                    {n} Hamle İlerle
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button type="button" disabled={!moveLimit} onClick={startPractice}
                              className="w-full py-3.5 rounded-xl text-base font-bold transition-all shadow-sm disabled:opacity-40"
                              style={{ background: 'var(--t-accent)', color: '#fff' }}>
                              ▶️ Pratiğe Başla
                            </button>
                          </div>
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
                  tint="var(--t-text-1)"
                  onClick={() => toggleOuter('friend')}
                />
                {openOuter === 'friend' && (
                  /* Sira: 1) Acilis Sec (tur->isim->varyant ic ice) 2) Kriterler
                     3) Arkadas. FriendChallenge kendi ic adimlarini HALA StepCard ile
                     cizer — o bilesen ayrica "Arkadasla Oyna" (Pratik Yap'la ilgisiz)
                     akisinda da kullanildigi icin degistirilmedi (2026-08-19 kapsam
                     karari), yalnizca acilis secim adimi tekile indirgendi (2026-08-20).
                     Madde 2026-09-06 (üçüncü tur): "Bota Karşı Pratik Yap"'ın Renk/
                     İlerleme Sınırı restrukturu buraya UYGULANMAZ — FriendChallenge
                     kendi MatchCriteria akışını KULLANMAYA devam eder. */
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
          </Branch>
        )}
      </div>
    </div>
  );
}

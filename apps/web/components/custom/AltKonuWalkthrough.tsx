'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import type { PositionPoolEntry } from '@/lib/customTabsApi';
import { useAuth } from '@/lib/auth-context';

interface Props {
  pool: PositionPoolEntry[];
  /**
   * "Ödev Gönder" düğmesi SADECE antrenör (`role === 'teacher'`) bu Alt
   * Konu'yu görüntülerken ve bu proplar verilmişken gösterilir — çocuk
   * kendi "Hızlı Erişim" görünümünde düğmeyi GÖRMEZ.
   * (bkz. app/(child)/custom/[id]/alt-konu/[sectionId]/page.tsx)
   */
  sourceSectionId?: number;
  sourceSectionTitle?: string;
  /** Madde 2026-09-11 (Ödev Sistemi Faz 3): "Ödev Gönder"e basınca gidilecek
   *  "Ödev Gönder" sayfasının URL'i için özel sekmenin id'si. */
  sourceTabId?: number;
  /**
   * Madde 2026-09-11 (Ödev Sistemi Faz 2): bu Alt Konu'nun Dersler
   * müfredatındaki karşılığı (LessonStep id). null/undefined ise "Ödev
   * Gönder" düğmesi DEVRE DIŞI görünür ("bu alt konu müfredata bağlı değil")
   * — admin panelden (Sekmeler › Çalışmalar › Dersler › Alt Konu) bağlanması
   * gerekir.
   */
  linkedLessonStepId?: number | null;
  /**
   * Madde 2026-09-09 (görsel referans): "1/1 — Konum Havuzu 001" sayacı
   * artık sayfa başlığının YANINDA gösteriliyor (bkz. alt-konu/[sectionId]/
   * page.tsx). Bu callback verilirse bileşen sayacı KENDİ İÇİNDE ARTIK
   * GÖSTERMEZ — değeri üst bileşene bildirir, başlığın yanına O basar.
   * VERİLMEZSE (eski/standalone kullanım, testler) sayaç eskisi gibi tahtanın
   * ÜSTÜNDE kendi içinde gösterilir — KURAL #3, geriye uyumlu.
   */
  onPoolLabelChange?: (label: string | null) => void;
}

/** Madde 2026-09-07 (GRUP D): özel tasarım "gönder" ikonu (kağıt uçak) —
 *  internetten alınmamış, ChatIcon/PhoneIcon ile AYNI çizgi-ikon ailesi.
 *  Madde 2026-09-11 (Görsel Turu A/1): buton telefona sığsın diye
 *  küçülünce ikon da orantılı küçüldü (25px → 22px). */
function SendHomeworkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l16-8-6 16-3-6-7-2z" />
      <path d="M20 4l-9 9" />
    </svg>
  );
}

/** Madde 2026-09-09 (devam): Zafer'in gönderdiği görsel referanstaki gibi
 *  KALIN, net görünen ok — eski ince ‹ › karakterleri antrenörün telefonunda
 *  net görünmüyordu (aynı gerekçe: madde 2026-09-07'deki adım dairesi
 *  renk değişikliği). Özel çizim (internetten alınmamış). Madde 2026-09-09
 *  (devam 3): gruplar arası geçiş oku AYNI ikonu KÜÇÜK boyutta kullanır. */
function ChevronIcon({ direction, size = 22 }: { direction: 'left' | 'right'; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#0a0a0a" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

/** Madde 2026-09-11 (Görsel Turu A/1): tahtanın altındaki 5 buton (2 adım
 *  oku + Ödev Gönder + 2 konum oku) eskiden 80×56 / 50×50 sabit pikseldi —
 *  telefon genişliğine (≈330px içerik) SIĞMIYOR, en sağdaki turuncu ok
 *  ekrandan taşıp kesiliyordu (Zafer'in görseli). Küçültüldü: 4×56 + 44 +
 *  boşluklar ≈ 300px, tek satıra sığar; geniş ekranda justify-between
 *  tahtanın genişliğine eşit aralıkla yayılır. Ödev Gönder oklarla AYNI
 *  yükseklikte (44 ≈ 40+çerçeve) ortada durur. Renk/sıra DEĞİŞMEDİ. */
const ARROW_BTN_WIDTH = 56;
const ARROW_BTN_HEIGHT = 40;

/** Madde 2026-09-10: Zafer'in isteğiyle "Konum Havuzu" (gruplar/sorular)
 *  arası geçiş okları artık satırın SAĞINDA (Ödev Gönder'in sağında),
 *  adım oklarıyla AYNI boyutta ama AYRI renkte (turuncu) — böylece sol
 *  (adım) ve sağ (konum) navigasyonu görsel olarak ayrışıyor. */
const GROUP_ARROW_BG = '#f97316';

/** Bkz. ARROW_BTN_* açıklaması — Ödev Gönder de aynı sebeple küçüldü (50 → 44). */
const SEND_HOMEWORK_BTN_SIZE = 44;

/** Madde 2026-08-25: tahta büyütüldü (240px → 420px). Madde 2026-09-10
 *  (2. görsel): Zafer'in isteğiyle tahta bir kez daha büyütülüp sayfanın
 *  tamamını kaplayacak şekilde konumlandırıldı (420px → 640px, ChessBoard'un
 *  kendi iç max-w-[640px] sınırıyla AYNI). */
const BOARD_MAX_WIDTH = 640;

/** Madde 2026-09-10 (2. görsel): adım daireleri artık tahtanın ÜSTÜNDE
 *  YATAY bir sıra — Zafer'in isteği. Daireler de büyütüldü (40px → 52px). */
const STEP_CIRCLE_SIZE = 52;

/**
 * Alt Konu'nun ayrı sayfasındaki tasarım — madde: 2026-08-26 (görsel
 * referans doğrultusunda). Konum Havuzu İKİ SEVİYELİ (grup/adım):
 *  - Madde 2026-09-10 (2. görsel): numaralı adım daireleri artık tahtanın
 *    ÜSTÜNDE yatay bir sırada (eskiden tahtanın solunda dikey sütundaydı).
 *    Bu daireler VE tahtanın altındaki SOL İleri/Geri okları (mavi): aktif
 *    grubun İÇİNDEKİ adımlar arasında AYNI stepIdx'i değiştirir.
 *  - Madde 2026-09-10: tahtanın altındaki SAĞ İleri/Geri okları (turuncu),
 *    "Konum Havuzu" grupları (farklı kodlar, ör. 001→002) arasında gezinir —
 *    Zafer'in "sağdaki oklar konum havuzundaki sorular arası geçiş" isteği.
 *    HER ZAMAN gösterilir (tek grup olsa bile — Zafer'in "ödev gönder
 *    kartının sağına da ok koy" isteği); gidilecek grup yoksa DEVRE DIŞI.
 * Tahta ve alt yazı, aktif grubun aktif adımını gösterir.
 */
export function AltKonuWalkthrough({ pool, sourceSectionId, sourceSectionTitle, sourceTabId, linkedLessonStepId, onPoolLabelChange }: Props) {
  const auth = useAuth();
  const router = useRouter();
  const [groupIdx, setGroupIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  /** Madde 2026-08-25: bu sayfaya ÖZEL, YEREL bir tercih — BotGame/LiveGame'in
   *  paylaşılan (localStorage) "Notasyon Verilerini Gizle" tercihiyle KARIŞMAZ
   *  (bkz. lib/board-notation-context.tsx: "ders/bulmaca tahtaları bu tercihi
   *  kullanmaz" — KURAL #3, mevcut maç ekranları etkilenmesin diye). */
  const [hideNotation, setHideNotation] = useState(false);

  // Madde 2026-09-09: erken return'den (hook kuralı) ÖNCE, pool boşken de
  // güvenli şekilde hesaplanır — onPoolLabelChange'e o durumda null bildirilir.
  const codes = assignExerciseCodes(pool.map((p) => ({ code: p.code ?? undefined })));
  const gi = pool.length > 0 ? Math.min(groupIdx, pool.length - 1) : 0;
  const group = pool[gi];
  const si = pool.length > 0 ? Math.min(stepIdx, group.steps.length - 1) : 0;
  const step = pool.length > 0 ? group.steps[si] : undefined;
  const poolLabel = pool.length > 0 ? `${gi + 1} / ${pool.length} — Konum Havuzu ${group.code ?? codes[gi]}` : null;

  useEffect(() => {
    onPoolLabelChange?.(poolLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolLabel]);

  if (pool.length === 0) {
    return <p className="t-muted text-sm">Henüz konum eklenmedi.</p>;
  }

  // Madde 2026-09-09 (devam): "1 nolu butondan 2 nolu butona" — okların
  // görevi artık numaralı butonlarla (solundaki adım daireleri) AYNI
  // stepIdx'i değiştirmek, gruplar arasında DEĞİL (bkz. dosya başı açıklama).
  function goToStep(delta: 1 | -1) {
    setStepIdx((i) => Math.min(group.steps.length - 1, Math.max(0, Math.min(i, group.steps.length - 1) + delta)));
  }

  // Madde 2026-09-09 (devam 3): gruplar (farklı "Konum Havuzu" kodları)
  // arasında geçiş — grup değişince adım sayacı İLK adıma döner (yeni
  // grubun kendi adım listesi baştan gösterilir).
  function goToGroup(delta: 1 | -1) {
    setGroupIdx((i) => Math.min(pool.length - 1, Math.max(0, Math.min(i, pool.length - 1) + delta)));
    setStepIdx(0);
  }

  // "Ödev Gönder" düğmesi tahtanın SAĞ ALT köşesindeki satırda — SADECE
  // antrenör + kaynak bölüm verilmişken görünür.
  const showSendHomework = auth.role === 'teacher' && sourceSectionId != null && sourceSectionTitle != null;
  // Madde 2026-09-11 (Ödev Sistemi Faz 2): Alt Konu müfredata bağlı değilse
  // "Ödev Gönder" tıklanamaz — admin panelden bağlanması gerekir.
  const homeworkLinked = linkedLessonStepId != null;

  // Madde 2026-09-11 (Ödev Sistemi Faz 3): "Ödev Gönder" artık popup değil,
  // AYRI bir "Ödev Gönder" sayfasına yönlendirir (Zafer'in isteği).
  function goToSendHomework() {
    const params = new URLSearchParams({ section: String(sourceSectionId) });
    if (sourceTabId != null) params.set('tab', String(sourceTabId));
    router.push(`/coach/odev-gonder?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      {/* Madde 2026-09-10 (2. görsel): adım daireleri artık tahtanın ÜSTÜNDE
          YATAY bir sıra (eskiden tahtanın solunda dikey sütundaydı) —
          Zafer'in "dairesel kartları tahtanın üstüne taşı" isteği. Kalın
          siyah çerçeve + seçilide yeşil dolgu (görsel referans). */}
      {group.steps.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {group.steps.map((s, i) => {
            const active = i === si;
            return (
              <button key={s.id} type="button"
                aria-label={`Adım ${i + 1}`}
                aria-pressed={active}
                onClick={() => setStepIdx(i)}
                className="flex items-center justify-center rounded-full text-sm flex-shrink-0 transition-colors"
                style={{
                  width: STEP_CIRCLE_SIZE, height: STEP_CIRCLE_SIZE,
                  // Madde 2026-09-07: seçili daire yeşil zemin + kalın siyah rakam.
                  // Madde 2026-09-10 (2. görsel): çerçeve kalınlaştırıldı (2px → 3px),
                  // seçili OLMAYAN daire artık KALIN SİYAH çerçeveli (görselde öyle) —
                  // eski soluk yarı-saydam beyaz çerçeve açık zeminde görünmüyordu.
                  border: active ? '3px solid #16a34a' : '3px solid #0a0a0a',
                  background: active ? '#22c55e' : 'transparent',
                  color: active ? '#0a0a0a' : undefined,
                  fontWeight: active ? 800 : 700,
                }}>
                {i + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Madde 2026-09-10 (2. görsel): tahta sayfanın tamamını kaplayacak
          şekilde büyütüldü. Sayaç SADECE standalone kullanımda (onPoolLabelChange
          yokken) burada tahtanın üstünde — entegre sayfada başlığın yanında. */}
      <div style={{ maxWidth: BOARD_MAX_WIDTH, width: '100%' }} className="mx-auto space-y-2">
        {!onPoolLabelChange && (
          <p className="text-xs t-muted" style={{ fontWeight: 600 }}>{poolLabel}</p>
        )}

        <ChessBoard fen={step!.fen} highlightSquares={[] as Square[]} hideNotation={hideNotation} />

        {/* Madde 2026-09-09 (görsel referans): İleri/Geri tahtanın SOL ALT
            köşesinde, "Ödev Gönder" ORTADA, "Konum Havuzu" okları SAĞDA —
            AYNI satır (justify-between). */}
        <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {/* Madde 2026-09-09 (devam): Zafer'in bildirdiği "okların rengi
                  belirgin değil, boyutu çok küçük" sorunu — ince ‹ › karakteri
                  + soluk çerçeve YERİNE görsel referanstaki gibi büyük, dolgun
                  mavi zemin + kalın siyah çerçeve + kalın siyah ok ikonu.
                  Madde 2026-09-09 (devam 2): oklar artık solundaki numaralı
                  butonlarla (Adım N) AYNI stepIdx'i değiştirir — antrenör
                  ister butona tıklayarak ister okla aynı adıma geçebilir. */}
              <button type="button" aria-label="Önceki adım" onClick={() => goToStep(-1)}
                disabled={si === 0}
                className="flex items-center justify-center rounded-xl transition-colors disabled:opacity-30"
                style={{
                  width: ARROW_BTN_WIDTH, height: ARROW_BTN_HEIGHT,
                  background: '#3b82f6', border: '3px solid #0a0a0a',
                }}>
                <ChevronIcon direction="left" />
              </button>
              <button type="button" aria-label="Sonraki adım" onClick={() => goToStep(1)}
                disabled={si >= group.steps.length - 1}
                className="flex items-center justify-center rounded-xl transition-colors disabled:opacity-30"
                style={{
                  width: ARROW_BTN_WIDTH, height: ARROW_BTN_HEIGHT,
                  background: '#3b82f6', border: '3px solid #0a0a0a',
                }}>
                <ChevronIcon direction="right" />
              </button>
            </div>

            {/* Madde 2026-09-11 (Ödev Sistemi Faz 3): "Ödev Gönder" — SADECE
                antrenör görünümünde. Artık popup DEĞİL: ayrı "Ödev Gönder"
                sayfasına yönlendirir (sınıf sekmeleri → öğrenci seçimi →
                tarihler → not → gönder). Satırın ORTASINDA (adım okları
                solda, konum okları sağda). YEŞİL zemin (Zafer'in görseli). */}
            {showSendHomework && homeworkLinked && (
              <button
                type="button" onClick={goToSendHomework}
                aria-label="Ödev Gönder"
                title="Ödev Gönder"
                className="rounded-xl flex items-center justify-center transition-colors"
                style={{
                  width: SEND_HOMEWORK_BTN_SIZE, height: SEND_HOMEWORK_BTN_SIZE,
                  background: '#22c55e', border: '3px solid #0a0a0a',
                }}
              >
                <SendHomeworkIcon />
              </button>
            )}
            {/* Madde 2026-09-11 (Ödev Sistemi Faz 2): Alt Konu müfredata bağlı
                değilse "Ödev Gönder" DEVRE DIŞI — admin (Sekmeler › Çalışmalar ›
                Dersler › Alt Konu › Müfredat Köprüsü) bağlamalı. */}
            {showSendHomework && !homeworkLinked && (
              <button
                type="button" disabled
                aria-label="Ödev Gönder — bu alt konu müfredata bağlı değil"
                title="Bu alt konu müfredata bağlı değil — yönetici panelinden bağlanmalı"
                className="rounded-xl flex items-center justify-center opacity-40 cursor-not-allowed"
                style={{
                  width: SEND_HOMEWORK_BTN_SIZE, height: SEND_HOMEWORK_BTN_SIZE,
                  background: '#6b7280', border: '3px solid #0a0a0a',
                }}
              >
                <SendHomeworkIcon />
              </button>
            )}

            {/* Madde 2026-09-10: SAĞDAKİ İleri/Geri — "Konum Havuzu" grupları
                (farklı kodlar, ör. 001→002) arasında gezinir. Zafer'in isteği:
                "sağdaki oklar konum havuzundaki sorular arası geçiş sağlayacak".
                Adım oklarıyla AYNI boyut ama TURUNCU zemin (görsel ayrışma).
                Madde 2026-09-10 (devam): Zafer "ödev gönder kartının sağına da
                ok koy" dedi — artık TEK grup olsa bile HER ZAMAN gösterilir
                (5 kartlık düzen sabit), gidilecek grup yoksa ok DEVRE DIŞI. */}
            <div className="flex gap-2">
              <button type="button" aria-label="Önceki grup" onClick={() => goToGroup(-1)}
                disabled={gi === 0}
                className="flex items-center justify-center rounded-xl transition-colors disabled:opacity-30"
                style={{
                  width: ARROW_BTN_WIDTH, height: ARROW_BTN_HEIGHT,
                  background: GROUP_ARROW_BG, border: '3px solid #0a0a0a',
                }}>
                <ChevronIcon direction="left" />
              </button>
              <button type="button" aria-label="Sonraki grup" onClick={() => goToGroup(1)}
                disabled={gi >= pool.length - 1}
                className="flex items-center justify-center rounded-xl transition-colors disabled:opacity-30"
                style={{
                  width: ARROW_BTN_WIDTH, height: ARROW_BTN_HEIGHT,
                  background: GROUP_ARROW_BG, border: '3px solid #0a0a0a',
                }}>
                <ChevronIcon direction="right" />
              </button>
            </div>
          </div>
        </div>

      {/* Madde 2026-09-10: Zafer'in isteğiyle cümle alanı (ve altındaki
          notasyon alanı, ikisi görselde AYNI genişlikte) yatay olarak
          uzatıldı — artık sayfa kabının (max-w-2xl) tamamını kaplıyor,
          eskiden tahta+numaralı buton genişliğiyle (472px) sınırlıydı. */}
      <div className="t-card-i p-3 w-full">
        <p className="text-sm text-center">{step!.sentence}</p>
      </div>

      {/* Madde 2026-08-25: en altta ayrı bir notasyon alanı — tahta
          koordinatları + "Notasyon Verilerini Gizle" kutusu. */}
      <div className="t-card-i p-3 w-full">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold t-muted uppercase tracking-widest">Notasyon alanı</p>
          <label className="flex items-center gap-1.5 text-xs t-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideNotation}
              onChange={() => setHideNotation((v) => !v)}
              aria-label="Notasyon Verilerini Gizle"
              className="h-3.5 w-3.5"
              style={{ accentColor: 'var(--t-accent)' }}
            />
            Notasyon Verilerini Gizle
          </label>
        </div>
      </div>
    </div>
  );
}

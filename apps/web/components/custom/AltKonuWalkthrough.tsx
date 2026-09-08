'use client';
import { useState, useEffect } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import type { PositionPoolEntry } from '@/lib/customTabsApi';
import { useAuth } from '@/lib/auth-context';
import { AssignHomeworkPanel } from '@/components/admin/AssignHomeworkPanel';

interface Props {
  pool: PositionPoolEntry[];
  /**
   * Madde 2026-09-07 (GRUP D): "Ödev Gönder" ikonu SADECE antrenör (`role
   * === 'teacher'`) bu Alt Konu'yu görüntülerken ve bu iki prop verilmişken
   * gösterilir — çocuk kendi "Hızlı Erişim" görünümünde ikonu GÖRMEZ.
   * (bkz. app/(child)/custom/[id]/alt-konu/[sectionId]/page.tsx)
   */
  sourceSectionId?: number;
  sourceSectionTitle?: string;
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
 *  Madde 2026-09-09 (devam 3): Zafer'in isteğiyle buton %40 büyütülünce
 *  (36px → 50px) ikon da AYNI oranda büyütüldü — yoksa büyük butonun
 *  içinde eski küçük ikon boşlukta kalırdı. */
function SendHomeworkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
function ChevronIcon({ direction, size = 26 }: { direction: 'left' | 'right'; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#0a0a0a" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

/** Madde 2026-09-09 (devam): İleri/Geri butonlarının boyutu — görsel
 *  referanstaki oklarla AYNI oranda (tahtanın 420px genişliğine göre
 *  ölçeklendirilmiş). Eski 32×32px daireden ÇOK daha büyük ve belirgin. */
const ARROW_BTN_WIDTH = 80;
const ARROW_BTN_HEIGHT = 56;

/** Madde 2026-09-09 (devam 3): gruplar arası ("Konum Havuzu" kodları
 *  arasında) geçiş oku — adım oklarından (ARROW_BTN_*) KÜÇÜK, ikincil bir
 *  kontrol olduğu için (çoğu bölümde tek grup var). AYNI mavi/siyah aile. */
const GROUP_ARROW_SIZE = 44;

/** Madde 2026-09-09 (devam 3): "Ödev Gönder" butonu Zafer'in isteğiyle
 *  %40 büyütüldü (36px → 50px, bkz. SendHomeworkIcon'daki AYNI oran). */
const SEND_HOMEWORK_BTN_SIZE = 50;

/** Madde 2026-08-25: tahta %75 büyütüldü (240px → 420px) — antrenör
 *  öğrencilerine gösterirken daha net görünsün. Adım butonları da bu
 *  yükseklikte doluşur, taşınca 2. sütuna geçer. */
const BOARD_MAX_WIDTH = 420;

/** Madde 2026-08-29: sayaç satırının yüksekliği (İleri/Geri butonları 32px,
 *  w-8/h-8) + altındaki space-y-2 boşluğu (8px) — numaralı buton sütununu bu
 *  kadar aşağı kaydırınca 1 nolu kart tahtanın üst kenarıyla hizalanır. */
const COUNTER_ROW_OFFSET = 32 + 8;

/**
 * Alt Konu'nun ayrı sayfasındaki tasarım — madde: 2026-08-26 (görsel
 * referans doğrultusunda). Konum Havuzu İKİ SEVİYELİ (grup/adım):
 *  - Solundaki numaralı butonlar VE büyük İleri/Geri okları: aktif grubun
 *    İÇİNDEKİ adımlar arasında AYNI stepIdx'i değiştirir (madde 2026-09-09
 *    devam) — antrenör ister butona tıklayarak ister okla geçer.
 *  - Madde 2026-09-09 (devam 3): satırın ORTASINDAKİ küçük ok çifti,
 *    gruplar (farklı "Konum Havuzu" kodları, ör. 001→002) arasında gezinir.
 * Tahta ve alt yazı, aktif grubun aktif adımını gösterir.
 */
export function AltKonuWalkthrough({ pool, sourceSectionId, sourceSectionTitle, onPoolLabelChange }: Props) {
  const auth = useAuth();
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

  // Madde 2026-09-09 (GRUP D'nin devamı): "Ödev Gönder" tetikleyicisi artık
  // tahtanın SAĞ ALT köşesindeki satırda — koşulu (SADECE antrenör +
  // kaynak bölüm verilmiş) burada bir kez hesaplayıp hem o satırda hem
  // (varsa gelecekte) başka yerde kullanmak için değişkene alıyoruz.
  const showSendHomework = auth.role === 'teacher' && sourceSectionId != null && sourceSectionTitle != null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-center gap-3">
        {group.steps.length > 1 && (
          <div
            className="flex flex-col flex-wrap gap-2 flex-shrink-0"
            style={{
              maxHeight: BOARD_MAX_WIDTH,
              // Madde 2026-09-09: sayaç ARTIK sadece standalone kullanımda
              // (onPoolLabelChange verilmediğinde) tahtanın üstünde — o
              // zaman kayma eskisi gibi gerekli. Entegre sayfada (callback
              // verilmişken) sayaç YUKARI (başlığın yanına) taşındığı için
              // tahta doğrudan sütunun tepesinden başlar, kayma GEREKMEZ.
              marginTop: onPoolLabelChange ? 0 : COUNTER_ROW_OFFSET,
            }}
          >
            {group.steps.map((s, i) => {
              const active = i === si;
              return (
                <button key={s.id} type="button"
                  aria-label={`Adım ${i + 1}`}
                  aria-pressed={active}
                  onClick={() => setStepIdx(i)}
                  className="flex items-center justify-center rounded-full text-sm flex-shrink-0 transition-colors"
                  style={{
                    width: 40, height: 40,
                    // Madde 2026-09-07: seçili daire eskiden cyan/mavi idi —
                    // Zafer telefonda net görünmediğini söyledi. Yeşil zemin +
                    // kalın siyah rakam ile değiştirildi (kontrast çok daha net).
                    border: active ? '2px solid #16a34a' : '2px solid rgba(255,255,255,0.4)',
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

        {/* Madde 2026-08-28 (3): tahta sütunu, numaralı buton sütunu varsa
            ondan sonra başlar. Madde 2026-09-09: sayaç SADECE standalone
            kullanımda (onPoolLabelChange yokken) burada, tahtanın ÜSTÜNDE —
            entegre sayfada başlığın yanında gösterildiği için burada TEKRAR
            gösterilmez (bkz. Props.onPoolLabelChange açıklaması). */}
        <div style={{ maxWidth: BOARD_MAX_WIDTH, width: '100%' }} className="space-y-2">
          {!onPoolLabelChange && (
            <p className="text-xs t-muted" style={{ fontWeight: 600 }}>{poolLabel}</p>
          )}

          <ChessBoard fen={step!.fen} highlightSquares={[] as Square[]} hideNotation={hideNotation} />

          {/* Madde 2026-09-09 (görsel referans): İleri/Geri artık tahtanın SOL
              ALT köşesinde, "Ödev Gönder" (varsa) SAĞ ALT köşesinde — AYNI
              satır. Eskiden bu ikisi ayrı yerlerdeydi (oklar sayaçla üstte,
              Ödev Gönder tam genişlikte ayrı bir blokta altta). */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-3">
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

            {/* Madde 2026-09-09 (devam 3): gruplar arası ("Konum Havuzu"
                kodları arasında) geçiş — SADECE birden fazla grup varken
                gösterilir (çoğu bölümde tek grup var, o zaman gösterilecek
                bir şey yok). Satırın ORTASINDA — adım okları (solda) ile
                Ödev Gönder (sağda) arasında, justify-between'in 3. çocuğu
                olarak kendiliğinden ortalanır. */}
            {pool.length > 1 && (
              <div className="flex gap-2">
                <button type="button" aria-label="Önceki grup" onClick={() => goToGroup(-1)}
                  disabled={gi === 0}
                  className="flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  style={{
                    width: GROUP_ARROW_SIZE, height: GROUP_ARROW_SIZE,
                    background: '#3b82f6', border: '2px solid #0a0a0a',
                  }}>
                  <ChevronIcon direction="left" size={16} />
                </button>
                <button type="button" aria-label="Sonraki grup" onClick={() => goToGroup(1)}
                  disabled={gi >= pool.length - 1}
                  className="flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  style={{
                    width: GROUP_ARROW_SIZE, height: GROUP_ARROW_SIZE,
                    background: '#3b82f6', border: '2px solid #0a0a0a',
                  }}>
                  <ChevronIcon direction="right" size={16} />
                </button>
              </div>
            )}

            {/* Madde 2026-09-07 (GRUP D): "Ödev Gönder" — SADECE antrenör
                görünümünde. AssignHomeworkPanel'in mevcut form mantığı
                (sınıf/öğrenci seç, Alt Konu hedefle, gönder) AYNEN kullanılır
                — sadece tetikleyici GÖRSELİ bu özel ikonla değiştiriliyor
                (renderTrigger), form davranışı NestedSectionTree'deki
                kullanımla AYNI (KURAL #3). Madde 2026-09-09 (devam 3):
                buton %40 büyütüldü (36px → 50px, Zafer'in isteği). */}
            {showSendHomework && (
              <AssignHomeworkPanel
                sourceSectionId={sourceSectionId!}
                sourceSectionTitle={sourceSectionTitle!}
                renderTrigger={(open, toggle) => (
                  <button
                    type="button" onClick={toggle} aria-expanded={open}
                    aria-label="Ödev Gönder"
                    title="Ödev Gönder"
                    className="rounded-lg flex items-center justify-center transition-colors"
                    style={{
                      width: SEND_HOMEWORK_BTN_SIZE, height: SEND_HOMEWORK_BTN_SIZE,
                      background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.25)',
                    }}
                  >
                    <SendHomeworkIcon />
                  </button>
                )}
              />
            )}
          </div>
        </div>
      </div>

      <div className="t-card-i p-3 w-full mx-auto" style={{ maxWidth: BOARD_MAX_WIDTH + 52 }}>
        <p className="text-sm text-center">{step!.sentence}</p>
      </div>

      {/* Madde 2026-08-25: en altta ayrı bir notasyon alanı — tahta
          koordinatları + "Notasyon Verilerini Gizle" kutusu. */}
      <div className="t-card-i p-3 w-full mx-auto" style={{ maxWidth: BOARD_MAX_WIDTH + 52 }}>
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

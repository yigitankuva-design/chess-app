'use client';
import { useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import type { PositionPoolEntry } from '@/lib/customTabsApi';

interface Props {
  pool: PositionPoolEntry[];
}

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
 * referans doğrultusunda). Konum Havuzu İKİ SEVİYELİ:
 *  - Sağ üstteki İleri/Geri: havuzdaki GRUPLAR arasında (her biri kendi kod
 *    numarasıyla) gezinir.
 *  - Solundaki numaralı butonlar: aktif grubun İÇİNDEKİ adımlar (konum +
 *    cümle) arasında gezinir — antrenör konuyu anlatırken sırayla tıklar.
 * Tahta ve alt yazı, aktif grubun aktif adımını gösterir.
 */
export function AltKonuWalkthrough({ pool }: Props) {
  const [groupIdx, setGroupIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  /** Madde 2026-08-25: bu sayfaya ÖZEL, YEREL bir tercih — BotGame/LiveGame'in
   *  paylaşılan (localStorage) "Notasyon Verilerini Gizle" tercihiyle KARIŞMAZ
   *  (bkz. lib/board-notation-context.tsx: "ders/bulmaca tahtaları bu tercihi
   *  kullanmaz" — KURAL #3, mevcut maç ekranları etkilenmesin diye). */
  const [hideNotation, setHideNotation] = useState(false);

  if (pool.length === 0) {
    return <p className="t-muted text-sm">Henüz konum eklenmedi.</p>;
  }

  const codes = assignExerciseCodes(pool.map((p) => ({ code: p.code ?? undefined })));
  const gi = Math.min(groupIdx, pool.length - 1);
  const group = pool[gi];
  const si = Math.min(stepIdx, group.steps.length - 1);
  const step = group.steps[si];

  function goToGroup(delta: 1 | -1) {
    setGroupIdx((i) => Math.min(pool.length - 1, Math.max(0, Math.min(i, pool.length - 1) + delta)));
    setStepIdx(0);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-center gap-3">
        {group.steps.length > 1 && (
          <div
            className="flex flex-col flex-wrap gap-2 flex-shrink-0"
            style={{ maxHeight: BOARD_MAX_WIDTH, marginTop: COUNTER_ROW_OFFSET }}
          >
            {group.steps.map((s, i) => {
              const active = i === si;
              return (
                <button key={s.id} type="button"
                  aria-label={`Adım ${i + 1}`}
                  aria-pressed={active}
                  onClick={() => setStepIdx(i)}
                  className="flex items-center justify-center rounded-full font-bold text-sm flex-shrink-0 transition-colors"
                  style={{
                    width: 40, height: 40,
                    border: active ? '2px solid rgb(34 211 238)' : '2px solid rgba(255,255,255,0.4)',
                    background: active ? 'rgba(34,211,238,0.15)' : 'transparent',
                    color: active ? 'rgb(165 243 252)' : undefined,
                  }}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* Madde 2026-08-28 (3): sayaç ARTIK bu sütunun İÇİNDE — böylece
            başlangıcı tahtanın sol kenarıyla AYNI hizada, sağa kaymış olur
            (numaralı buton sütunu varsa ondan sonra başlar). */}
        <div style={{ maxWidth: BOARD_MAX_WIDTH, width: '100%' }} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs t-muted" style={{ fontWeight: 600 }}>
              {gi + 1} / {pool.length} — Konum Havuzu {group.code ?? codes[gi]}
            </p>
            <div className="flex gap-2">
              {/* Madde 2026-08-28 (2): çerçeve VE ok işaretleri %50 kalınlaştırıldı
                  (1px → 1.5px çerçeve, 400 → 600 yazı kalınlığı). */}
              <button type="button" aria-label="Önceki konum" onClick={() => goToGroup(-1)}
                disabled={gi === 0}
                className="w-8 h-8 flex items-center justify-center rounded-full t-muted disabled:opacity-30"
                style={{ borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.15)', fontWeight: 600 }}>
                ‹
              </button>
              <button type="button" aria-label="Sonraki konum" onClick={() => goToGroup(1)}
                disabled={gi >= pool.length - 1}
                className="w-8 h-8 flex items-center justify-center rounded-full t-muted disabled:opacity-30"
                style={{ borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.15)', fontWeight: 600 }}>
                ›
              </button>
            </div>
          </div>

          <ChessBoard fen={step.fen} highlightSquares={[] as Square[]} hideNotation={hideNotation} />
        </div>
      </div>

      <div className="t-card-i p-3 w-full mx-auto" style={{ maxWidth: BOARD_MAX_WIDTH + 52 }}>
        <p className="text-sm text-center">{step.sentence}</p>
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

'use client';
import { useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import type { PoolPosition } from '@/components/admin/PositionPoolView';
import type { ExplanationCard } from '@/lib/customTabsApi';

interface Props {
  positions: PoolPosition[];
  cards: ExplanationCard[];
}

/** Madde 2026-08-25: tahta %75 büyütüldü (240px → 420px) — antrenör
 *  öğrencilerine gösterirken daha net görünsün. Açıklama kartları da bu
 *  yükseklikte doluşur, taşınca 2. sütuna geçer (bkz. aşağıdaki kart sütunu). */
const BOARD_MAX_WIDTH = 420;

const PLACEHOLDER_SENTENCE = 'Numaralı butonlara tıklandığında ekrana gelecek cümleler';

/**
 * Alt Konu'nun ayrı sayfasındaki tasarım — madde: 2026-08-25 (görsel referans
 * doğrultusunda). İki BAĞIMSIZ gezinme aynı tahtayı paylaşır:
 *  - Solundaki numaralı açıklama kartları: antrenörün konuyu anlatırken
 *    tıklayarak sırayla gösterdiği konum + cümle çiftleri (admin'den girilir).
 *  - Sağ üstteki İleri/Geri: Konum Havuzu'ndaki kayıtlı konumlar arasında
 *    SIRAYLA (1'den başlayarak) gezinir.
 * Hangisine EN SON tıklandıysa tahta ve alt yazı ONU gösterir.
 */
export function AltKonuWalkthrough({ positions, cards }: Props) {
  const [poolIdx, setPoolIdx] = useState(0);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  /** Madde 2026-08-25: bu sayfaya ÖZEL, YEREL bir tercih — BotGame/LiveGame'in
   *  paylaşılan (localStorage) "Notasyon Verilerini Gizle" tercihiyle KARIŞMAZ
   *  (bkz. lib/board-notation-context.tsx: "ders/bulmaca tahtaları bu tercihi
   *  kullanmaz" — KURAL #3, mevcut maç ekranları etkilenmesin diye). */
  const [hideNotation, setHideNotation] = useState(false);

  const activeCard = activeCardId ? cards.find((c) => c.id === activeCardId) : undefined;
  const hasPool = positions.length > 0;
  const poolPos = hasPool ? positions[Math.min(poolIdx, positions.length - 1)] : undefined;

  // Kart aktifse tahta/cümle KARTINKİ; değilse Konum Havuzu'ndaki geçerli konum.
  const fen = activeCard ? activeCard.fen : (poolPos?.fen ?? '');
  const sentence = activeCard ? activeCard.sentence : PLACEHOLDER_SENTENCE;

  function goToPool(delta: 1 | -1) {
    setActiveCardId(null);
    setPoolIdx((i) => Math.min(Math.max(0, positions.length - 1), Math.max(0, i + delta)));
  }

  return (
    <div className="space-y-3">
      {hasPool && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs t-muted">
            {Math.min(poolIdx, positions.length - 1) + 1} / {positions.length} — Konum Havuzu {String(Math.min(poolIdx, positions.length - 1) + 1).padStart(3, '0')}
          </p>
          <div className="flex gap-2">
            <button type="button" aria-label="Önceki konum" onClick={() => goToPool(-1)}
              disabled={poolIdx === 0}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-white/15 t-muted disabled:opacity-30">
              ‹
            </button>
            <button type="button" aria-label="Sonraki konum" onClick={() => goToPool(1)}
              disabled={poolIdx >= positions.length - 1}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-white/15 t-muted disabled:opacity-30">
              ›
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start justify-center gap-3">
        {cards.length > 0 && (
          <div
            className="flex flex-col flex-wrap gap-2 flex-shrink-0"
            style={{ maxHeight: BOARD_MAX_WIDTH }}
          >
            {cards.map((c, i) => {
              const active = activeCardId === c.id;
              return (
                <button key={c.id} type="button"
                  aria-label={`Açıklama ${i + 1}`}
                  aria-pressed={active}
                  onClick={() => setActiveCardId((prev) => (prev === c.id ? null : c.id))}
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

        <div style={{ maxWidth: BOARD_MAX_WIDTH, width: '100%' }}>
          {fen ? (
            <ChessBoard fen={fen} highlightSquares={[] as Square[]} hideNotation={hideNotation} />
          ) : (
            <p className="t-muted text-sm text-center">Henüz konum eklenmedi.</p>
          )}
        </div>
      </div>

      <div className="t-card-i p-3 w-full mx-auto" style={{ maxWidth: BOARD_MAX_WIDTH + 52 }}>
        <p className="text-sm text-center">{sentence}</p>
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

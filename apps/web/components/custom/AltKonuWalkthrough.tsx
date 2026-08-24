'use client';
import { useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import type { PoolPosition } from '@/components/admin/PositionPoolView';
import type { BoardExercise } from '@/components/admin/ExerciseForm';

interface Props {
  positions: PoolPosition[];
  exercises: BoardExercise[];
}

const TYPE_LABELS: Record<string, string> = {
  click_square: 'Kareye Tıkla',
  click_piece: 'Taşa Tıkla',
  move_piece: 'Taşı Oynat',
};

/** Madde 2026-08-25: tahta %75 büyütüldü (240px → 420px) — antrenör
 *  öğrencilerine gösterirken daha net görünsün. */
const BOARD_MAX_WIDTH = 420;

interface WalkItem {
  code: string;
  poolLabel: string;
  instruction?: string;
  fen: string;
  marked: string[];
  moves?: string[];
}

/** Konum Havuzu (practice_positions) ve Kareye Tıkla/Taşa Tıkla/Taşı Oynat
 *  (board_exercises) tek bir SIRALI akışta birleştirilir — her biri KENDİ
 *  havuzunun kod numarasını korur (admin panelindeki numarayla tutarlı
 *  kalsın diye), önce Konum Havuzu sonra Soru Havuzu sırayla gelir. */
function buildWalkItems(positions: PoolPosition[], exercises: BoardExercise[]): WalkItem[] {
  const posCodes = assignExerciseCodes(positions);
  const exCodes = assignExerciseCodes(exercises);
  const posItems: WalkItem[] = positions.map((p, i) => ({
    code: posCodes[i], poolLabel: 'Konum Havuzu', fen: p.fen, marked: [],
  }));
  const exItems: WalkItem[] = exercises.map((ex, i) => ({
    code: exCodes[i],
    poolLabel: TYPE_LABELS[ex.type] ?? ex.type,
    instruction: ex.instruction,
    fen: ex.fen ?? '',
    marked: ex.type === 'click_square' ? (ex.target_squares ?? [])
      : ex.type === 'click_piece' ? (ex.piece_squares ?? [])
        : [],
    moves: ex.type === 'move_piece' ? ex.moves : undefined,
  }));
  return [...posItems, ...exItems];
}

/**
 * Alt Konu'nun ayrı sayfasında (madde: 2026-08-25) kaydedilmiş konumları VE
 * Kareye Tıkla/Taşa Tıkla/Taşı Oynat sorularını SIRAYLA (kod numarasına göre)
 * gösteren gezinme — antrenör dersi anlatırken Sonraki/Önceki ile tek tek
 * ilerler. Tahta ChessBoard bileşenidir (SavedPositionBoard değil) — sağ
 * tıkla ok/çember çizme ve notasyon gösterimi canlı maçlarla AYNI şekilde
 * çalışsın diye (madde 4/5/6).
 */
export function AltKonuWalkthrough({ positions, exercises }: Props) {
  const items = buildWalkItems(positions, exercises);
  const [idx, setIdx] = useState(0);
  /** Madde 2026-08-25: bu sayfaya ÖZEL, YEREL bir tercih — BotGame/LiveGame'in
   *  paylaşılan (localStorage) "Notasyon Verilerini Gizle" tercihiyle KARIŞMAZ
   *  (bkz. lib/board-notation-context.tsx: "ders/bulmaca tahtaları bu tercihi
   *  kullanmaz" — KURAL #3, mevcut maç ekranları etkilenmesin diye). */
  const [hideNotation, setHideNotation] = useState(false);

  if (items.length === 0) {
    return <p className="t-muted text-sm">Henüz soru eklenmedi.</p>;
  }

  const current = idx >= items.length ? items.length - 1 : idx;
  const item = items[current];

  return (
    <div className="space-y-3">
      <p className="text-xs t-muted text-center">
        {current + 1} / {items.length} — {item.poolLabel} {item.code}
      </p>
      {item.instruction && (
        <p className="text-sm font-semibold text-center">{item.instruction}</p>
      )}
      <div className="mx-auto" style={{ maxWidth: BOARD_MAX_WIDTH }}>
        <ChessBoard
          fen={item.fen}
          highlightSquares={item.marked as Square[]}
          hideNotation={hideNotation}
        />
      </div>
      <div className="flex justify-center gap-3">
        <button type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={current === 0}
          className="px-4 py-2 rounded-lg border border-white/15 text-sm t-muted disabled:opacity-30">
          ‹ Önceki Soru
        </button>
        <button type="button"
          onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))}
          disabled={current === items.length - 1}
          className="px-4 py-2 rounded-lg border border-white/15 text-sm t-muted disabled:opacity-30">
          Sonraki Soru ›
        </button>
      </div>

      {/* Madde 2026-08-25: İleri/Geri'nin ALTINDA notasyon alanı — canlı
          maçlardaki "Notasyon Verilerini Gizle" ile AYNI tercih (paylaşılan
          context, tarayıcıda kalıcı). */}
      <div className="t-card-i p-3 w-full mx-auto" style={{ maxWidth: BOARD_MAX_WIDTH }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold t-muted uppercase tracking-widest">Notasyon</p>
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
        {item.moves && item.moves.length > 0 && (
          <p className="text-sm font-mono mt-2">Hamleler: {item.moves.join(' ')}</p>
        )}
      </div>
    </div>
  );
}

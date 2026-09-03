'use client';
import { Fragment } from 'react';
import type { GameSummary } from '@/lib/chess/gameSummary';

interface Props {
  /** null = henüz hesaplanmadı (motor arka planda çalışıyor). */
  summary: GameSummary | null;
  progress: { done: number; total: number };
  onLearnFromMistakes: () => void;
}

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)}%`;
}

/**
 * "Analiz Et" özet kartı — madde 2026-09-03 (2). Zafer'in gönderdiği görsel
 * Lichess'ten alınmıştı; SADECE genel bilgi yapısı (4 sayı + 4 yüzde satırı +
 * bir CTA butonu) esinlenilip KENDİ neumorphic dilimizle (t-card-i/t-ac/t-btn)
 * yeniden çizildi — hiçbir renk/görsel/kod kopyalanmadı (telif kuralı).
 * Sayılar `lib/chess/gameSummary.ts`'teki `computeGameSummary`'den gelir.
 */
export function MatchAnalysisSummary({ summary, progress, onLearnFromMistakes }: Props) {
  if (!summary || progress.done < progress.total) {
    const donePct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
    return (
      <div className="t-card-i p-4 space-y-2 text-center" data-testid="analysis-loading">
        <p className="text-sm t-muted">Motor maçı inceliyor…</p>
        <div className="t-prog-track">
          <div className="t-prog-fill" style={{ width: `${donePct}%` }} />
        </div>
      </div>
    );
  }

  const left = [
    { value: String(summary.inaccuracies), label: 'Kusurlu hamle' },
    { value: String(summary.mistakes), label: 'Hata' },
    { value: String(summary.blunders), label: 'Vahim hata' },
    { value: summary.acpl === null ? '—' : String(summary.acpl), label: 'Ortalama santipiyon kaybı' },
  ];
  const right = [
    { value: pct(summary.accuracy), label: 'Doğruluk' },
    { value: pct(summary.phaseAccuracy.opening), label: 'Açılış' },
    { value: pct(summary.phaseAccuracy.middlegame), label: 'Oyunortası' },
    { value: pct(summary.phaseAccuracy.endgame), label: 'Oyunsonu' },
  ];

  return (
    <div className="t-card-i p-4 space-y-4" data-testid="analysis-summary">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {left.map((row, i) => (
          <Fragment key={row.label}>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-mono font-bold text-lg t-ac tabular-nums shrink-0">{row.value}</span>
              <span className="text-xs t-muted truncate">{row.label}</span>
            </div>
            <div className="flex items-baseline gap-2 justify-end text-right min-w-0">
              <span className="text-xs t-muted truncate">{right[i].label}</span>
              <span className="font-mono font-bold text-lg t-ac tabular-nums shrink-0">{right[i].value}</span>
            </div>
          </Fragment>
        ))}
      </div>
      <button type="button" onClick={onLearnFromMistakes} className="t-btn w-full">
        Hatalarından Ders Al
      </button>
    </div>
  );
}

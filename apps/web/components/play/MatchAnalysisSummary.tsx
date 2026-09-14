'use client';
import { Fragment } from 'react';
import type { GameSummary } from '@/lib/chess/gameSummary';
import type { AnalysisStatus } from '@/lib/chess/useServerGameAnalysis';

interface Props {
  /** null = henüz hesaplanmadı (motor sunucuda çalışıyor). */
  summary: GameSummary | null;
  status: AnalysisStatus;
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
 * Sayılar `lib/chess/gameSummary.ts`'teki `computeGameSummary`'nin sunucu
 * (native Stockfish) karşılığından gelir — bkz. `useServerGameAnalysis`.
 * Madde 2026-09-15 (sunucu analiz motoru): motor artık backend'de
 * çalıştığı için hamle-hamle ilerleme YÜZDESİ istemcide bilinmiyor —
 * kesirli bir çubuk yerine belirsiz bir bekleme durumu gösterilir (sahte
 * bir yüzde uydurmaktan daha dürüst).
 */
export function MatchAnalysisSummary({ summary, status, onLearnFromMistakes }: Props) {
  if (status === 'error') {
    return (
      <div className="t-card-i p-4 text-center" data-testid="analysis-error">
        <p className="text-sm t-muted">Analiz şu an alınamadı. Az sonra tekrar dene.</p>
      </div>
    );
  }

  if (!summary || status !== 'done') {
    return (
      <div className="t-card-i p-4 space-y-2 text-center" data-testid="analysis-loading">
        <p className="text-sm t-muted">Motor maçı inceliyor…</p>
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
        Hatalarını Gözden Geçir
      </button>
    </div>
  );
}

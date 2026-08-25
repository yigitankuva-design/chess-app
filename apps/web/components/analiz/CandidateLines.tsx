export interface CandidateLine {
  /** Beyaz açısından skor (scoreForWhite ile çevrilmiş). */
  scoreCp: number | null;
  mate: number | null;
  /** "5. Nc3 Be7 6. g3 d5..." — formatContinuation çıktısı. */
  continuation: string;
}

interface Props {
  lines: CandidateLine[];
  depth: number;
  loading?: boolean;
}

function scoreLabel(scoreCp: number | null, mate: number | null): string {
  if (mate !== null) return `#${mate > 0 ? '' : '-'}${Math.abs(mate)}`;
  if (scoreCp === null) return '–';
  const val = (scoreCp / 100).toFixed(2);
  return scoreCp > 0 ? `+${val}` : val;
}

/**
 * Analiz Et sekmesi — motor bilgisi + 3 aday hamle satırı (görsel referans:
 * lichess/chess.com analiz paneli). En iyi satır (0. indeks) vurgulanır.
 */
export function CandidateLines({ lines, depth, loading = false }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs t-muted flex items-center gap-1">
        🔍 Stockfish · Derinlik {depth}
      </p>
      <div className="space-y-1">
        {!loading && lines.length === 0 && (
          <p className="text-xs t-muted">Analiz alınamadı.</p>
        )}
        {lines.map((line, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs"
            style={{
              background: i === 0 ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
              border: i === 0 ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span
              className="font-mono font-bold flex-shrink-0"
              style={{ minWidth: 40, color: i === 0 ? 'rgb(165 243 252)' : undefined }}
            >
              {scoreLabel(line.scoreCp, line.mate)}
            </span>
            <span className="t-muted break-words">{line.continuation || '…'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

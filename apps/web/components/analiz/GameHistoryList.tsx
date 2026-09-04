import type { GameSummary } from '@/lib/analiz/analizApi';

interface Props {
  games: GameSummary[];
  loading: boolean;
  onSelect: (game: GameSummary) => void;
}

/** "+6" / "−5" biçiminde işaretli puan farkı (madde 2026-09-06 (8)). */
function ratingDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/** Beyaz/siyah isim — puanlıysa yanında "(maç sonrası puan)(±fark)". */
function playerLabel(name: string | null, ratingAfter: number | null, delta: number | null): string {
  const n = name ?? 'Sporcu';
  return ratingAfter != null && delta != null ? `${n} ${ratingAfter}${ratingDelta(delta)}` : n;
}

const RESULT_LABEL: Record<string, string> = { '1-0': '1-0', '0-1': '0-1', '1/2-1/2': '½-½' };

/**
 * Analiz Et sekmesi — "Maçlarımın Analizi": bitmiş maçların listesi. Madde
 * 2026-09-06 (8): Zafer'in gönderdiği tasarıma göre TAM maç kartı —
 * Beyaz(±puan) | Skor (mor) | Siyah(±puan)
 * Tempo türü                           Tarih
 * Açılış — Varyant (varsa)
 * Bir karta tıklayınca o maç incelemeye açılır (bkz. GameAnalysisSection.tsx).
 */
export function GameHistoryList({ games, loading, onSelect }: Props) {
  if (loading) return <p className="text-sm t-muted">Yükleniyor…</p>;
  if (games.length === 0) return <p className="text-sm t-muted">Henüz bitmiş bir maçın yok.</p>;

  return (
    <div className="space-y-2">
      {games.map((g) => (
        <button key={g.id} type="button" onClick={() => onSelect(g)}
          className="t-card-i w-full flex flex-col gap-1 px-4 py-3 text-left">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold flex-wrap">
            <span>{playerLabel(g.white_name, g.white_rating_after, g.white_rating_delta)}</span>
            <span className="t-muted" aria-hidden="true">|</span>
            <span style={{ color: '#c084fc' }}>{g.result ? RESULT_LABEL[g.result] ?? g.result : '—'}</span>
            <span className="t-muted" aria-hidden="true">|</span>
            <span>{playerLabel(g.black_name, g.black_rating_after, g.black_rating_delta)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs t-muted">
            <span>{g.tempo_label ?? 'Süresiz'}</span>
            <span>{new Date(g.started_at).toLocaleDateString('tr-TR')}</span>
          </div>
          {g.opening_name && (
            <p className="text-xs t-muted text-center">
              {g.opening_name}{g.variant_name ? ` — ${g.variant_name}` : ''}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}

import type { GameSummary } from '@/lib/analiz/analizApi';

interface Props {
  games: GameSummary[];
  loading: boolean;
  onSelect: (game: GameSummary) => void;
}

function rakipAdi(game: GameSummary): string {
  if (game.opponent.type === 'bot') {
    return `Bot · Düzey ${game.opponent.level ?? '?'}`;
  }
  return game.opponent.name ?? 'Sporcu';
}

/**
 * Analiz Et sekmesi — "Maçlarımın Analizi": bitmiş maçların listesi. Madde
 * 2026-09-04 (2): sonuç ikonu KALDIRILDI, tarih rakip isminin SAĞINA
 * (aynı satırda) alındı — her satır TEK SATIR halinde sıralanır.
 * Bir karta tıklayınca o maç incelemeye açılır (bkz. components/analiz/GameAnalysisSection.tsx).
 */
export function GameHistoryList({ games, loading, onSelect }: Props) {
  if (loading) return <p className="text-sm t-muted">Yükleniyor…</p>;
  if (games.length === 0) return <p className="text-sm t-muted">Henüz bitmiş bir maçın yok.</p>;

  return (
    <div className="space-y-2">
      {games.map((g) => (
        <button key={g.id} type="button" onClick={() => onSelect(g)}
          className="t-card-i w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
          <p className="font-semibold text-sm">{rakipAdi(g)}</p>
          <p className="text-xs t-muted flex-shrink-0">
            {new Date(g.started_at).toLocaleDateString('tr-TR')}
          </p>
        </button>
      ))}
    </div>
  );
}

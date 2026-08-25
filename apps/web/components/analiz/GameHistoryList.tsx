import type { GameSummary } from '@/lib/analiz/analizApi';

interface Props {
  games: GameSummary[];
  loading: boolean;
  onSelect: (game: GameSummary) => void;
}

function sonucSimgesi(game: GameSummary): string {
  if (!game.result) return '❔';
  if (game.result === '1/2-1/2') return '🤝';
  if (!game.student_color) return '❔';
  const kazandi = (game.result === '1-0' && game.student_color === 'w')
    || (game.result === '0-1' && game.student_color === 'b');
  return kazandi ? '✅' : '❌';
}

function rakipAdi(game: GameSummary): string {
  if (game.opponent.type === 'bot') {
    return `Bot · Düzey ${game.opponent.level ?? '?'}`;
  }
  return game.opponent.name ?? 'Sporcu';
}

/**
 * Analiz Et sekmesi — "Son Maçlarımı İncele": bitmiş maçların listesi.
 * Bir karta tıklayınca o maç incelemeye açılır (bkz. components/analiz/GameAnalysisSection.tsx).
 */
export function GameHistoryList({ games, loading, onSelect }: Props) {
  if (loading) return <p className="text-sm t-muted">Yükleniyor…</p>;
  if (games.length === 0) return <p className="text-sm t-muted">Henüz bitmiş bir maçın yok.</p>;

  return (
    <div className="space-y-2">
      {games.map((g) => (
        <button key={g.id} type="button" onClick={() => onSelect(g)}
          className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left">
          <span className="text-xl leading-none">{sonucSimgesi(g)}</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">{rakipAdi(g)}</p>
            <p className="text-xs t-muted">
              {new Date(g.started_at).toLocaleDateString('tr-TR')}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

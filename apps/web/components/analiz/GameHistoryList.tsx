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

/** İnce dikey ayırıcı çizgi — segmentler arasında. */
function Divider() {
  return <span className="t-muted flex-shrink-0" aria-hidden="true">|</span>;
}

/**
 * Analiz Et sekmesi — "Maçlarımın Analizi": bitmiş maçların listesi. Madde
 * 2026-09-06 (ikinci tur/E): Zafer'in gönderdiği görsele göre TÜM veri TEK
 * SATIRDA — Beyaz(±puan) | Skor (mor) | Siyah(±puan) | Tempo+Tarih |
 * Açılış — Varyant (varsa). Sarmaz (whitespace-nowrap); çok dar ekranlarda
 * son çare olarak yatay kaydırılabilir (overflow-x-auto) — asıl çözüm
 * küçük punto (text-[11px]).
 * Bir karta tıklayınca o maç incelemeye açılır (bkz. GameAnalysisSection.tsx).
 */
export function GameHistoryList({ games, loading, onSelect }: Props) {
  if (loading) return <p className="text-sm t-muted">Yükleniyor…</p>;
  if (games.length === 0) return <p className="text-sm t-muted">Henüz bitmiş bir maçın yok.</p>;

  return (
    <div className="space-y-2">
      {games.map((g) => {
        const tempoDate = `${g.tempo_label ?? 'Süresiz'} ${new Date(g.started_at).toLocaleDateString('tr-TR')}`;
        return (
          <button key={g.id} type="button" onClick={() => onSelect(g)}
            className="t-card-i w-full px-4 py-3 text-left overflow-x-auto">
            <div className="flex items-center gap-2 text-[11px] font-semibold whitespace-nowrap w-max">
              <span>{playerLabel(g.white_name, g.white_rating_after, g.white_rating_delta)}</span>
              <Divider />
              <span style={{ color: '#c084fc' }}>{g.result ? RESULT_LABEL[g.result] ?? g.result : '—'}</span>
              <Divider />
              <span>{playerLabel(g.black_name, g.black_rating_after, g.black_rating_delta)}</span>
              <Divider />
              <span className="t-muted font-normal">{tempoDate}</span>
              {g.opening_name && (
                <>
                  <Divider />
                  <span className="t-muted font-normal">
                    {g.opening_name}{g.variant_name ? ` — ${g.variant_name}` : ''}
                  </span>
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

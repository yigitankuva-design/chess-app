import { toTurkishSan } from '@/lib/chess/analysisFormat';

interface MoveEntry {
  ply: number;
  san: string;
}

interface Props {
  moves: MoveEntry[];
  /** Verilirse aktif hamle vurgulanır ve tıklanabilir olur (Maçlarımın Analizi). */
  currentPly?: number;
  onSelectPly?: (ply: number) => void;
}

/**
 * Analiz Et sekmesi — madde 2026-09-03 (5): hamle notasyonunu 3'lü sabit
 * genişlikte bir CSS grid'de gösterir. Grid sütunları TÜM satırlarda aynı
 * genişlikte olduğu için hamle numaraları satırlar arasında otomatik
 * hizalanır — ayrı bir hesap gerekmez. Bir hücre siyah hamleyse ve
 * satırın İLK hücresiyse (önceki beyaz hamle bir üstteki satırda kaldıysa)
 * "N..." öneki alır; aksi halde yalnız hamle metni.
 */
export function MoveNotationGrid({ moves, currentPly, onSelectPly }: Props) {
  if (moves.length === 0) {
    return <p className="text-xs t-muted">Henüz hamle yok.</p>;
  }

  return (
    <div className="grid gap-x-2 gap-y-1 text-sm font-mono t-card-i p-2"
      style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      {moves.map((m, i) => {
        const moveNumber = Math.ceil(m.ply / 2);
        const isWhite = m.ply % 2 === 1;
        const showNumber = isWhite || i % 3 === 0;
        const label = showNumber
          ? `${moveNumber}${isWhite ? '.' : '...'} ${toTurkishSan(m.san)}`
          : toTurkishSan(m.san);
        const active = currentPly === m.ply;
        const clickable = !!onSelectPly;
        const Tag = clickable ? 'button' : 'span';
        return (
          <Tag
            key={m.ply}
            type={clickable ? 'button' : undefined}
            onClick={clickable ? () => onSelectPly!(m.ply) : undefined}
            className="rounded px-1 text-left whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ background: active ? 'rgba(34,211,238,0.25)' : undefined }}
          >
            {label}
          </Tag>
        );
      })}
    </div>
  );
}

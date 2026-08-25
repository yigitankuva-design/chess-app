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

interface MovePair {
  moveNumber: number;
  white?: MoveEntry;
  black?: MoveEntry;
}

function buildPairs(moves: MoveEntry[]): MovePair[] {
  const pairs: MovePair[] = [];
  moves.forEach((m) => {
    const moveNumber = Math.ceil(m.ply / 2);
    let pair = pairs.find((p) => p.moveNumber === moveNumber);
    if (!pair) { pair = { moveNumber }; pairs.push(pair); }
    if (m.ply % 2 === 1) pair.white = m; else pair.black = m;
  });
  return pairs;
}

/**
 * Analiz Et sekmesi — madde 2026-09-04 (1c/1d, 3c/3d, 4c/4d): hamle
 * notasyonunu TAM HAMLE (beyaz+siyah BİRLİKTE, tek numara) çiftleri halinde,
 * 3 çift/satır sabit genişlikte bir CSS grid'de gösterir. Önceki sürümde
 * hamleler ply (yarı hamle) bazında bölünüyordu — bu, bir satırın TAM
 * ortasında bir hamlenin beyaz/siyah kısımlarının birbirinden kopmasına
 * (örn. "2. Nf3" bir satırda, "2... Nc6" bir SONRAKİ satırda) yol açıyordu.
 * Artık her hücre bir TAM hamleyi (numara + beyaz + varsa siyah) birlikte
 * tutar — hiçbir hamle iki satıra bölünemez. Grid 3 eşit sütunlu olduğu
 * için hamle numaraları sütun bazında hizalanır (1-4-7-10-13, 2-5-8-11-14,
 * 3-6-9-12-15 gibi).
 */
export function MoveNotationGrid({ moves, currentPly, onSelectPly }: Props) {
  if (moves.length === 0) {
    return <p className="text-xs t-muted">Henüz hamle yok.</p>;
  }

  const pairs = buildPairs(moves);
  const clickable = !!onSelectPly;

  const moveSpan = (m: MoveEntry) => {
    const active = currentPly === m.ply;
    if (!clickable) {
      return <span className="px-1">{toTurkishSan(m.san)}</span>;
    }
    return (
      <button type="button" onClick={() => onSelectPly!(m.ply)}
        className="rounded px-1" style={{ background: active ? 'rgba(34,211,238,0.25)' : undefined }}>
        {toTurkishSan(m.san)}
      </button>
    );
  };

  return (
    <div className="grid gap-x-2 gap-y-1.5 text-sm font-mono t-card-i p-2"
      style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      {pairs.map((p) => (
        <div key={p.moveNumber} className="whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="t-muted">{p.moveNumber}.</span>{' '}
          {p.white && moveSpan(p.white)}
          {p.black && <>{' '}{moveSpan(p.black)}</>}
        </div>
      ))}
    </div>
  );
}

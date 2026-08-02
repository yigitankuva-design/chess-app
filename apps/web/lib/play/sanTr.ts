/** Notasyonu Türkçeleştirme — saf mantık.
 *
 *  chess.js İngilizce SAN üretir (N, B, R, Q, K). Türkçe satranç yazımı:
 *  Ş=Şah, V=Vezir, K=Kale, F=Fil, A=At.  DİKKAT: İngilizce K (King) ile
 *  Türkçe K (Kale) çakışır — bu yüzden harfler TEK SEFERDE eşlenir,
 *  zincirleme replace YAPILMAZ (K→Ş sonra R→K yapılsa şah kaleye dönerdi).
 */

const PIECE_TR: Record<string, string> = {
  K: 'Ş',   // King  -> Şah
  Q: 'V',   // Queen -> Vezir
  R: 'K',   // Rook  -> Kale
  B: 'F',   // Bishop-> Fil
  N: 'A',   // Knight-> At
};

/** Tek bir SAN'ı Türkçeye çevirir. Kare adları (a-h) ve işaretler korunur. */
export function toTurkishSan(san: string): string {
  if (!san) return san;
  // Rok: O-O / O-O-O olduğu gibi kalır (uluslararası yazım).
  if (san.startsWith('O-O')) return san;
  let out = '';
  for (const ch of san) {
    // Yalnızca BÜYÜK harfler taş adıdır; küçük harfler kare/dosya adıdır.
    out += PIECE_TR[ch] ?? ch;
  }
  return out;
}

export interface TurkishMovePair {
  no: number;
  /** "e4 – e5" veya tek hamlede "e4" */
  text: string;
}

/** Satırlara bölmeden, "1. e4 – e5" parçaları üretir. Sarma işi CSS'e kalır. */
export function turkishMovePairs(
  san: string[],
  start: { whiteStarts: boolean; firstNo: number } = { whiteStarts: true, firstNo: 1 },
): TurkishMovePair[] {
  const out: TurkishMovePair[] = [];
  let i = 0;
  let no = start.firstNo;

  if (!start.whiteStarts && san.length > 0) {
    out.push({ no, text: `… – ${toTurkishSan(san[0])}` });
    i = 1;
    no += 1;
  }

  for (; i < san.length; i += 2) {
    const w = toTurkishSan(san[i]);
    const b = san[i + 1] ? toTurkishSan(san[i + 1]) : null;
    out.push({ no, text: b ? `${w} – ${b}` : w });
    no += 1;
  }
  return out;
}

export interface TurkishMove {
  /** Türkçeleştirilmiş SAN. */
  san: string;
  /** 1 tabanlı yarı-hamle sırası. `fensFromSan(...)[ply]` bu hamleden
   *  SONRAKİ konumu verir — notasyona tıklanınca kullanılır (madde 1). */
  ply: number;
}

export interface TurkishMoveRow {
  no: number;
  white: TurkishMove | null;
  black: TurkishMove | null;
}

/** `turkishMovePairs` ile aynı numaralandırma, ama hamleler AYRI AYRI
 *  döner — böylece her hamle tek tek tıklanabilir. Metin birleştirme işi
 *  görüntüleyen bileşene (MoveList) kalır. */
export function turkishMoveRows(
  san: string[],
  start: { whiteStarts: boolean; firstNo: number } = { whiteStarts: true, firstNo: 1 },
): TurkishMoveRow[] {
  const rows: TurkishMoveRow[] = [];
  let i = 0;
  let no = start.firstNo;

  if (!start.whiteStarts && san.length > 0) {
    rows.push({ no, white: null, black: { san: toTurkishSan(san[0]), ply: 1 } });
    i = 1;
    no += 1;
  }

  for (; i < san.length; i += 2) {
    rows.push({
      no,
      white: { san: toTurkishSan(san[i]), ply: i + 1 },
      black: san[i + 1] ? { san: toTurkishSan(san[i + 1]), ply: i + 2 } : null,
    });
    no += 1;
  }
  return rows;
}

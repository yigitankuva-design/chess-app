/** Hamle notasyonu — saf mantik. React yok, satranc kutuphanesi yok. */

export interface MoveRow {
  /** Tahtadaki gercek hamle numarasi (acilis konumundan baslanmis olabilir). */
  no: number;
  white: string | null;
  black: string | null;
}

export interface StartInfo {
  /** Ilk hamleyi beyaz mi yapiyor? */
  whiteStarts: boolean;
  /** Ilk satirin numarasi (FEN'in tam hamle sayaci). */
  firstNo: number;
}

const DEFAULT_START: StartInfo = { whiteStarts: true, firstNo: 1 };

/** FEN'den baslangic bilgisini cikarir. Bozuk/eksik FEN'de standart varsayilir —
 *  notasyon listesi yuzunden mac EKRANI patlamamali. */
export function parseFenStart(fen: string | undefined | null): StartInfo {
  if (!fen) return DEFAULT_START;
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return DEFAULT_START;
  const no = parts.length >= 6 ? Number(parts[5]) : 1;
  return {
    whiteStarts: parts[1] !== 'b',
    firstNo: Number.isFinite(no) && no > 0 ? Math.floor(no) : 1,
  };
}

/** SAN dizisini "1. e4 e5" satirlarina bolerr. Siyah once oynuyorsa ilk
 *  satirin beyaz hanesi bos kalir — numaralandirma kaymaz. */
export function toMoveRows(san: string[], start: StartInfo = DEFAULT_START): MoveRow[] {
  const rows: MoveRow[] = [];
  let i = 0;
  let no = start.firstNo;

  if (!start.whiteStarts && san.length > 0) {
    rows.push({ no, white: null, black: san[0] });
    i = 1;
    no += 1;
  }

  for (; i < san.length; i += 2) {
    rows.push({ no, white: san[i], black: san[i + 1] ?? null });
    no += 1;
  }
  return rows;
}

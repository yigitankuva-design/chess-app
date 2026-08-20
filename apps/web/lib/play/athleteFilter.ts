/** /athletes ucundan gelen sporcu. rating/title yalnizca ?tempo= verilince
 *  dolar (madde 6, 2026-08-20) — aksi halde null. */
export interface Athlete {
  child_id: number;
  display_name: string;
  rating?: number | null;
  title?: string | null;
}

/** Listede gosterilen satir: sporcu + o an lobide mi. */
export interface AthleteRow extends Athlete { online: boolean }

/** TURKCE duyarli kucultme.
 *  'İSTANBUL'.toLowerCase() Ingilizce kurallarla 'i̇stanbul' uretir ve
 *  "ist" aramasi TUTMAZ. Cocuk uygulamasinda arama kutusu calismak zorunda. */
export function trLower(s: string): string {
  return s.toLocaleLowerCase('tr');
}

/** Harf harf filtre. Bos/bosluklu sorgu tum listeyi dondurur. */
export function filterAthletes(rows: AthleteRow[], query: string): AthleteRow[] {
  const q = trLower(query.trim());
  if (!q) return rows;
  return rows.filter((r) => trLower(r.display_name).includes(q));
}

/** /athletes listesi + lobideki aktif id'ler -> tek liste.
 *  Aktifler BASA alinir; her grup icinde gelen sira (ada gore) korunur. */
export function mergeOnline(all: Athlete[], onlineIds: number[]): AthleteRow[] {
  const set = new Set(onlineIds);
  const rows: AthleteRow[] = all.map((a) => ({ ...a, online: set.has(a.child_id) }));
  return [...rows.filter((r) => r.online), ...rows.filter((r) => !r.online)];
}

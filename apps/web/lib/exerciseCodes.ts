// Pratik sorularına 3 haneli kalıcı kod atama mantığı — admin panelinde ve
// öğrenci ekranında (Hızlı Erişim) AYNI algoritma kullanılır ki bir öğretmen
// öğrencinin gördüğü kodu admin panelinde bulup düzeltebilsin.

interface CodedExercise {
  code?: string;
}

/**
 * Listedeki her soru için gösterilecek kod: kayıtlı kodu varsa o, yoksa boşta olan en
 * küçük numara. Kayıtlı kodlarla ASLA çakışmaz (aksi halde bir soru silindiğinde iki
 * soru aynı kodu gösterebilir). Kayıt gerektirmez — eski (henüz admin'de hiç
 * düzenlenmemiş) sorular için de listedeki sırasına göre tutarlı bir kod üretir.
 */
export function assignExerciseCodes<T extends CodedExercise>(list: T[]): string[] {
  const used = new Set(list.map((e) => e.code).filter((c): c is string => !!c));
  const out: string[] = [];
  let next = 1;
  for (const ex of list) {
    if (ex.code) { out.push(ex.code); continue; }
    let c = String(next).padStart(3, '0');
    while (used.has(c)) { next++; c = String(next).padStart(3, '0'); }
    used.add(c);
    out.push(c);
    next++;
  }
  return out;
}

/**
 * Yeni eklenecek soru için bir sonraki kalıcı kod. O an ekranda gösterilen (kayıtlı veya
 * geçici) tüm kodların en büyüğünden büyük olanı alır — kodlar asla çakışmaz veya tekrar
 * kullanılmaz.
 */
export function nextExerciseCode<T extends CodedExercise>(list: T[]): string {
  const nums = assignExerciseCodes(list).map((c) => parseInt(c, 10)).filter((n) => !isNaN(n));
  return String(Math.max(0, ...nums) + 1).padStart(3, '0');
}

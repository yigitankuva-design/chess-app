/** Zorluğa göre ağırlıklı soru seçimi (madde 4/5/6) — saf mantık.
 *
 *  Her mod 20 soru ister, zorluk dağılımı farklıdır:
 *    Süresiz: 10 kolay · 7 orta · 3 zor
 *    Süreli:  10 kolay · 6 orta · 4 zor
 *    Test:     7 kolay · 7 orta · 6 zor
 *
 *  Havuzda difficulty degeri DIFFICULTY_LABELS'taki [1,3,5] disinda bir
 *  sey olabilir (eski veri, bos deger) — en yakin kovaya yuvarlanir, hic
 *  yoksa 'orta' sayilir. Bu yuzden secim asla soru kaybetmez.
 */

export interface DifficultyBucket { easy: number; medium: number; hard: number }

export const UNTIMED_MIX: DifficultyBucket = { easy: 10, medium: 7, hard: 3 };
export const TIMED_MIX: DifficultyBucket = { easy: 10, medium: 6, hard: 4 };
export const TEST_MIX: DifficultyBucket = { easy: 7, medium: 7, hard: 6 };

type Bucket = 'easy' | 'medium' | 'hard';

export function bucketOf(difficulty: number | undefined): Bucket {
  if (difficulty === undefined) return 'medium';
  if (difficulty <= 2) return 'easy';
  if (difficulty >= 4) return 'hard';
  return 'medium';
}

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Bir kovadan hedef sayı kadar seç; öncelik DAHA ÖNCE gösterilmemiş
 *  sorularda — havuz yeterliyse tekrar hiç girmez. Kova yeterli soru
 *  vermezse eksik kalan sayı diğer kovalara devredilir (çağıran halleder). */
function pickFromBucket<T>(
  items: T[], want: number, seenIds: Set<string>, idOf: (t: T) => string, rng: () => number,
): { picked: T[]; missing: number } {
  const fresh = shuffle(items.filter((it) => !seenIds.has(idOf(it))), rng);
  const stale = shuffle(items.filter((it) => seenIds.has(idOf(it))), rng);
  const picked = [...fresh, ...stale].slice(0, want);
  return { picked, missing: Math.max(0, want - picked.length) };
}

/**
 * Havuzdan zorluk dağılımına göre `count` soru seçer.
 *
 * @param pool          Tüm sorular (bu alt konu + bu mod).
 * @param mix           Hedef kova dağılımı (toplamı `count`'a eşit olmalı).
 * @param idOf          Bir sorunun kararlı kimliği (tekrar önleme için).
 * @param previousIds   Bir önceki turda gösterilen soruların kimlikleri.
 * @param rng           Test edilebilirlik için değiştirilebilir rastgelelik kaynağı.
 *
 * Havuz `count`'tan azsa TÜM havuz döner (eksik soru asla hata değildir —
 * KURAL #3: içerik eksikse sporcu dışarıda bırakılmaz, elde ne varsa gösterilir).
 */
export function pickWeighted<T>(
  pool: T[],
  mix: DifficultyBucket,
  getDifficulty: (t: T) => number | undefined,
  idOf: (t: T) => string,
  previousIds: string[] = [],
  rng: () => number = Math.random,
): T[] {
  const count = mix.easy + mix.medium + mix.hard;
  if (pool.length <= count) return shuffle(pool, rng);

  const seen = new Set(previousIds);
  const byBucket: Record<Bucket, T[]> = { easy: [], medium: [], hard: [] };
  for (const item of pool) byBucket[bucketOf(getDifficulty(item))].push(item);

  const wanted: Record<Bucket, number> = { easy: mix.easy, medium: mix.medium, hard: mix.hard };
  const chosenIds = new Set<string>();
  const result: T[] = [];
  let carry = 0;

  // Az stoklu kovadan cok stoklu kovaya sirayla devret; boylece toplam
  // HER ZAMAN count'a ulasir (havuz yeterliyse).
  const order: Bucket[] = ['hard', 'medium', 'easy'];
  for (const b of order) {
    const want = wanted[b] + carry;
    carry = 0;
    const available = byBucket[b].filter((it) => !chosenIds.has(idOf(it)));
    const { picked, missing } = pickFromBucket(available, want, seen, idOf, rng);
    for (const it of picked) { result.push(it); chosenIds.add(idOf(it)); }
    carry = missing;
  }

  // Hala eksikse (butun kovalar tukendiyse) kalan havuzdan doldur.
  if (result.length < count) {
    const rest = pool.filter((it) => !chosenIds.has(idOf(it)));
    const { picked } = pickFromBucket(rest, count - result.length, seen, idOf, rng);
    result.push(...picked);
  }

  return shuffle(result, rng);
}

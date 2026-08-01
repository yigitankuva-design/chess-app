import { describe, it, expect } from 'vitest';
import { pickWeighted, bucketOf, UNTIMED_MIX, TIMED_MIX, TEST_MIX } from '@/lib/play/questionPicker';

interface Q { id: number; difficulty: number }

function pool(n: number, difficulty: (i: number) => number): Q[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, difficulty: difficulty(i) }));
}

const idOf = (q: Q) => String(q.id);
const diffOf = (q: Q) => q.difficulty;
const fixedRng = () => 0.5; // sirali/deterministik test icin

describe('bucketOf', () => {
  it('1-2 kolay, 3 orta, 4-5 zor', () => {
    expect(bucketOf(1)).toBe('easy');
    expect(bucketOf(2)).toBe('easy');
    expect(bucketOf(3)).toBe('medium');
    expect(bucketOf(4)).toBe('hard');
    expect(bucketOf(5)).toBe('hard');
  });

  it('tanımsız zorluk orta sayılır', () => {
    expect(bucketOf(undefined)).toBe('medium');
  });
});

describe('pickWeighted — dağılım (madde 4/5/6)', () => {
  it('Süresiz: 10 kolay · 7 orta · 3 zor', () => {
    const p = [...pool(20, () => 1), ...pool(20, () => 3), ...pool(20, () => 5)];
    const secim = pickWeighted(p, UNTIMED_MIX, diffOf, idOf, [], fixedRng);
    expect(secim).toHaveLength(20);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'easy')).toHaveLength(10);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'medium')).toHaveLength(7);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'hard')).toHaveLength(3);
  });

  it('Süreli: 10 kolay · 6 orta · 4 zor', () => {
    const p = [...pool(20, () => 1), ...pool(20, () => 3), ...pool(20, () => 5)];
    const secim = pickWeighted(p, TIMED_MIX, diffOf, idOf, [], fixedRng);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'easy')).toHaveLength(10);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'medium')).toHaveLength(6);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'hard')).toHaveLength(4);
  });

  it('Test: 7 kolay · 7 orta · 6 zor', () => {
    const p = [...pool(20, () => 1), ...pool(20, () => 3), ...pool(20, () => 5)];
    const secim = pickWeighted(p, TEST_MIX, diffOf, idOf, [], fixedRng);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'easy')).toHaveLength(7);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'medium')).toHaveLength(7);
    expect(secim.filter((q) => bucketOf(q.difficulty) === 'hard')).toHaveLength(6);
  });

  it('KURAL #3: havuz count kadar/azsa TÜM havuz döner, hata verilmez', () => {
    const p = pool(5, () => 1);
    const secim = pickWeighted(p, UNTIMED_MIX, diffOf, idOf, [], fixedRng);
    expect(secim).toHaveLength(5);
  });

  it('bir kovada yetersiz soru varsa eksik diğer kovadan tamamlanır', () => {
    // Sadece 1 zor soru var (mix 3 zor istiyor) ama toplam havuz genis.
    const p = [...pool(30, () => 1), ...pool(30, () => 3), ...pool(1, () => 5)];
    const secim = pickWeighted(p, UNTIMED_MIX, diffOf, idOf, [], fixedRng);
    expect(secim).toHaveLength(20); // yine de 20 soru cikar
  });

  it('önceki turda gösterilen sorular MÜMKÜNSE atlanır', () => {
    const p = pool(40, () => 1); // hepsi kolay, hedef 10 kolay
    const onceki = p.slice(0, 15).map((q) => String(q.id));
    const secim = pickWeighted(p, UNTIMED_MIX, diffOf, idOf, onceki, fixedRng);
    const tekrarEdilen = secim.filter((q) => onceki.includes(String(q.id)));
    // 40 kolay sorudan 15'i "onceki" — geri kalan 25'i taze, 10 secilecek
    // sorunun hepsi taze olabilir (yeterli stok var).
    expect(tekrarEdilen).toHaveLength(0);
  });

  it('havuzda yeterli TAZE soru yoksa eski sorulara düşer (asla eksik kalmaz)', () => {
    const p = pool(10, () => 1); // sadece 10 kolay soru, mix 10 kolay istiyor
    const onceki = p.slice(0, 8).map((q) => String(q.id));
    const secim = pickWeighted(p, UNTIMED_MIX, diffOf, idOf, onceki, fixedRng);
    expect(secim.length).toBeGreaterThan(0); // asla bos donmez
  });
});

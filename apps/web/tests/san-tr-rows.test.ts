import { describe, it, expect } from 'vitest';
import { turkishMoveRows } from '@/lib/play/sanTr';

describe('turkishMoveRows — tıklanabilir hamleler için yapı (madde 1)', () => {
  it('hamleleri beyaz/siyah olarak AYIRIR ve Türkçeleştirir', () => {
    expect(turkishMoveRows(['e4', 'e5', 'Nf3'])).toEqual([
      { no: 1, white: { san: 'e4', ply: 1 }, black: { san: 'e5', ply: 2 } },
      { no: 2, white: { san: 'Af3', ply: 3 }, black: null },
    ]);
  });

  it('ply, fensFromSan dizisindeki indeksle eşleşir (1 tabanlı)', () => {
    const rows = turkishMoveRows(['e4', 'e5']);
    expect(rows[0].white!.ply).toBe(1);   // fens[1] = e4 sonrası
    expect(rows[0].black!.ply).toBe(2);   // fens[2] = e5 sonrası
  });

  it('siyah başlıyorsa ilk satırın beyaz hanesi boştur, numara kaymaz', () => {
    expect(turkishMoveRows(['Nf6'], { whiteStarts: false, firstNo: 3 })).toEqual([
      { no: 3, white: null, black: { san: 'Af6', ply: 1 } },
    ]);
  });

  it('rok yazımı olduğu gibi kalır', () => {
    expect(turkishMoveRows(['O-O'])[0].white).toEqual({ san: 'O-O', ply: 1 });
  });

  it('hamle yoksa boş dizi döner', () => {
    expect(turkishMoveRows([])).toEqual([]);
  });
});

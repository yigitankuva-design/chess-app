import { describe, it, expect } from 'vitest';
import { recorderState, tryAppendMove, notationRows } from '@/lib/chess/moveRecorder';

const KINGLESS = '8/8/8/8/8/8/4P3/8 w - - 0 1';   // Zafer'in öğretim pozisyonu
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1'; // gerçek prod pozisyonu
const BLACK_STARTS = '6k1/8/5K2/8/5R2/8/8/8 b - - 0 1';

describe('tryAppendMove', () => {
  it('ŞAHSIZ pozisyonda geçerli hamleyi SAN olarak ekler (skipValidation gerekli)', () => {
    expect(tryAppendMove(KINGLESS, [], 'e2', 'e4')).toEqual(['e4']);
  });

  it('kural dışı hamlede null döner', () => {
    expect(tryAppendMove(KINGLESS, [], 'e2', 'e8')).toBeNull();
  });

  it('iki taraflı pozisyonda art arda iki hamle eklenir', () => {
    const after1 = tryAppendMove(TWO_SIDED, [], 'f4', 'h4');
    expect(after1).toEqual(['Rh4']);
    expect(tryAppendMove(TWO_SIDED, after1!, 'g8', 'f8')).toEqual(['Rh4', 'Kf8']);
  });

  it('SIRA KİLİDİ: tek renkli pozisyonda ikinci hamle eklenemez', () => {
    expect(tryAppendMove(KINGLESS, ['e4'], 'e4', 'e5')).toBeNull();
  });
});

describe('recorderState', () => {
  it('şahsız pozisyonda ilk hamleden sonra sıkışır (karşı tarafın hamlesi yok)', () => {
    const s = recorderState(KINGLESS, ['e4']);
    expect(s.turn).toBe('b');
    expect(s.stuck).toBe(true);
  });

  it('iki taraflı pozisyonda sıkışmaz', () => {
    const s = recorderState(TWO_SIDED, ['Rh4']);
    expect(s.turn).toBe('b');
    expect(s.stuck).toBe(false);
  });

  it('hamlelerden sonraki güncel FEN döner', () => {
    expect(recorderState(KINGLESS, ['e4']).fen).toContain('4P3');
  });
});

describe('notationRows', () => {
  it('hamle yoksa boş dizi', () => {
    expect(notationRows(TWO_SIDED, [])).toEqual([]);
  });

  it('2 hamle → 1 satır (beyaz + siyah)', () => {
    expect(notationRows(TWO_SIDED, ['Rh4', 'Kf8'])).toEqual([
      { no: 1, white: 'Rh4', black: 'Kf8' },
    ]);
  });

  it('3 hamle → 2 satır, ikinci satırın siyahı boş', () => {
    expect(notationRows(TWO_SIDED, ['Rh4', 'Kf8', 'Rh7'])).toEqual([
      { no: 1, white: 'Rh4', black: 'Kf8' },
      { no: 2, white: 'Rh7', black: '' },
    ]);
  });

  it('SİYAH BAŞLARSA ilk satırın beyaz hücresi boş kalır', () => {
    expect(notationRows(BLACK_STARTS, ['Kf8'])).toEqual([
      { no: 1, white: '', black: 'Kf8' },
    ]);
  });
});

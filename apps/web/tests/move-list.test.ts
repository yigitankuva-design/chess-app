import { describe, it, expect } from 'vitest';
import { toMoveRows, parseFenStart } from '@/lib/play/moveList';

describe('toMoveRows — hamle satirlari (madde 1)', () => {
  it('hamle yoksa satır da yoktur', () => {
    expect(toMoveRows([])).toEqual([]);
  });

  it('beyaz-siyah çiftleri numaralanır', () => {
    expect(toMoveRows(['e4', 'e5', 'Af3', 'Ac6'])).toEqual([
      { no: 1, white: 'e4', black: 'e5' },
      { no: 2, white: 'Af3', black: 'Ac6' },
    ]);
  });

  it('tek hamlede siyah hanesi boş kalır', () => {
    expect(toMoveRows(['e4'])).toEqual([{ no: 1, white: 'e4', black: null }]);
  });

  it('siyah önce oynuyorsa ilk satırın BEYAZ hanesi boştur ve numara kaymaz', () => {
    const rows = toMoveRows(['Af6', 'd4', 'e6'], { whiteStarts: false, firstNo: 3 });
    expect(rows).toEqual([
      { no: 3, white: null, black: 'Af6' },
      { no: 4, white: 'd4', black: 'e6' },
    ]);
  });
});

describe('parseFenStart', () => {
  it('standart konum: beyaz başlar, 1. hamle', () => {
    expect(parseFenStart('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'))
      .toEqual({ whiteStarts: true, firstNo: 1 });
  });

  it('açılış konumu: siyah oynayacak, sayaç FEN’den okunur', () => {
    expect(parseFenStart('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 3'))
      .toEqual({ whiteStarts: false, firstNo: 3 });
  });

  it('TUZAK: bozuk FEN ekranı patlatmaz, standart varsayılır', () => {
    expect(parseFenStart('saçmalık')).toEqual({ whiteStarts: true, firstNo: 1 });
    expect(parseFenStart(undefined)).toEqual({ whiteStarts: true, firstNo: 1 });
    expect(parseFenStart('')).toEqual({ whiteStarts: true, firstNo: 1 });
  });
});

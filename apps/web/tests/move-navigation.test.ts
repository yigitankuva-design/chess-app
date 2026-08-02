import { describe, it, expect } from 'vitest';
import { fensFromSan, clampViewIndex } from '@/lib/play/moveNavigation';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('fensFromSan', () => {
  it('hamle yoksa yalnız başlangıç konumunu döndürür', () => {
    const fens = fensFromSan(undefined, []);
    expect(fens).toHaveLength(1);
    expect(fens[0].split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  });

  it('her yarı-hamle için bir konum üretir (uzunluk = hamle + 1)', () => {
    expect(fensFromSan(START, ['e4', 'e5', 'Nf3'])).toHaveLength(4);
  });

  it('0. eleman BAŞLANGIÇ konumudur, hamle uygulanmamıştır', () => {
    const fens = fensFromSan(START, ['e4']);
    expect(fens[0]).toBe(START);
  });

  it('i. eleman i. hamleden SONRAKİ konumdur', () => {
    const fens = fensFromSan(START, ['e4', 'e5']);
    expect(fens[1]).toContain('4P3');     // beyaz piyon e4'te
    expect(fens[1]).toContain(' b ');     // sıra siyahta
    expect(fens[2]).toContain(' w ');     // sıra tekrar beyazda
  });

  it('startFen verilmezse standart başlangıç kullanılır', () => {
    expect(fensFromSan(null, ['e4'])[0].split(' ')[0])
      .toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  });

  it('açılış konumundan başlayan maçta o konumdan devam eder', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(fensFromSan(fen, ['Nf3'])[0]).toBe(fen);
  });

  it('TUZAK: ŞAHSIZ öğretim pozisyonu çökmeye yol açmaz', () => {
    // Zafer Hoca'nin pozisyonlari KASTEN sahsizdir; skipValidation olmadan
    // chess.js "missing white king" firlatir ve notasyon gorunmez.
    const fen = '8/8/8/8/4P3/8/8/8 w - - 0 1';
    expect(() => fensFromSan(fen, [])).not.toThrow();
    expect(fensFromSan(fen, [])).toHaveLength(1);
  });

  it('TUZAK: bozuk SAN gelirse oynatılabildiği yere kadar üretir, çökmez', () => {
    const fens = fensFromSan(START, ['e4', 'zzz', 'Nf3']);
    expect(fens).toHaveLength(2);  // baslangic + e4
  });
});

describe('clampViewIndex', () => {
  it('sınır içindeki değeri aynen döndürür', () => {
    expect(clampViewIndex(2, 5)).toBe(2);
  });

  it('negatif değeri sıfıra çeker', () => {
    expect(clampViewIndex(-3, 5)).toBe(0);
  });

  it('taşan değeri son sıraya çeker', () => {
    expect(clampViewIndex(99, 5)).toBe(4);
  });

  it('boş listede sıfır döndürür (ekran kilitlenmez)', () => {
    expect(clampViewIndex(3, 0)).toBe(0);
  });
});

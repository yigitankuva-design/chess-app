import { describe, it, expect } from 'vitest';
import { toTurkishSan, turkishMovePairs } from '@/lib/play/sanTr';

describe('toTurkishSan — Türkçe notasyon (madde 3)', () => {
  it('taş harfleri Türkçeleşir', () => {
    expect(toTurkishSan('Nf3')).toBe('Af3');   // At
    expect(toTurkishSan('Bc4')).toBe('Fc4');   // Fil
    expect(toTurkishSan('Ra1')).toBe('Ka1');   // Kale
    expect(toTurkishSan('Qd8')).toBe('Vd8');   // Vezir
    expect(toTurkishSan('Ke2')).toBe('Şe2');   // Şah
  });

  it('TUZAK: Şah ile Kale birbirine karışmaz', () => {
    // Zincirleme replace yapılsaydı K→Ş sonra R→K ile şah kaleye dönerdi.
    expect(toTurkishSan('Kd2')).toBe('Şd2');
    expect(toTurkishSan('Rd2')).toBe('Kd2');
  });

  it('piyon hamlesi ve küçük harfli kare adları değişmez', () => {
    expect(toTurkishSan('e4')).toBe('e4');
    expect(toTurkishSan('exd5')).toBe('exd5');
    expect(toTurkishSan('b6')).toBe('b6');     // b DOSYASI file değil taş değil
  });

  it('rok olduğu gibi kalır', () => {
    expect(toTurkishSan('O-O')).toBe('O-O');
    expect(toTurkishSan('O-O-O')).toBe('O-O-O');
  });

  it('terfi, şah ve mat işaretleri korunur', () => {
    expect(toTurkishSan('e8=Q+')).toBe('e8=V+');
    expect(toTurkishSan('Nxe5#')).toBe('Axe5#');
  });
});

describe('turkishMovePairs — yan yana yazım', () => {
  it('beyaz ve siyah aynı satırda tire ile yazılır', () => {
    expect(turkishMovePairs(['e4', 'e5', 'Nf3', 'Nc6'])).toEqual([
      { no: 1, text: 'e4 – e5' },
      { no: 2, text: 'Af3 – Ac6' },
    ]);
  });

  it('tek hamlede tire yazılmaz', () => {
    expect(turkishMovePairs(['e4'])).toEqual([{ no: 1, text: 'e4' }]);
  });

  it('siyah önce oynuyorsa beyaz hanesi üç nokta ile gösterilir', () => {
    expect(turkishMovePairs(['Nf6'], { whiteStarts: false, firstNo: 3 }))
      .toEqual([{ no: 3, text: '… – Af6' }]);
  });

  it('hamle yoksa liste boştur', () => {
    expect(turkishMovePairs([])).toEqual([]);
  });
});

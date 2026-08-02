import { describe, it, expect } from 'vitest';
import { resolvePremove } from '@/lib/play/premove';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('resolvePremove — sıra gelince ön-hamle çözümü (madde 5)', () => {
  it('ön-hamle yoksa null döner', () => {
    expect(resolvePremove(START, null)).toBeNull();
  });

  it('geçerli ön-hamle aynen döner', () => {
    expect(resolvePremove(START, { from: 'e2', to: 'e4' }))
      .toEqual({ from: 'e2', to: 'e4' });
  });

  it('KURAL DIŞI ön-hamle sessizce iptal edilir (null)', () => {
    expect(resolvePremove(START, { from: 'e2', to: 'e5' })).toBeNull();
  });

  it('taşı olmayan kareden ön-hamle iptal edilir', () => {
    expect(resolvePremove(START, { from: 'e4', to: 'e5' })).toBeNull();
  });

  it('sıra rakipteyken (kendi taşı değilken) iptal edilir', () => {
    // Sira BEYAZDA; siyah tasla hamle denenirse gecersizdir.
    expect(resolvePremove(START, { from: 'e7', to: 'e5' })).toBeNull();
  });

  it('TUZAK: araya giren hamle ön-hamleyi geçersiz kılarsa iptal edilir', () => {
    // Beyaz sah cekiliyor; Af3 artik oynanamaz.
    const check = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(resolvePremove(check, { from: 'g1', to: 'f3' })).toBeNull();
  });

  it('TUZAK: bozuk FEN çökmeye yol açmaz', () => {
    expect(() => resolvePremove('bu FEN değil', { from: 'e2', to: 'e4' })).not.toThrow();
    expect(resolvePremove('bu FEN değil', { from: 'e2', to: 'e4' })).toBeNull();
  });
});

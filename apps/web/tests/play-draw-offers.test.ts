import { describe, it, expect } from 'vitest';
import { MAX_DRAW_OFFERS, canOfferDraw, offersLeft } from '@/lib/play/drawOffers';

describe('MAX_DRAW_OFFERS', () => {
  it('3tur (madde d)', () => expect(MAX_DRAW_OFFERS).toBe(3));
});

describe('canOfferDraw', () => {
  it('hiç teklif edilmemişse izin verir', () => expect(canOfferDraw(0)).toBe(true));
  it('1 ve 2 teklifte hâlâ izin verir', () => {
    expect(canOfferDraw(1)).toBe(true);
    expect(canOfferDraw(2)).toBe(true);
  });
  it('3 teklifte artık izin VERMEZ', () => expect(canOfferDraw(3)).toBe(false));
  it('3ten fazlaysa izin vermez (bozuk veri koruması)', () => {
    expect(canOfferDraw(4)).toBe(false);
  });
});

describe('offersLeft', () => {
  it('0 kullanıldıysa 3 hak kalır', () => expect(offersLeft(0)).toBe(3));
  it('2 kullanıldıysa 1 hak kalır', () => expect(offersLeft(2)).toBe(1));
  it('3 kullanıldıysa 0 hak kalır', () => expect(offersLeft(3)).toBe(0));
  it('negatife düşmez', () => expect(offersLeft(5)).toBe(0));
});

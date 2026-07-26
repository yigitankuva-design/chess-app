import { describe, it, expect } from 'vitest';
import { tempoEmoji, takerColorChoice, offerSummary } from '@/lib/play/offers';
import type { LobbyOffer } from '@/lib/play/offers';

const OFFER: LobbyOffer = {
  child_id: 7,
  display_name: 'Ayşe',
  tempo: 'Yıldırım',
  tc_label: '5+0',
  tc_base: 300,
  tc_increment: 0,
  color: 'white',
};

describe('tempoEmoji', () => {
  it('bilinen tempolar için doğru emoji döner', () => {
    expect(tempoEmoji('Yıldırım')).toBe('⚡');
    expect(tempoEmoji('Hızlı')).toBe('🚀');
    expect(tempoEmoji('Klasik')).toBe('🐢');
  });

  it('bilinmeyen tempo için boş dizge döner (uydurmaz)', () => {
    expect(tempoEmoji('Kaplumbağa Ligi')).toBe('');
  });
});

describe('takerColorChoice', () => {
  it('teklif beyazsa kabul eden siyah oynar', () => {
    expect(takerColorChoice('white')).toBe('black');
  });

  it('teklif siyahsa kabul eden beyaz oynar', () => {
    expect(takerColorChoice('black')).toBe('white');
  });

  it('rastgele teklifte kabul eden de rastgeledir', () => {
    expect(takerColorChoice('random')).toBe('random');
  });
});

describe('offerSummary', () => {
  it('tempo, süre ve KABUL EDENİN rengini birleştirir', () => {
    expect(offerSummary(OFFER)).toBe('⚡ Yıldırım · 5+0 · Sen: ⚫ Siyah');
  });

  it('rastgele teklifte renk rastgele gösterilir', () => {
    expect(offerSummary({ ...OFFER, color: 'random' }))
      .toBe('⚡ Yıldırım · 5+0 · Sen: 🎲 Rastgele');
  });
});

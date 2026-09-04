import { describe, it, expect } from 'vitest';
import { applyMove, currentFen, stepView } from '@/lib/chess/variantMoves';
import type { PlayedMove } from '@/lib/chess/variantMoves';

const START = 'start-fen';

function h(...sans: string[]): PlayedMove[] {
  return sans.map((san, i) => ({ ply: i + 1, san, fenAfter: `f${i + 1}` }));
}

describe('applyMove — ana hattın sonunda (madde 2026-09-06/7)', () => {
  it('sıradan yeni hamle dallanma yaratmaz', () => {
    const r = applyMove([], 0, null, { san: 'e4', fenAfter: 'f1' });
    expect(r).toEqual({ history: [{ ply: 1, san: 'e4', fenAfter: 'f1' }], viewIndex: 1, activeVariant: null });
  });
});

describe('applyMove — ana hatta geri gidip AYNI hamleyi tekrar oynamak', () => {
  it('dallanma yaratmadan sadece ilerler', () => {
    const history = h('e4', 'e5');
    const r = applyMove(history, 0, null, { san: 'e4', fenAfter: 'f1' });
    expect(r.history).toBe(history); // dokunulmadı
    expect(r.viewIndex).toBe(1);
    expect(r.activeVariant).toBeNull();
  });
});

describe('applyMove — ana hatta geri gidip FARKLI bir hamle oynamak', () => {
  it('ana hat SİLİNMEZ, o ply\'a varyant eklenir ve varyant moduna geçilir', () => {
    const history = h('e4', 'e5', 'Nf3');
    const r = applyMove(history, 0, null, { san: 'd4', fenAfter: 'g1' });
    // Ana hat aynen duruyor:
    expect(r.history.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(r.history[0].variant).toEqual([{ ply: 1, san: 'd4', fenAfter: 'g1' }]);
    expect(r.viewIndex).toBe(0);
    expect(r.activeVariant).toEqual({ atPly: 1, index: 1 });
  });

  it('varyant içinde devam hamlesi oynayınca varyant büyür', () => {
    const history = h('e4', 'e5', 'Nf3');
    const withVariant = applyMove(history, 0, null, { san: 'd4', fenAfter: 'g1' });
    const r2 = applyMove(withVariant.history, withVariant.viewIndex, withVariant.activeVariant,
      { san: 'd5', fenAfter: 'g2' });
    expect(r2.history[0].variant).toEqual([
      { ply: 1, san: 'd4', fenAfter: 'g1' },
      { ply: 2, san: 'd5', fenAfter: 'g2' },
    ]);
    expect(r2.activeVariant).toEqual({ atPly: 1, index: 2 });
    // Ana hat hâlâ dokunulmamış:
    expect(r2.history.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('varyant içinde geri gidip farklı hamle oynamak varyantın kuyruğunu değiştirir (tek seviye, dallanmaz)', () => {
    const history = h('e4');
    const v1 = applyMove(history, 0, null, { san: 'd4', fenAfter: 'g1' });
    const v2 = applyMove(v1.history, v1.viewIndex, v1.activeVariant, { san: 'd5', fenAfter: 'g2' });
    // Varyantın 1. hamlesine geri dönüp BAŞKA bir devam dene:
    const backInVariant = { atPly: 1, index: 1 } as const;
    const v3 = applyMove(v2.history, 0, backInVariant, { san: 'Nf3', fenAfter: 'g3' });
    expect(v3.history[0].variant).toEqual([
      { ply: 1, san: 'd4', fenAfter: 'g1' },
      { ply: 2, san: 'Nf3', fenAfter: 'g3' },
    ]);
  });
});

describe('currentFen', () => {
  const history = h('e4', 'e5');

  it('ana hatta, viewIndex 0 → başlangıç FEN', () => {
    expect(currentFen(START, history, 0, null)).toBe(START);
  });

  it('ana hatta, viewIndex N → history[N-1].fenAfter', () => {
    expect(currentFen(START, history, 2, null)).toBe('f2');
  });

  it('varyant index 0 → dallanma noktasının BİR ÖNCESİ', () => {
    const withVariant = history.map((m, i) => (i === 1 ? { ...m, variant: [{ ply: 1, san: 'Nf3', fenAfter: 'g1' }] } : m));
    expect(currentFen(START, withVariant, 1, { atPly: 2, index: 0 })).toBe('f1');
  });

  it('varyant index N → variant[N-1].fenAfter', () => {
    const withVariant = history.map((m, i) => (i === 1 ? { ...m, variant: [{ ply: 1, san: 'Nf3', fenAfter: 'g1' }] } : m));
    expect(currentFen(START, withVariant, 1, { atPly: 2, index: 1 })).toBe('g1');
  });
});

describe('stepView', () => {
  const history = h('e4', 'e5', 'Nf3');

  it('ana hatta ileri/geri 0..history.length arasında sınırlanır', () => {
    expect(stepView(history, 3, null, 1)).toEqual({ viewIndex: 3, activeVariant: null });
    expect(stepView(history, 0, null, -1)).toEqual({ viewIndex: 0, activeVariant: null });
  });

  it('varyant içinde ileri gidince index artar, uzunlukta sınırlanır', () => {
    const withVariant = history.map((m, i) => (i === 0 ? { ...m, variant: [{ ply: 1, san: 'd4', fenAfter: 'g1' }] } : m));
    const r = stepView(withVariant, 0, { atPly: 1, index: 1 }, 1);
    expect(r).toEqual({ viewIndex: 0, activeVariant: { atPly: 1, index: 1 } }); // zaten sonunda, sınırlandı
  });

  it('varyantın başında geri gidince ana hatta (dallanma noktasının bir öncesine) çıkılır', () => {
    const withVariant = history.map((m, i) => (i === 1 ? { ...m, variant: [{ ply: 1, san: 'd4', fenAfter: 'g1' }] } : m));
    const r = stepView(withVariant, 99 /* kullanılmaz */, { atPly: 2, index: 0 }, -1);
    expect(r).toEqual({ viewIndex: 1, activeVariant: null });
  });
});

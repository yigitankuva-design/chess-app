import { describe, it, expect } from 'vitest';
import { fenToMap, mapToFen, START_FEN, EMPTY_FEN } from '@/components/BoardEditor';

describe('BoardEditor FEN yardımcıları', () => {
  it('başlangıç konumunu doğru çözer', () => {
    const map = fenToMap(START_FEN);
    expect(map['e1']).toBe('K');
    expect(map['e8']).toBe('k');
    expect(map['a2']).toBe('P');
    expect(Object.keys(map).length).toBe(32);
  });

  it('boş tahtayı doğru çözer', () => {
    expect(Object.keys(fenToMap(EMPTY_FEN)).length).toBe(0);
  });

  it('gidiş-dönüş: harita -> FEN -> harita aynı kalır', () => {
    const map = fenToMap(START_FEN);
    const fen = mapToFen(map, 'w');
    expect(fenToMap(fen)).toEqual(map);
  });

  it('boş harita boş tahta FEN üretir', () => {
    expect(mapToFen({}, 'w')).toBe('8/8/8/8/8/8/8/8 w - - 0 1');
  });

  it("Zafer'in tek piyon pozisyonunu üretebilir", () => {
    expect(mapToFen({ e2: 'P' }, 'w')).toBe('8/8/8/8/8/8/4P3/8 w - - 0 1');
  });

  it('hamle sırası FEN e yansır', () => {
    expect(mapToFen({ e4: 'n' }, 'b')).toBe('8/8/8/8/4n3/8/8/8 b - - 0 1');
  });
});

describe('BoardEditor — rok hakları (madde: rok/geçerken alma düzeltmesi)', () => {
  it('başlangıç konumundan üretilen FEN "KQkq" rok haklarını taşır (round-trip)', () => {
    const fen = mapToFen(fenToMap(START_FEN), 'w');
    expect(fen.split(' ')[2]).toBe('KQkq');
  });

  it('kral+her iki kale başlangıç karesindeyse dört hak da verilir', () => {
    const map = { e1: 'K', a1: 'R', h1: 'R', e8: 'k', a8: 'r', h8: 'r' };
    expect(mapToFen(map, 'w').split(' ')[2]).toBe('KQkq');
  });

  it('sadece beyaz kısa rok mümkünse yalnız K verilir', () => {
    const map = { e1: 'K', h1: 'R' };
    expect(mapToFen(map, 'w').split(' ')[2]).toBe('K');
  });

  it('sadece siyah uzun rok mümkünse yalnız q verilir', () => {
    const map = { e8: 'k', a8: 'r' };
    expect(mapToFen(map, 'w').split(' ')[2]).toBe('q');
  });

  it('kral başlangıç karesinde DEĞİLSE o taraf için hiç hak verilmez', () => {
    const map = { e2: 'K', a1: 'R', h1: 'R' };
    expect(mapToFen(map, 'w').split(' ')[2]).toBe('-');
  });

  it('kale başlangıç karesinde DEĞİLSE (taşınmış/farklı taş) o yön düşer', () => {
    const map = { e1: 'K', a1: 'R', h2: 'R' }; // kale h1 yerine h2'de
    expect(mapToFen(map, 'w').split(' ')[2]).toBe('Q');
  });

  it('hiç kral/kale yoksa "-" döner (mevcut davranış korunur)', () => {
    expect(mapToFen({}, 'w').split(' ')[2]).toBe('-');
  });

  it('geçerken alma alanı HER ZAMAN "-" kalır (statik dizmede anlamsız)', () => {
    const map = { e1: 'K', a1: 'R', h1: 'R', e8: 'k', a8: 'r', h8: 'r' };
    expect(mapToFen(map, 'w').split(' ')[3]).toBe('-');
  });
});

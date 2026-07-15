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

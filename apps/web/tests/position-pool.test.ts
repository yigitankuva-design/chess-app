import { describe, it, expect, vi } from 'vitest';
import { pickRandomPosition, pickDifferentPosition } from '@/lib/play/positionPool';

const POOL = [
  { id: 'a', fen: 'fen-a' },
  { id: 'b', fen: 'fen-b' },
  { id: 'c', fen: 'fen-c' },
];

describe('positionPool', () => {
  it('pickRandomPosition havuzdan bir öğe döner', () => {
    const picked = pickRandomPosition(POOL);
    expect(POOL).toContainEqual(picked);
  });

  it('pickDifferentPosition havuzda 2+ öğe varsa hariç tutulanı DÖNDÜRMEZ', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const picked = pickDifferentPosition(POOL, 'a');
    expect(picked.id).not.toBe('a');
    vi.restoreAllMocks();
  });

  it('pickDifferentPosition havuzda tek öğe varsa aynısını döner', () => {
    const single = [{ id: 'only', fen: 'fen-only' }];
    const picked = pickDifferentPosition(single, 'only');
    expect(picked.id).toBe('only');
  });

  it('pickDifferentPosition excludeId null iken tüm havuzdan seçer', () => {
    const picked = pickDifferentPosition(POOL, null);
    expect(POOL).toContainEqual(picked);
  });
});

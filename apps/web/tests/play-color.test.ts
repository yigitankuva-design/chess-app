import { describe, it, expect, vi, afterEach } from 'vitest';
import { COLOR_CHOICES, resolveColor, oppositeColor } from '@/lib/play/color';

afterEach(() => vi.restoreAllMocks());

describe('COLOR_CHOICES', () => {
  it('üç seçenek: Beyaz, Rastgele, Siyah (madde f)', () => {
    expect(COLOR_CHOICES.map((c) => c.value)).toEqual(['white', 'random', 'black']);
    expect(COLOR_CHOICES.map((c) => c.label)).toEqual(['Beyaz', 'Rastgele', 'Siyah']);
  });
});

describe('resolveColor', () => {
  it('beyaz seçilirse w döner', () => expect(resolveColor('white')).toBe('w'));
  it('siyah seçilirse b döner', () => expect(resolveColor('black')).toBe('b'));

  it('rastgele: 0.4 → w', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    expect(resolveColor('random')).toBe('w');
  });

  it('rastgele: 0.6 → b', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    expect(resolveColor('random')).toBe('b');
  });

  it('rastgele: tam 0.5 sınırı b döner (deterministik sınır)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(resolveColor('random')).toBe('b');
  });
});

describe('oppositeColor', () => {
  it('w → b', () => expect(oppositeColor('w')).toBe('b'));
  it('b → w', () => expect(oppositeColor('b')).toBe('w'));
});

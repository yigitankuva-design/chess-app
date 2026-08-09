import { describe, it, expect, vi } from 'vitest';
import { shouldBlunder, pickBlunderMove } from '@/lib/play/blunder';

describe('blunder', () => {
  it('shouldBlunder: random ihtimalden küçükse true döner', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(shouldBlunder(0.5)).toBe(true);
    vi.restoreAllMocks();
  });

  it('shouldBlunder: random ihtimalden büyükse false döner', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    expect(shouldBlunder(0.5)).toBe(false);
    vi.restoreAllMocks();
  });

  it('shouldBlunder: ihtimal 0 iken her zaman false', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(shouldBlunder(0)).toBe(false);
    vi.restoreAllMocks();
  });

  it('pickBlunderMove: tek aday varsa onu döner', () => {
    expect(pickBlunderMove(['e2e4'])).toBe('e2e4');
  });

  it('pickBlunderMove: en iyi adayı (0. sıra) HİÇ seçmez', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const picked = pickBlunderMove(['e2e4', 'd2d4', 'g1f3']);
    expect(picked).not.toBe('e2e4');
    expect(['d2d4', 'g1f3']).toContain(picked);
    vi.restoreAllMocks();
  });
});

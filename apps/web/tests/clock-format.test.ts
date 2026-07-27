import { describe, it, expect } from 'vitest';
import { formatClock, isLowTime } from '@/lib/play/clockFormat';

describe('formatClock', () => {
  it('dakika:saniye biçiminde gösterir', () => {
    expect(formatClock(300_000)).toBe('05:00');
    expect(formatClock(59_000)).toBe('00:59');
    expect(formatClock(0)).toBe('00:00');
  });

  it('son 10 saniyede ondalık gösterir', () => {
    expect(formatClock(9_400)).toBe('09.4');
    expect(formatClock(1_050)).toBe('01.0');
  });

  it('negatif değer ASLA eksi göstermez', () => {
    expect(formatClock(-5_000)).toBe('00:00');
  });

  it('bir saati aşan süreyi dakika olarak yazar', () => {
    expect(formatClock(3_600_000)).toBe('60:00');
  });
});

describe('isLowTime', () => {
  it('10 saniyenin altı düşük süredir', () => {
    expect(isLowTime(9_999)).toBe(true);
    expect(isLowTime(10_000)).toBe(false);
    expect(isLowTime(-1)).toBe(true);
  });
});

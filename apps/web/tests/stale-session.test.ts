import { describe, it, expect } from 'vitest';
import { isSessionStale } from '@/lib/play/staleSession';

describe('isSessionStale — kayıtlı oturum güncel havuzla uyuşmuyor mu (madde 4)', () => {
  it('kayıtlı 4 soru, havuz 20+ soruya büyümüş (randomPick=20) → bayat', () => {
    expect(isSessionStale(4, 25, 20)).toBe(true);
  });

  it('kayıtlı 20 soru, havuz hâlâ 20+ destekliyor → GÜNCEL', () => {
    expect(isSessionStale(20, 25, 20)).toBe(false);
  });

  it('havuz küçük (10), kayıtlı da havuzun tamamı (10) → GÜNCEL', () => {
    expect(isSessionStale(10, 10, 20)).toBe(false);
  });

  it('havuz küçüldü (eskiden 10 soruydu, şimdi 6) → bayat', () => {
    expect(isSessionStale(10, 6, 20)).toBe(true);
  });

  it('randomPick=0 (tüm havuz sırayla) — kayıtlı sayı havuz sayısıyla eşleşmeli', () => {
    expect(isSessionStale(5, 8, 0)).toBe(true);
    expect(isSessionStale(8, 8, 0)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { isCriteriaUnlocked, openingSummary } from '@/lib/play/openingSteps';

describe('isCriteriaUnlocked', () => {
  it('açılış seçilmediyse kilitlidir', () => {
    expect(isCriteriaUnlocked(null)).toBe(false);
  });

  it('açılış seçildiyse açılabilir', () => {
    expect(isCriteriaUnlocked('İtalyan Açılışı')).toBe(true);
  });

  it('boş ad seçim sayılmaz', () => {
    expect(isCriteriaUnlocked('')).toBe(false);
    expect(isCriteriaUnlocked('   ')).toBe(false);
  });
});

describe('openingSummary', () => {
  it('seçim yoksa null döner', () => {
    expect(openingSummary(null)).toBeNull();
    expect(openingSummary('  ')).toBeNull();
  });

  it('seçim varsa tik işaretli özet döner', () => {
    expect(openingSummary('İtalyan Açılışı')).toBe('✓ İtalyan Açılışı');
  });

  it('baştaki/sondaki boşlukları kırpar', () => {
    expect(openingSummary('  Sicilya Savunması  ')).toBe('✓ Sicilya Savunması');
  });
});

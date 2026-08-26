import { describe, it, expect } from 'vitest';
import { isLevelCode, renderSectionIcon, LEVEL_CODES } from '@/lib/customTabs/levelBadge';
import { isValidElement } from 'react';

describe('isLevelCode', () => {
  it('5 seviye kodunun hepsini tanır', () => {
    for (const code of LEVEL_CODES) expect(isLevelCode(code)).toBe(true);
  });

  it('emoji ya da boş/null/undefined değerleri seviye kodu SAYMAZ', () => {
    expect(isLevelCode('🎯')).toBe(false);
    expect(isLevelCode('')).toBe(false);
    expect(isLevelCode(null)).toBe(false);
    expect(isLevelCode(undefined)).toBe(false);
  });
});

describe('renderSectionIcon', () => {
  it('seviye koduysa bir React elemanı (rozet) döner', () => {
    const result = renderSectionIcon('TD');
    expect(isValidElement(result)).toBe(true);
  });

  it('normal emoji ise emoji metnini aynen döner', () => {
    expect(renderSectionIcon('🏆')).toBe('🏆');
  });

  it('boş/null/undefined ise fallback döner (varsayılan 🎯)', () => {
    expect(renderSectionIcon(null)).toBe('🎯');
    expect(renderSectionIcon(undefined)).toBe('🎯');
    expect(renderSectionIcon('')).toBe('🎯');
  });

  it('özel fallback verilirse onu kullanır', () => {
    expect(renderSectionIcon(null, '➕')).toBe('➕');
  });
});

import { describe, it, expect } from 'vitest';
import { isLevelCode, renderSectionIcon, renderTabIcon, isImageIcon, LEVEL_CODES } from '@/lib/customTabs/levelBadge';
import { isValidElement, createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

  it('madde 2026-09-19: resim (data URL) ise %100 boyutlu <img> döner', () => {
    const result = renderSectionIcon('data:image/png;base64,ABC');
    expect(isValidElement(result)).toBe(true);
    const html = renderToStaticMarkup(result as ReactElement);
    expect(html).toContain('<img');
    expect(html).toContain('src="data:image/png;base64,ABC"');
  });
});

describe('isImageIcon', () => {
  it('sadece data:image/ ile başlayan değerleri resim sayar', () => {
    expect(isImageIcon('data:image/png;base64,ABC')).toBe(true);
    expect(isImageIcon('data:image/jpeg;base64,ABC')).toBe(true);
    expect(isImageIcon('🏆')).toBe(false);
    expect(isImageIcon('TD')).toBe(false);
    expect(isImageIcon('')).toBe(false);
    expect(isImageIcon(null)).toBe(false);
    expect(isImageIcon(undefined)).toBe(false);
  });
});

describe('renderTabIcon (madde 2026-09-19)', () => {
  it('resimse sabit piksel boyutlu <img> döner (size varsayılan 45)', () => {
    const result = renderTabIcon('data:image/png;base64,ABC', '🔔');
    const html = renderToStaticMarkup(result as ReactElement);
    expect(html).toContain('<img');
    expect(html).toContain('width="45"');
    expect(html).toContain('height="45"');
  });

  it('verilen size parametresini kullanır', () => {
    const result = renderTabIcon('data:image/png;base64,ABC', '🔔', 60);
    const html = renderToStaticMarkup(result as ReactElement);
    expect(html).toContain('width="60"');
  });

  it('emoji ise emoji metnini aynen döner', () => {
    expect(renderTabIcon('🔔', '🎯')).toBe('🔔');
  });

  it('boş/null/undefined ise fallback (ReactNode) döner', () => {
    const fallback = createElement('span', null, 'FALLBACK');
    expect(renderTabIcon(null, fallback)).toBe(fallback);
    expect(renderTabIcon('', fallback)).toBe(fallback);
  });
});

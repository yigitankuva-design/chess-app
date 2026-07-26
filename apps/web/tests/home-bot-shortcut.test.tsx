import { describe, it, expect } from 'vitest';
import { LEVELS, TIME_GROUPS } from '@/lib/play/levels';
import { HOME_BOT_LEVELS, HOME_TEMPO_GROUPS } from '@/app/(child)/home/botShortcut';

describe('Ana sayfa bot kısayolu — tek kaynak', () => {
  it('ana sayfa zorluk listesi lib/play/levels ile AYNI skill değerlerini kullanır', () => {
    expect(HOME_BOT_LEVELS.map((b) => b.skill)).toEqual(LEVELS.map((l) => l.skill));
  });

  it('ana sayfa zorluk listesi 8 seviyedir', () => {
    expect(HOME_BOT_LEVELS).toHaveLength(8);
  });

  it('her seviyenin depth değeri lib ile aynıdır', () => {
    expect(HOME_BOT_LEVELS.map((b) => b.depth)).toEqual(LEVELS.map((l) => l.depth));
  });

  it('ana sayfada Süresiz tempo kategorisi YOKTUR (madde g)', () => {
    expect(HOME_TEMPO_GROUPS.map((g) => g.cat)).not.toContain('Süresiz');
  });

  it('tempo kategorileri lib ile aynıdır', () => {
    expect(HOME_TEMPO_GROUPS.map((g) => g.cat)).toEqual(TIME_GROUPS.map((g) => g.cat));
  });

  it('her kategorinin tempo etiketleri lib ile aynıdır', () => {
    for (const [i, g] of HOME_TEMPO_GROUPS.entries()) {
      expect(g.items).toEqual(TIME_GROUPS[i].items.map((t) => t.label));
    }
  });

  it('hiçbir kategori boş değildir (boş = eski Süresiz kalıntısı)', () => {
    for (const g of HOME_TEMPO_GROUPS) expect(g.items.length).toBeGreaterThan(0);
  });
});

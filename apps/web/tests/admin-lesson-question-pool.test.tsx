import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Soru daireleri açılır bir havuz kartının içinde olmalı (kalabalık şikayeti).
 * Sayfanın kendisini render etmek ağır mock gerektirdiği için — mevcut
 * admin-lesson-modes-share-form.test.tsx ile aynı gerekçe — burada YAPI
 * kilitlenir: biri kartı kaldırırsa test yakalar.
 */
const SRC = readFileSync(
  join(process.cwd(), 'app/admin/content/lesson/[lessonId]/page.tsx'),
  'utf8',
);

describe('Admin ders sayfası — soru havuzu kartı', () => {
  it('CollapsibleCard içe aktarılır', () => {
    expect(SRC).toContain("from '@/components/admin/CollapsibleCard'");
  });

  it('havuz başlığı bölüm adından üretilir', () => {
    expect(SRC).toContain('Soru Havuzu');
    expect(SRC).toContain('mode.label');
  });

  it('soru sayısı rozet olarak verilir', () => {
    expect(SRC).toMatch(/badge=\{`\$\{list\.length\} soru`\}/);
  });

  it('bir soru düzenlenirken kart AÇIK tutulur', () => {
    expect(SRC).toContain('forceOpen=');
  });

  it('bölüm rengi karta geçirilir', () => {
    expect(SRC).toContain('accentColor={mode.color}');
  });
});

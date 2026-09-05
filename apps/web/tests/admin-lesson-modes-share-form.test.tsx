import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Madde 4: Süresiz Pratik Yap'taki (madde 2026-09-05'ten sonra "Ödevini
 * Yap") soru yazma formatı Süreli Pratik Yap ve Kendini Test Et'te de
 * kullanılmalı.
 *
 * Bu YAPISAL bir güvencedir: admin ders sayfası üç modu tek bir EX_MODES
 * listesinden üretir ve hepsi AYNI <ExerciseForm> bileşenini render eder.
 * Yani C alt projesindeki adım listeleri üç moda da kendiliğinden gelir.
 *
 * Test dosyayı okuyup bu yapıyı kilitler: biri modlardan birine ayrı bir form
 * koymaya kalkarsa burada yakalanır. (Sayfanın kendisini render etmek ağır
 * mock gerektirir; korunmak istenen şey render değil, YAPIdır.)
 */
const SRC = readFileSync(
  join(process.cwd(), 'app/admin/content/lesson/[lessonId]/page.tsx'),
  'utf8',
);

describe('Admin ders sayfası — üç pratik modu aynı formu paylaşır', () => {
  it('üç mod da tek EX_MODES listesinde tanımlıdır', () => {
    expect(SRC).toContain("label: 'Ödevini Yap'");
    expect(SRC).toContain("label: 'Süreli Pratik Yap'");
    expect(SRC).toContain("label: 'Kendini Test Et'");
  });

  it('üç modun listesi de mode.field üzerinden aynı akışa bağlanır', () => {
    // Ekleme ve düzenleme yolları mod adına göre DALLANMAZ; field parametriktir.
    expect(SRC).toContain('addExercise(s, mode.field, ex)');
    expect(SRC).toContain('updateExercise(s, mode.field, editingExercise.idx, ex)');
  });

  it('BAŞKA bir soru formu bileşeni kullanılmaz (tek form kuralı)', () => {
    const formTags = SRC.match(/<ExerciseForm/g) ?? [];
    expect(formTags.length).toBe(2);          // biri ekleme, biri düzenleme
    expect(SRC).not.toMatch(/<(Timed|Test)ExerciseForm/);
  });
});

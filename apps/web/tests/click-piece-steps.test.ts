import { describe, it, expect } from 'vitest';
import { clickPieceSteps, CLICK_PIECE_STEP_LABELS } from '@/lib/admin/clickPieceSteps';
import type { ClickPieceStepState } from '@/lib/admin/clickPieceSteps';

const empty: ClickPieceStepState = {
  instruction: '',
  setupFen: '8/8/8/8/8/8/8/8 w - - 0 1',
  savedFen: null,
  pieceSquares: [],
  answerSaved: false,
  turnChosen: false,
  difficultyChosen: false,
};

const full: ClickPieceStepState = {
  instruction: 'Şaha tıkla',
  setupFen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  savedFen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  pieceSquares: ['e4'],
  answerSaved: true,
  turnChosen: true,
  difficultyChosen: true,
};

describe('clickPieceSteps', () => {
  it('8 adım vardır ve sonuncusu Soruyu Ekle', () => {
    expect(CLICK_PIECE_STEP_LABELS).toHaveLength(7);
    const steps = clickPieceSteps(empty);
    expect(steps).toHaveLength(8);
    expect(steps[7].label).toBe('Soruyu Ekle');
  });

  it('adım sırası kullanıcının verdiği sıradır', () => {
    expect(clickPieceSteps(empty).map((s) => s.label)).toEqual([
      'Talimatı Gir',
      'Konumu Diz',
      'Konumu Kaydet',
      'Cevap Taşlarını Seç',
      'Taş Seçimini Kaydet',
      'Hamle Sırasını Belirle',
      'Zorluk Düzeyini Belirle',
      'Soruyu Ekle',
    ]);
  });

  it('boş durumda hiçbir adım tamam değildir', () => {
    expect(clickPieceSteps(empty).every((s) => !s.done)).toBe(true);
  });

  it('tam durumda tüm adımlar tamamdır', () => {
    expect(clickPieceSteps(full).every((s) => s.done)).toBe(true);
  });

  it('cevap taşı seçilince 4. adım tamam olur', () => {
    const s = clickPieceSteps({ ...empty, pieceSquares: ['e4'] });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(false); // henüz kaydedilmedi
  });

  it('son adım ancak diğer 7 adım bitince tamam olur', () => {
    const s = clickPieceSteps({ ...full, difficultyChosen: false });
    expect(s[6].done).toBe(false);
    expect(s[7].done).toBe(false);
  });

  it('konum kaydedilmişse Konumu Diz de tamam sayılır', () => {
    const s = clickPieceSteps({ ...empty, savedFen: '8/8/8/8/8/8/8/8 w - - 0 1' });
    expect(s[1].done).toBe(true);
    expect(s[2].done).toBe(true);
  });
});

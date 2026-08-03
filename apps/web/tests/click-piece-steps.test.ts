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
  it('9 adım vardır ve sonuncusu Soruyu Ekle', () => {
    expect(CLICK_PIECE_STEP_LABELS).toHaveLength(8);
    const steps = clickPieceSteps(empty);
    expect(steps).toHaveLength(9);
    expect(steps[8].label).toBe('Soruyu Ekle');
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
      'Yazı-Şekil-Renk Ekle',
      'Soruyu Ekle',
    ]);
  });

  it('boş durumda "Yazı-Şekil-Renk Ekle" hariç hiçbir adım tamam değildir (o adım opsiyonel)', () => {
    const steps = clickPieceSteps(empty);
    const others = steps.filter((s) => s.label !== 'Yazı-Şekil-Renk Ekle' && s.label !== 'Soruyu Ekle');
    expect(others.every((s) => !s.done)).toBe(true);
    expect(steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle')?.done).toBe(true);
  });

  it('tam durumda tüm adımlar tamamdır', () => {
    expect(clickPieceSteps(full).every((s) => s.done)).toBe(true);
  });

  it('cevap taşı seçilince 4. adım tamam olur', () => {
    const s = clickPieceSteps({ ...empty, pieceSquares: ['e4'] });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(false); // henüz kaydedilmedi
  });

  it('son adım ancak diğer 8 adım bitince tamam olur', () => {
    const s = clickPieceSteps({ ...full, difficultyChosen: false });
    expect(s[6].done).toBe(false);
    expect(s[8].done).toBe(false);
  });

  it('konum kaydedilmişse Konumu Diz de tamam sayılır', () => {
    const s = clickPieceSteps({ ...empty, savedFen: '8/8/8/8/8/8/8/8 w - - 0 1' });
    expect(s[1].done).toBe(true);
    expect(s[2].done).toBe(true);
  });
});

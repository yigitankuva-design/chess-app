import { describe, it, expect } from 'vitest';
import { placePiecesSteps, PLACE_PIECES_STEP_LABELS } from '@/lib/admin/placePiecesSteps';
import type { PlacePiecesStepState } from '@/lib/admin/placePiecesSteps';

const empty: PlacePiecesStepState = {
  instruction: '',
  setupFen: '8/8/8/8/8/8/8/8 w - - 0 1',
  savedFen: null,
  selectedPiece: null,
  pieces: [],
  answerSaved: false,
  turnChosen: false,
  difficultyChosen: false,
};

const full: PlacePiecesStepState = {
  instruction: 'Veziri mat karesine koy',
  setupFen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
  savedFen: '7k/8/8/8/8/8/8/K7 w - - 0 1',
  selectedPiece: null,
  pieces: [{ piece: 'Q', square: 'h5' }],
  answerSaved: true,
  turnChosen: true,
  difficultyChosen: true,
};

describe('placePiecesSteps', () => {
  it('10 adım vardır ve sonuncusu Soruyu Ekle', () => {
    expect(PLACE_PIECES_STEP_LABELS).toHaveLength(9);
    const steps = placePiecesSteps(empty);
    expect(steps).toHaveLength(10);
    expect(steps[9].label).toBe('Soruyu Ekle');
  });

  it('adım sırası kullanıcının verdiği sıradır', () => {
    const labels = placePiecesSteps(empty).map((s) => s.label);
    expect(labels).toEqual([
      'Talimatı Gir',
      'Konumu Diz',
      'Konumu Kaydet',
      'Konuma Eklenecek Taşları Belirle',
      'Taşların Doğru Karelerini Belirle',
      'Cevabı Kaydet',
      'Hamle Sırasını Belirle',
      'Zorluk Düzeyini Belirle',
      'Yazı-Şekil-Renk Ekle',
      'Soruyu Ekle',
    ]);
  });

  it('boş durumda "Yazı-Şekil-Renk Ekle" hariç hiçbir adım tamam değildir (o adım opsiyonel)', () => {
    const steps = placePiecesSteps(empty);
    const others = steps.filter((s) => s.label !== 'Yazı-Şekil-Renk Ekle' && s.label !== 'Soruyu Ekle');
    expect(others.every((s) => !s.done)).toBe(true);
    expect(steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle')?.done).toBe(true);
  });

  it('tam durumda tüm adımlar tamamdır', () => {
    expect(placePiecesSteps(full).every((s) => s.done)).toBe(true);
  });

  it('palette taş seçilince 4. adım tamam olur, 5. adım olmaz', () => {
    const s = placePiecesSteps({ ...empty, selectedPiece: 'Q' });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(false);
  });

  it('çift oluşunca hem 4. hem 5. adım tamam olur', () => {
    const s = placePiecesSteps({ ...empty, pieces: [{ piece: 'Q', square: 'h5' }] });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(true);
  });

  it('konum kaydedilmişse Konumu Diz de tamam sayılır (boş tahta meşrudur)', () => {
    const s = placePiecesSteps({ ...empty, savedFen: '8/8/8/8/8/8/8/8 w - - 0 1' });
    expect(s[1].done).toBe(true);
    expect(s[2].done).toBe(true);
  });

  it('son adım ancak diğer 8 adım bitince tamam olur', () => {
    const s = placePiecesSteps({ ...full, difficultyChosen: false });
    expect(s[7].done).toBe(false);
    expect(s[9].done).toBe(false);
  });
});

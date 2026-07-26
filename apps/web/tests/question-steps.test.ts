import { describe, it, expect } from 'vitest';
import { choiceSteps, clickSquareSteps } from '@/lib/admin/questionSteps';
import type { ChoiceStepState, ClickSquareStepState } from '@/lib/admin/questionSteps';

const C: ChoiceStepState = {
  instruction: '', promptImage: '', optionCountChosen: false,
  answerKindChosen: false, options: ['', ''], answerKind: 'sentence',
  difficultyChosen: false,
};

describe('choiceSteps — Cümle', () => {
  it('6 adım, kullanıcının sırasıyla', () => {
    expect(choiceSteps(C, 'sentence_question').map((s) => s.label)).toEqual([
      'Talimatı Gir', 'Seçenek Sayısını Belirle', 'Cevap Tipini Belirle',
      'Cevapları Gir', 'Zorluk Düzeyini Belirle', 'Soruyu Ekle',
    ]);
  });

  it('varsayılanlar tıklanmadan "Belirle" adımları tamamlanmaz (tuzak)', () => {
    const steps = choiceSteps(C, 'sentence_question');
    expect(steps[1].done).toBe(false);
    expect(steps[2].done).toBe(false);
    expect(steps[4].done).toBe(false);
  });

  it('Cevapları Gir: tüm şıklar doluysa tamamlanır', () => {
    expect(choiceSteps({ ...C, options: ['a', ''] }, 'sentence_question')[3].done).toBe(false);
    expect(choiceSteps({ ...C, options: ['a', 'b'] }, 'sentence_question')[3].done).toBe(true);
  });

  it('Soruyu Ekle yalnızca diğer hepsi bitince ✓ olur', () => {
    const full: ChoiceStepState = {
      instruction: 'Soru?', promptImage: '', optionCountChosen: true,
      answerKindChosen: true, options: ['a', 'b'], answerKind: 'sentence',
      difficultyChosen: true,
    };
    expect(choiceSteps(full, 'sentence_question').at(-1)?.done).toBe(true);
    expect(choiceSteps({ ...full, instruction: '' }, 'sentence_question').at(-1)?.done).toBe(false);
  });
});

describe('choiceSteps — Görüntü', () => {
  it('7 adım; 1.si Soru Görseli Seç', () => {
    const steps = choiceSteps(C, 'image_question');
    expect(steps).toHaveLength(7);
    expect(steps[0].label).toBe('Soru Görseli Seç');
    expect(steps[0].done).toBe(false);
    expect(choiceSteps({ ...C, promptImage: 'data:image/png;base64,x' },
      'image_question')[0].done).toBe(true);
  });
});

describe('clickSquareSteps', () => {
  const K: ClickSquareStepState = {
    instruction: '', setupFen: '8/8/8/8/8/8/8/8 w - - 0 1', turnChosen: false,
    savedFen: null, targets: [], difficultyChosen: false,
  };

  it('7 adım, kullanıcının sırasıyla', () => {
    expect(clickSquareSteps(K).map((s) => s.label)).toEqual([
      'Talimatı Gir', 'Konum Diz', 'Hamle Sırasını Belirle', 'Konumu Kaydet',
      'Doğru Kare(leri) Seç', 'Zorluk Düzeyini Belirle', 'Soruyu Ekle',
    ]);
  });

  it('Konum Diz: tahtada taş olunca tamamlanır', () => {
    expect(clickSquareSteps(K)[1].done).toBe(false);
    expect(clickSquareSteps({ ...K, setupFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1' })[1].done).toBe(true);
  });

  it('BOŞ TAHTA MEŞRU: konum kaydedilince Konum Diz de tamam sayılır', () => {
    // Kare isimleri ogretilen sorular bos tahtada olur ("e4'e tikla").
    expect(clickSquareSteps({ ...K, savedFen: K.setupFen })[1].done).toBe(true);
  });

  it('Konumu Kaydet ve Doğru Kareler sıralı çalışır', () => {
    const s = clickSquareSteps({ ...K, savedFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', targets: ['e4'] });
    expect(s[3].done).toBe(true);
    expect(s[4].done).toBe(true);
  });
});

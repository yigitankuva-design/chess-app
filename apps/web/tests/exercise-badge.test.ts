import { describe, it, expect } from 'vitest';
import { exerciseBadgeTitle } from '@/lib/exerciseBadge';

describe('exerciseBadgeTitle', () => {
  it('instruction doluysa onu döner', () => {
    expect(exerciseBadgeTitle({ type: 'click_square', instruction: 'Bir kareye tıkla' })).toBe('Bir kareye tıkla');
  });

  it('image_question ve instruction boşsa geri düşüş metni döner', () => {
    expect(exerciseBadgeTitle({ type: 'image_question', instruction: '' })).toBe('Görüntü sorusu');
  });

  it('sentence_question ve instruction boşsa (normalde olmaz) boş döner', () => {
    expect(exerciseBadgeTitle({ type: 'sentence_question', instruction: '' })).toBe('');
  });

  it('instruction tanımsızsa çökmez', () => {
    expect(exerciseBadgeTitle({ type: 'image_question' })).toBe('Görüntü sorusu');
  });
});

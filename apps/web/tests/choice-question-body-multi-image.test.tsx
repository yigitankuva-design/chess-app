import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoiceQuestionBody } from '@/components/lesson-steps/ChoiceQuestionBody';
import type { ImageQuestionEx } from '@/components/lesson-steps/BoardExercise';

const BASE: ImageQuestionEx = {
  type: 'image_question', instruction: 'Bak', prompt_image: 'data:image/png;base64,LEGACY',
  answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
};

describe('ChoiceQuestionBody — çoklu görsel (madde 3)', () => {
  it('prompt_images varsa hepsini kendi konum/ton bilgisiyle render eder', () => {
    render(<ChoiceQuestionBody exercise={{
      ...BASE, prompt_image: undefined, prompt_images: [
        { uri: 'data:image/png;base64,A', x: 30, y: 30, w: 20, h: 20, tone: 0 },
        { uri: 'data:image/png;base64,B', x: 70, y: 70, w: 20, h: 20, tone: 5 },
      ], image_show_board: true,
    }} disabled={false} onAnswer={vi.fn()} />);
    expect(screen.getByTestId('empty-board-grid')).toBeInTheDocument();
    const img1 = screen.getByAltText('Görsel 1') as HTMLImageElement;
    const img2 = screen.getByAltText('Görsel 2') as HTMLImageElement;
    expect(img1.style.left).toBe('30%');
    expect(img2.style.filter).toBe('grayscale(0.5)');
  });

  it('prompt_images YOKSA eski davranış (tekil prompt_image, düz görünüm) korunur', () => {
    render(<ChoiceQuestionBody exercise={BASE} disabled={false} onAnswer={vi.fn()} />);
    expect(screen.queryByTestId('empty-board-grid')).not.toBeInTheDocument();
    expect(screen.getByAltText('Soru görseli')).toBeInTheDocument();
  });
});

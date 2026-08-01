import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoiceQuestionBody } from '@/components/lesson-steps/ChoiceQuestionBody';
import type { ImageQuestionEx } from '@/components/lesson-steps/BoardExercise';

const BASE: ImageQuestionEx = {
  type: 'image_question',
  instruction: 'Bak',
  prompt_image: 'data:image/png;base64,AAA',
  answer_kind: 'sentence',
  options: ['a', 'b'],
  correct_index: 0,
};

describe('ChoiceQuestionBody — görsel konumlandırma (admin görsel editörü)', () => {
  it('yerleşim alanı YOK ise eski düz görünüm korunur (regresyon)', () => {
    render(
      <ChoiceQuestionBody exercise={BASE} disabled={false} onAnswer={vi.fn()} />,
    );
    expect(screen.queryByTestId('empty-board-grid')).not.toBeInTheDocument();
    const img = screen.getByAltText('Soru görseli') as HTMLImageElement;
    expect(img.style.position).not.toBe('absolute');
  });

  it('image_show_board true ise tahta arka planıyla konumlandırılmış render eder', () => {
    render(<ChoiceQuestionBody exercise={{
      ...BASE, image_x: 60, image_y: 40, image_w: 30, image_h: 30,
      image_tone: 5, image_show_board: true,
    }} disabled={false} onAnswer={vi.fn()} />);
    expect(screen.getByTestId('empty-board-grid')).toBeInTheDocument();
    const img = screen.getByAltText('Soru görseli') as HTMLImageElement;
    expect(img.style.left).toBe('60%');
    expect(img.style.top).toBe('40%');
    expect(img.style.filter).toBe('grayscale(0.5)');
  });

  it('image_show_board false ise tahta arka planı OLMADAN konumlandırılmış render eder', () => {
    render(<ChoiceQuestionBody exercise={{
      ...BASE, image_x: 60, image_y: 40, image_w: 30, image_h: 30,
      image_tone: 0, image_show_board: false,
    }} disabled={false} onAnswer={vi.fn()} />);
    expect(screen.queryByTestId('empty-board-grid')).not.toBeInTheDocument();
    const img = screen.getByAltText('Soru görseli') as HTMLImageElement;
    expect(img.style.left).toBe('60%');
  });
});

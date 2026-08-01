import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';
import { vi } from 'vitest';

describe('ChoiceExerciseFields — görsel silme (madde 1)', () => {
  it('soru görseli önceden yüklüyse "Görseli Sil" düğmesi görünür ve tıklanınca kaybolur', () => {
    render(
      <ChoiceExerciseFields
        kind="image_question"
        onSubmit={vi.fn()}
        initial={{
          type: 'image_question', instruction: '', prompt_image: 'data:image/png;base64,ABC',
          answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
        }}
      />,
    );

    expect(screen.getByAltText('Soru görseli önizleme')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Görseli Sil'));

    expect(screen.queryByAltText('Soru görseli önizleme')).not.toBeInTheDocument();
    // Sil sonrasi tekrar "Bilgisayardan Seç" yazmalı (Değiştir değil).
    expect(screen.getByText('Bilgisayardan Seç')).toBeInTheDocument();
  });

  it('görsel yokken Sil düğmesi hiç görünmez', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.queryByText('Görseli Sil')).not.toBeInTheDocument();
  });

  it('şık görseli için Sil düğmesi çalışır', () => {
    render(
      <ChoiceExerciseFields
        kind="sentence_question"
        onSubmit={vi.fn()}
        initial={{
          type: 'sentence_question', instruction: 'x', answer_kind: 'image',
          options: ['data:image/png;base64,OPT1', ''], correct_index: 0,
        }}
      />,
    );

    expect(screen.getByAltText('1. şık önizleme')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('1. şık görselini sil'));
    expect(screen.queryByAltText('1. şık önizleme')).not.toBeInTheDocument();
  });
});

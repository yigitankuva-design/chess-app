import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';
import { vi } from 'vitest';

describe('ChoiceExerciseFields — görsel silme (madde 1)', () => {
  it('soru görseli önceden yüklüyse, seçilip "Sil" düğmesine basılınca kaybolur (madde 3 — çoklu görsel)', () => {
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

    expect(screen.getByAltText('Görsel 1')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByAltText('Görsel 1'), { clientX: 0, clientY: 0 });
    fireEvent.click(screen.getByText('Sil'));

    expect(screen.queryByAltText('Görsel 1')).not.toBeInTheDocument();
  });

  it('görsel yokken Sil düğmesi hiç görünmez', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.queryByText('Sil')).not.toBeInTheDocument();
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

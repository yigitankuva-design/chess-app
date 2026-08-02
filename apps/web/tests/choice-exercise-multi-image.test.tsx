import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ChoiceExerciseFields — çoklu görsel (madde 3)', () => {
  it('birden fazla görsel eklendiğinde hepsi MultiImagePlacer içinde görünür', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} initial={{
      type: 'image_question', instruction: 'x',
      prompt_images: [
        { uri: 'data:image/png;base64,A', x: 30, y: 30, w: 20, h: 20, tone: 0 },
        { uri: 'data:image/png;base64,B', x: 70, y: 70, w: 20, h: 20, tone: 0 },
      ],
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    expect(await screen.findByAltText('Görsel 1')).toBeInTheDocument();
    expect(screen.getByAltText('Görsel 2')).toBeInTheDocument();
  });

  it('eski tekil prompt_image ile düzenlemeye girince tek elemanlı diziye çevrilir', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} initial={{
      type: 'image_question', instruction: 'x', prompt_image: 'data:image/png;base64,LEGACY',
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    expect(await screen.findByAltText('Görsel 1')).toBeInTheDocument();
  });

  it('görsel yokken kaydet butonu kilitli kalır', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
  });

  it('kaydet çağrısı prompt_images dizisini gönderir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="image_question" onSubmit={onSubmit} initial={{
      type: 'image_question', instruction: 'Talimat metni',
      prompt_images: [{ uri: 'data:image/png;base64,A', x: 50, y: 50, w: 40, h: 40, tone: 0 }],
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.prompt_images).toEqual([
      { uri: 'data:image/png;base64,A', x: 50, y: 50, w: 40, h: 40, tone: 0 },
    ]);
    expect(sent.prompt_image).toBeUndefined();
  });
});

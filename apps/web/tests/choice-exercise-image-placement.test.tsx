import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ChoiceExerciseFields — görsel konumlandırma (image_question)', () => {
  it('görsel seçilmeden ImagePlacer görünmez', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.queryByAltText('Konumlandırılan görsel')).not.toBeInTheDocument();
  });

  it('görsel seçilince altında ImagePlacer otomatik belirir', async () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} initial={{
      type: 'image_question', instruction: 'x', prompt_image: 'data:image/png;base64,AAA',
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    expect(await screen.findByAltText('Konumlandırılan görsel')).toBeInTheDocument();
  });

  it('"Açıklama" etiketi yerine zorunlu "Talimat" placeholder\'ı kullanılır', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText('Talimat')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Açıklama (opsiyonel)')).not.toBeInTheDocument();
  });

  it('Talimat boşken kaydet butonu kilitli kalır', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} initial={{
      type: 'image_question', instruction: '', prompt_image: 'data:image/png;base64,AAA',
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    expect(screen.getByText('Soruyu kaydet')).toBeDisabled();
  });

  it('kaydet çağrısı image_x/y/w/h/tone/show_board alanlarını gönderir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="image_question" onSubmit={onSubmit} initial={{
      type: 'image_question', instruction: 'Talimat metni', prompt_image: 'data:image/png;base64,AAA',
      answer_kind: 'sentence', options: ['a', 'b'], correct_index: 0,
    }} />);
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.image_x).toBe(50);
    expect(sent.image_y).toBe(50);
    expect(sent.image_w).toBe(40);
    expect(sent.image_h).toBe(40);
    expect(sent.image_tone).toBe(0);
    expect(sent.image_show_board).toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ChoiceExerciseFields', () => {
  it('sentence_question: 2 boş seçenekle başlar, doldurup gönderince doğru şekli üretir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'Atın hareketi?' } });
    const optionInputs = screen.getAllByPlaceholderText(/\d\. şık/);
    fireEvent.change(optionInputs[0], { target: { value: 'L şeklinde' } });
    fireEvent.change(optionInputs[1], { target: { value: 'Düz çizgide' } });
    fireEvent.click(screen.getByText('Soruyu ekle'));

    // submit() async — waitFor ile bekle (çıplak `await Promise.resolve()` güvenilir değil)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sentence_question',
      instruction: 'Atın hareketi?',
      answer_kind: 'sentence',
      options: ['L şeklinde', 'Düz çizgide'],
      correct_index: 0,
    }));
  });

  it('seçenek sayısı 4e çıkarılınca 4 giriş alanı görünür', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('4 seçenek'));
    expect(screen.getAllByPlaceholderText(/\d\. şık/)).toHaveLength(4);
  });

  it('seçenek sayısı azaltılınca fazla seçenekler kırpılır ve doğru cevap sınır dışındaysa sıfırlanır', () => {
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('4 seçenek'));
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[3]); // 4. seçeneği doğru işaretle
    fireEvent.click(screen.getByText('2 seçenek'));
    const radiosAfter = screen.getAllByRole('radio');
    expect(radiosAfter).toHaveLength(2);
    expect((radiosAfter[0] as HTMLInputElement).checked).toBe(true);
  });

  it('boş cevapla gönderim engellenir, hata mesajı gösterilir', () => {
    const onSubmit = vi.fn();
    render(<ChoiceExerciseFields kind="sentence_question" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/Soru cümlesi/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Soruyu ekle'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/doldurulmalı/)).toBeInTheDocument();
  });

  it('image_question: soru metni boşken de gönderim engellenmez (opsiyonel)', () => {
    const onSubmit = vi.fn();
    render(<ChoiceExerciseFields kind="image_question" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Soruyu ekle'));
    // Görsel seçilmediği için "Soru görseli gerekli" hatası beklenir — instruction eksikliği DEĞİL.
    expect(screen.getByText(/Soru görseli gerekli/)).toBeInTheDocument();
  });
});

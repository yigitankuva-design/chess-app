import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — 3 soru ailesi kartı', () => {
  it('varsayılan olarak Konum Ekle formu (talimat + tahta) açık gelir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Talimat/)).toBeInTheDocument();
    expect(screen.getByText('Konum ekle')).toBeInTheDocument();
    expect(screen.getByText('Cümle ekle')).toBeInTheDocument();
    expect(screen.getByText('Görüntü ekle')).toBeInTheDocument();
  });

  it('Cümle ekle karta tıklayınca cümle formu açılır', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Cümle ekle'));
    expect(screen.getByPlaceholderText(/Soru cümlesi/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Talimat \(örn\./)).not.toBeInTheDocument();
  });

  it('düzenleme modunda (initial verilmiş) kart değiştirme devre dışıdır', () => {
    render(
      <ExerciseForm
        onSubmit={vi.fn()}
        initial={{
          type: 'sentence_question', instruction: 'Atın hareketi?', answer_kind: 'sentence',
          options: ['L', 'Düz'], correct_index: 0,
        }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText(/Soru cümlesi/)).toBeInTheDocument();
    const konumCard = screen.getByText('Konum ekle').closest('button');
    expect(konumCard).toBeDisabled();
  });
});

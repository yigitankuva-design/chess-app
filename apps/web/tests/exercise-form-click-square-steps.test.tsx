import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

function openClickSquare() {
  render(<ExerciseForm onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByText('Konum ekle'));   // varsayilan tip click_square
}

describe('ExerciseForm — Kareye Tıkla 7 adım', () => {
  it('yedi adım sırayla listelenir', () => {
    openClickSquare();
    const list = screen.getByLabelText('Kareye Tıkla adımları');
    const texts = Array.from(list.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(texts).toHaveLength(7);
    expect(texts[0]).toContain('1. Talimatı Gir');
    expect(texts[2]).toContain('3. Hamle Sırasını Belirle');
    expect(texts[3]).toContain('4. Konumu Kaydet');
    expect(texts[6]).toContain('7. Soruyu Ekle');
  });

  it('konum kaydedilmeden Doğru Kare seçici GÖRÜNMEZ', () => {
    openClickSquare();
    expect(screen.queryByText(/Doğru kare\(ler\)/)).not.toBeInTheDocument();
  });

  it('eksik adım varken Soruyu ekle devre dışıdır', () => {
    openClickSquare();
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
  });

  it('Hamle Sırası: "Siyah" düğmesine tıklanınca adım 3 tik alır', () => {
    openClickSquare();
    fireEvent.click(screen.getByText('Siyah'));
    const list = screen.getByLabelText('Kareye Tıkla adımları');
    const texts = Array.from(list.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(texts[2]).toContain('✓');
  });

  it('KURAL #3: kayıtlı soru düzenlenirken tüm adımlar tamam, buton etkin', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={{
      type: 'click_square', instruction: 'e4 karesine tıkla',
      fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', target_squares: ['e4'], difficulty: 2,
    }} />);
    expect(screen.getByText('Soruyu kaydet')).toBeEnabled();
    expect(screen.queryByText(/Eksik:/)).not.toBeInTheDocument();
  });
});

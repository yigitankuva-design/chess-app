import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — çizim entegrasyonu (C grubu)', () => {
  it('click_square: konum kaydedilince "Yazı-Şekil-Renk Ekle" araç paneli görünür', async () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kareye tıkla' }));
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    await waitFor(() => expect(screen.getByText('Yazı-Şekil-Renk Ekle (opsiyonel)')).toBeInTheDocument());
  });

  it('click_square: eklenen çizim öğesi submit\'te annotations alanında gönderilir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExerciseForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kareye tıkla' }));
    fireEvent.click(screen.getByLabelText('Beyaz Vezir'));
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    fireEvent.click(screen.getByText('Beyaz'));
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    await waitFor(() => screen.getByText('Yazı-Şekil-Renk Ekle (opsiyonel)'));

    fireEvent.click(screen.getByText('Daire'));
    fireEvent.pointerDown(screen.getByTestId('paint-board-box'), { clientX: 50, clientY: 50 });

    fireEvent.change(screen.getByPlaceholderText("Talimat (örn. Piyonu e4'e taşı)"), { target: { value: 'x' } });
    // Madde 2026-08-24: hedef kare artık NOTASYONEL ŞABLONDAN değil, tahtaya
    // tıklanarak seçilir — "Taşa Tıkla" ile AYNI etkileşim.
    fireEvent.click(document.querySelector('[data-square="e4"]')!);
    fireEvent.click(screen.getByText('Tek Kareye Tıklaması Yeterli'));
    fireEvent.click(screen.getByText('Kolay'));
    fireEvent.click(screen.getByText('Soruyu ekle'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.annotations).toHaveLength(1);
    expect(sent.annotations[0].kind).toBe('shape');
  });
});

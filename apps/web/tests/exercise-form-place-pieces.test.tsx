import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — Taş Nerde? tipi', () => {
  it('üçüncü tip butonu görünür', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Taş nerde?' })).toBeInTheDocument();
  });

  it('tip seçilince 9 adımlık liste gösterilir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Taş nerde?' }));
    const list = screen.getByLabelText('Taş Nerde? adımları');
    expect(list.textContent).toContain('Konuma Eklenecek Taşları Belirle');
    expect(list.textContent).toContain('Taşların Doğru Karelerini Belirle');
    expect(list.textContent).toContain('Cevabı Kaydet');
    expect(list.textContent).toContain('Zorluk Düzeyini Belirle');
  });

  it('tip seçilince konum dizme ekranı çıkar (çift tahta olmaz)', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Taş nerde?' }));
    expect(screen.getByRole('button', { name: 'Konumu Kaydet' })).toBeInTheDocument();
    // Konum kaydedilmeden hedef tahtası yok — ekranda tek tahta olmalı.
    expect(container.querySelectorAll('[data-square="a1"]')).toHaveLength(1);
  });
});

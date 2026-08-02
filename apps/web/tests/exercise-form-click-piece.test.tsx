import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — Taşa Tıkla tipi', () => {
  it('dördüncü tip butonu görünür', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Taşa tıkla' })).toBeInTheDocument();
  });

  it('buton sırası: Kareye tıkla → Taşa tıkla → Taşı oynat → Taş nerde?', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    const isimler = ['Kareye tıkla', 'Taşa tıkla', 'Taşı oynat', 'Taş nerde?'];
    const butonlar = isimler.map((n) => screen.getByRole('button', { name: n }));
    for (let i = 1; i < butonlar.length; i += 1) {
      const konum = butonlar[i - 1].compareDocumentPosition(butonlar[i]);
      // Node.DOCUMENT_POSITION_FOLLOWING = 4 → sonraki buton DOM'da daha sonra geliyor
      expect(konum & 4).toBeTruthy();
    }
  });

  it('tip seçilince 8 adımlık liste gösterilir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Taşa tıkla' }));
    const list = screen.getByLabelText('Taşa Tıkla adımları');
    expect(list.textContent).toContain('Cevap Taşlarını Seç');
    expect(list.textContent).toContain('Taş Seçimini Kaydet');
    expect(list.textContent).toContain('Zorluk Düzeyini Belirle');
  });

  it('konum kaydedilmeden cevap tahtası çıkmaz', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Taşa tıkla' }));
    expect(container.querySelector('[data-testid="saved-position-board"]')).not.toBeInTheDocument();
  });

  it('KAYITLI bir Taşa Tıkla sorusu düzenlenirken tipi ve konumu korunur', () => {
    const { container } = render(
      <ExerciseForm
        onSubmit={vi.fn()}
        initial={{
          type: 'click_piece',
          instruction: 'Beyaz şaha tıkla',
          fen: '8/8/8/8/4K3/8/8/R7 w - - 0 1',
          piece_squares: ['e4'],
        }}
      />,
    );
    // Adım listesi Taşa Tıkla'nın olmalı — tip click_square'e DÜŞMEMELİ.
    expect(screen.getByLabelText('Taşa Tıkla adımları')).toBeInTheDocument();
    // Konum kaydedilmiş sayılmalı, cevap tahtası görünmeli.
    expect(container.querySelector('[data-testid="saved-position-board"]')).toBeInTheDocument();
    expect(screen.getByText(/Seçili: e4/)).toBeInTheDocument();
  });
});

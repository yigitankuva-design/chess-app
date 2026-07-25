import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

function openMovePiece() {
  render(<ExerciseForm onSubmit={vi.fn()} />);
  fireEvent.click(screen.getByText('Konum ekle'));
  fireEvent.click(screen.getByText('Taşı oynat'));
}

describe('ExerciseForm — Taşı oynat entegrasyonu', () => {
  it('ÇİFT TAHTA OLMAMALI: Taşı oynat seçilince tek tahta render edilir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taşı oynat'));
    // Her tahta 64 kare üretir; iki tahta olsaydı 128 olurdu.
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
  });

  it('Taşı oynat seçilince "Konumu Kaydet" görünür, eski hedef-kare seçici görünmez', () => {
    openMovePiece();
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
    expect(screen.queryByText('Oynayacak taşın karesi')).not.toBeInTheDocument();
  });

  it('hamle kaydedilmeden gönderilirse hata gösterir', () => {
    const onSubmit = vi.fn();
    render(<ExerciseForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taşı oynat'));
    fireEvent.change(screen.getByPlaceholderText(/Talimat/), { target: { value: 'Taktigi oyna' } });
    fireEvent.click(screen.getByText('Soruyu ekle'));
    expect(onSubmit).not.toHaveBeenCalled();
    // NOT: /Konumu Kaydet/ ile aramak butona DA eşleşir ve getByText çoklu eşleşmede
    // hata verir — bu yüzden hata mesajının ayırt edici kısmı aranıyor.
    expect(screen.getByText(/Önce taşları yerleştirip/)).toBeInTheDocument();
  });

  it('REGRESYON: Kareye tıkla hâlâ tahta + hedef-kare seçici gösterir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    // varsayılan zaten click_square
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.getByText(/Doğru kare\(ler\)/)).toBeInTheDocument();
  });

  it('REGRESYON: Taşı tanı hâlâ tahta + vurgu seçici gösterir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taşı tanı'));
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.getByText(/Vurgulanacak kare/)).toBeInTheDocument();
  });
});

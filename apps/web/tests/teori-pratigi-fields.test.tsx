import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeoriPratigiFields } from '@/components/admin/TeoriPratigiFields';

describe('TeoriPratigiFields', () => {
  it('adım listesi ve talimat kutusu görünür, setup fazında BoardEditor + Konumu Kaydet', () => {
    render(<TeoriPratigiFields onSubmit={vi.fn()} />);
    const stepList = screen.getByRole('list', { name: 'Teori Pratiği soru adımları' });
    expect(stepList).toHaveTextContent('Talimatı Gir');
    expect(stepList).toHaveTextContent('Konum Diz');
    expect(stepList).toHaveTextContent('Hamle Sırasını Belirle');
    expect(screen.getByPlaceholderText(/İtalyan Açılışı'nın ilk hamlelerini oyna/)).toBeInTheDocument();
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
  });

  it('başlangıçta "Soruyu ekle" devre dışıdır, eksik adım 1', () => {
    render(<TeoriPratigiFields onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Soruyu ekle' })).toBeDisabled();
    expect(screen.getByText(/Eksik: 1\. Talimatı Gir/)).toBeInTheDocument();
  });

  it('"Konumu Kaydet" tıklanınca kayıt fazına geçer — Notasyon Tablosu görünür, hamle yokken "Notasyonu Kaydet" devre dışı', () => {
    render(<TeoriPratigiFields onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(screen.getByText('Notasyon Tablosu')).toBeInTheDocument();
    expect(screen.getByText('Notasyonu Kaydet')).toBeDisabled();
    expect(screen.queryByText('Konumu Kaydet')).not.toBeInTheDocument();
  });

  it('"Konumu Düzenle" setup fazına geri döner', () => {
    render(<TeoriPratigiFields onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    fireEvent.click(screen.getByText('Konumu Düzenle'));
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
  });

  it('açılış adı kutusu yazılabilir', () => {
    render(<TeoriPratigiFields onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Açılış veya varyant adı/), {
      target: { value: 'İtalyan Açılışı' },
    });
    expect((screen.getByPlaceholderText(/Açılış veya varyant adı/) as HTMLInputElement).value)
      .toBe('İtalyan Açılışı');
  });

  it('hamle hiç kaydedilmediği sürece "Soruyu ekle" devre dışı kalır (moves boş)', () => {
    render(<TeoriPratigiFields onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/İtalyan Açılışı'nın ilk hamlelerini oyna/), {
      target: { value: 'İtalyan Açılışı\'nın ilk hamlelerini oyna' },
    });
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    fireEvent.change(screen.getByPlaceholderText(/Açılış veya varyant adı/), {
      target: { value: 'İtalyan Açılışı' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz' }));
    expect(screen.getByRole('button', { name: 'Soruyu ekle' })).toBeDisabled();
    expect(screen.getByText(/Eksik: 4\. Cevap Hamlelerini Yap/)).toBeInTheDocument();
  });
});

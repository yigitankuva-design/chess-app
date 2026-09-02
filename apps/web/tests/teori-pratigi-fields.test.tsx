import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeoriPratigiFields } from '@/components/admin/TeoriPratigiFields';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

describe('TeoriPratigiFields — düzenleme modu (madde: Kazanç Konumu ile AYNI havuz deseni)', () => {
  const INITIAL: TeoriPratigiQuestion = {
    id: 't1', code: '004', instruction: 'İlk hamleleri oyna', fen: FEN,
    moves: ['e4', 'e5'], opening_name: 'İtalyan Açılışı', student_color: 'b',
  };

  it('initial verilince tüm alanlar dolu gelir, notasyon zaten kayıtlı sayılır', () => {
    render(<TeoriPratigiFields initial={INITIAL} onSubmit={vi.fn()} />);
    expect((screen.getByPlaceholderText(/İtalyan Açılışı'nın ilk hamlelerini oyna/) as HTMLInputElement).value)
      .toBe('İlk hamleleri oyna');
    expect(screen.getByText(/Kaydedilen cevap notasyonu/)).toBeInTheDocument();
    expect((screen.getByPlaceholderText(/Açılış veya varyant adı/) as HTMLInputElement).value)
      .toBe('İtalyan Açılışı');
    expect(screen.getByRole('button', { name: 'Soruyu kaydet' })).toBeEnabled();
  });

  it('"Soruyu kaydet" id/code KORUYARAK onSubmit\'i çağırır', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TeoriPratigiFields initial={INITIAL} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/Açılış veya varyant adı/), {
      target: { value: 'Güncellenmiş açılış adı' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Soruyu kaydet' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      id: 't1', code: '004', opening_name: 'Güncellenmiş açılış adı', student_color: 'b',
    }));
  });

  it('onCancel verilince "Vazgeç" butonu görünür ve tıklanınca çağrılır', () => {
    const onCancel = vi.fn();
    render(<TeoriPratigiFields initial={INITIAL} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

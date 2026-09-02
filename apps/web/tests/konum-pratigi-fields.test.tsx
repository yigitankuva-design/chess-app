import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KonumPratigiFields } from '@/components/admin/KonumPratigiFields';
import type { KonumPratigiQuestion } from '@/lib/customTabsApi';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

function fillMinimalValidForm() {
  fireEvent.change(screen.getByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)'), {
    target: { value: 'Bu hangi açılıştır?' },
  });
  fireEvent.change(screen.getByPlaceholderText(/FEN yapıştır/), { target: { value: FEN } });
  fireEvent.click(screen.getByRole('button', { name: '2 seçenek' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cümle' }));
  fireEvent.change(screen.getByPlaceholderText('1. şık'), { target: { value: 'İtalyan Açılışı' } });
  fireEvent.change(screen.getByPlaceholderText('2. şık'), { target: { value: 'İspanyol Açılışı' } });
}

describe('KonumPratigiFields', () => {
  it('adım listesi ve talimat kutusu görünür', () => {
    render(<KonumPratigiFields onSubmit={vi.fn()} />);
    const stepList = screen.getByRole('list', { name: 'Konum Pratiği soru adımları' });
    expect(stepList).toHaveTextContent('Talimatı Gir');
    expect(stepList).toHaveTextContent('FEN Ekle');
    expect(screen.getByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)')).toBeInTheDocument();
  });

  it('geçersiz FEN yapıştırılınca uyarı gösterir', () => {
    render(<KonumPratigiFields onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/FEN yapıştır/), { target: { value: 'gecersiz-fen' } });
    expect(screen.getByText(/Bu FEN geçerli değil/)).toBeInTheDocument();
  });

  it('geçerli FEN yapıştırılınca önizleme tahtası ve hamle sırası butonları görünür', () => {
    render(<KonumPratigiFields onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/FEN yapıştır/), { target: { value: FEN } });
    expect(screen.getByLabelText('Siyah')).toBeInTheDocument();
    expect(screen.getByLabelText('Beyaz')).toBeInTheDocument();
  });

  it('eksik adımlar varken "Soruyu ekle" devre dışıdır', () => {
    render(<KonumPratigiFields onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Soruyu ekle' })).toBeDisabled();
    expect(screen.getByText(/Eksik: 1\. Talimatı Gir/)).toBeInTheDocument();
  });

  it('tüm adımlar tamamlanınca "Soruyu ekle" etkinleşir ve doğru şekli gönderir', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<KonumPratigiFields onSubmit={onSubmit} />);
    fillMinimalValidForm();
    // Doğru şık: varsayılan olarak ilk radyo işaretli (1. şık = İtalyan Açılışı).
    const submitBtn = screen.getByRole('button', { name: 'Soruyu ekle' });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.instruction).toBe('Bu hangi açılıştır?');
    expect(arg.answer_kind).toBe('sentence');
    expect(arg.options).toEqual(['İtalyan Açılışı', 'İspanyol Açılışı']);
    expect(arg.correct_index).toBe(0);
    expect(arg.fen.split(' ')[0]).toBe(FEN.split(' ')[0]);
  });

  it('doğru şık ikinciye işaretlenirse correct_index 1 olur', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<KonumPratigiFields onSubmit={onSubmit} />);
    fillMinimalValidForm();
    fireEvent.click(screen.getByLabelText('2. şık doğru'));
    fireEvent.click(screen.getByRole('button', { name: 'Soruyu ekle' }));
    expect(onSubmit.mock.calls[0][0].correct_index).toBe(1);
  });

  it('gönderim sonrası form sıfırlanır (yeni soru için hazır)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<KonumPratigiFields onSubmit={onSubmit} />);
    fillMinimalValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Soruyu ekle' }));
    await screen.findByRole('button', { name: 'Soruyu ekle' });
    expect((screen.getByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Soruyu ekle' })).toBeDisabled();
  });
});

describe('KonumPratigiFields — düzenleme modu (madde: Kazanç Konumu ile AYNI havuz deseni)', () => {
  const INITIAL: KonumPratigiQuestion = {
    id: 'q1', code: '003', instruction: 'Bu hangi açılıştır?', fen: FEN,
    answer_kind: 'sentence', options: ['İtalyan Açılışı', 'İspanyol Açılışı'], correct_index: 1,
  };

  it('initial verilince tüm alanlar dolu gelir, adımlar BAŞTAN tamamlanmış sayılır', () => {
    render(<KonumPratigiFields initial={INITIAL} onSubmit={vi.fn()} />);
    expect((screen.getByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)') as HTMLInputElement).value)
      .toBe('Bu hangi açılıştır?');
    expect((screen.getByPlaceholderText('1. şık') as HTMLInputElement).value).toBe('İtalyan Açılışı');
    expect((screen.getByPlaceholderText('2. şık') as HTMLInputElement).value).toBe('İspanyol Açılışı');
    expect(screen.getByLabelText('2. şık doğru')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Soruyu kaydet' })).toBeEnabled();
  });

  it('"Soruyu kaydet" id/code KORUYARAK onSubmit\'i çağırır', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<KonumPratigiFields initial={INITIAL} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)'), {
      target: { value: 'Güncellenmiş talimat' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Soruyu kaydet' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      id: 'q1', code: '003', instruction: 'Güncellenmiş talimat',
    }));
  });

  it('onCancel verilince "Vazgeç" butonu görünür ve tıklanınca çağrılır', () => {
    const onCancel = vi.fn();
    render(<KonumPratigiFields initial={INITIAL} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

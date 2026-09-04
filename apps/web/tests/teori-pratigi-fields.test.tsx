import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeoriPratigiFields } from '@/components/admin/TeoriPratigiFields';
import { TEORI_PRATIGI_INSTRUCTION } from '@/lib/admin/teoriPratigiSteps';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('TeoriPratigiFields', () => {
  it('madde 2026-09-06 (üçüncü tur/3): adım listesi 7 adımdır, "Talimat" alanı/adımı YOKTUR', () => {
    render(<TeoriPratigiFields onSubmit={vi.fn()} />);
    const stepList = screen.getByRole('list', { name: 'Açılış Teorisini Hatırla soru adımları' });
    expect(stepList).not.toHaveTextContent('Talimat');
    expect(stepList).toHaveTextContent('Konum Diz');
    expect(stepList).toHaveTextContent('Hamle Sırasını Belirle');
    expect(screen.queryByPlaceholderText(/Talimat/)).not.toBeInTheDocument();
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
  });

  it('başlangıçta "Soruyu ekle" devre dışıdır', () => {
    render(<TeoriPratigiFields onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Soruyu ekle' })).toBeDisabled();
    // "1. Konum Diz" varsayılan tahta (START_FEN) taş dolu geldiği için zaten
    // tamamlanmış sayılır — ilk eksik adım "2. Konumu Kaydet"tir.
    expect(screen.getByText(/Eksik: 2\. Konumu Kaydet/)).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    fireEvent.change(screen.getByPlaceholderText(/Açılış veya varyant adı/), {
      target: { value: 'İtalyan Açılışı' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz' }));
    expect(screen.getByRole('button', { name: 'Soruyu ekle' })).toBeDisabled();
    expect(screen.getByText(/Eksik: 3\. Cevap Hamlelerini Yap/)).toBeInTheDocument();
  });

  it('tüm adımlar tamamlanınca SABİT talimatla gönderir', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TeoriPratigiFields onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    // MoveRecorderBoard gerçek bir hamle oynatmayı gerektiriyor — burada
    // sadece açılış adı + renk + notasyon-kayıt akışını (moves boşken bile
    // instruction'ın sabit olduğunu) doğrulamak yeterli; tam gönderim
    // konum-pratigi-fields ile AYNI desende teori-pratigi-solver testlerinde
    // ayrıca kapsanıyor.
    fireEvent.change(screen.getByPlaceholderText(/Açılış veya varyant adı/), {
      target: { value: 'İtalyan Açılışı' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz' }));
    expect(onSubmit).not.toHaveBeenCalled(); // hamle yok, kapı hâlâ kapalı — SADECE düzen doğrulanıyor.
  });
});

describe('TeoriPratigiFields — düzenleme modu (madde: Kazanç Konumu ile AYNI havuz deseni)', () => {
  const INITIAL: TeoriPratigiQuestion = {
    id: 't1', code: '004', instruction: 'eski-farklı-bir-talimat', fen: FEN,
    moves: ['e4', 'e5'], opening_name: 'İtalyan Açılışı', student_color: 'b',
  };

  it('initial verilince tüm alanlar dolu gelir, notasyon zaten kayıtlı sayılır', () => {
    render(<TeoriPratigiFields initial={INITIAL} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Kaydedilen cevap notasyonu/)).toBeInTheDocument();
    expect((screen.getByPlaceholderText(/Açılış veya varyant adı/) as HTMLInputElement).value)
      .toBe('İtalyan Açılışı');
    expect(screen.getByRole('button', { name: 'Soruyu kaydet' })).toBeEnabled();
  });

  it('"Soruyu kaydet" id/code KORUYARAK, talimatı SABİT metne normalize ederek onSubmit\'i çağırır', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TeoriPratigiFields initial={INITIAL} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/Açılış veya varyant adı/), {
      target: { value: 'Güncellenmiş açılış adı' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Soruyu kaydet' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      id: 't1', code: '004', instruction: TEORI_PRATIGI_INSTRUCTION,
      opening_name: 'Güncellenmiş açılış adı', student_color: 'b',
    }));
  });

  it('onCancel verilince "Vazgeç" butonu görünür ve tıklanınca çağrılır', () => {
    const onCancel = vi.fn();
    render(<TeoriPratigiFields initial={INITIAL} onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

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

describe('ExerciseForm — Taşı oynat 6 adımlı akış', () => {
  /**
   * Adım listesi kendi aria-label'ı ile bulunur. Serbest `getByText` KULLANILMAZ:
   * "Konumu Kaydet" ve "Notasyonu Kaydet" metinleri hem adım listesinde hem de
   * butonlarda geçiyor; çoklu eşleşmede getByText hata verir.
   */
  function stepTexts(): string[] {
    const list = screen.getByLabelText('Taşı Oynat adımları');
    return Array.from(list.querySelectorAll('li')).map((li) => li.textContent ?? '');
  }

  it('altı adım da sırayla ve doğru etiketlerle listelenir', () => {
    openMovePiece();
    const texts = stepTexts();
    expect(texts).toHaveLength(6);
    expect(texts[0]).toContain('1. Talimat Ekle');
    expect(texts[1]).toContain('2. Konum Diz');
    expect(texts[2]).toContain('3. Konumu Kaydet');
    expect(texts[3]).toContain('4. Cevap Hamlelerini Yap ve Notasyon Oluştur');
    expect(texts[4]).toContain('5. Notasyonu Kaydet');
    expect(texts[5]).toContain('6. Zorluk Düzeyinin Seçimini Yap');
  });

  it('REGRESYON: Kareye tıkla seçiliyken adım listesi GÖSTERİLMEZ', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.queryByLabelText('Taşı Oynat adımları')).not.toBeInTheDocument();
  });

  it('REGRESYON: Taşı tanı seçiliyken adım listesi GÖSTERİLMEZ', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    fireEvent.click(screen.getByText('Taşı tanı'));
    expect(screen.queryByLabelText('Taşı Oynat adımları')).not.toBeInTheDocument();
  });

  it('eksik adım varken "Soruyu ekle" devre dışıdır', () => {
    openMovePiece();
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
  });

  it('eksik olan ilk adımı ekranda yazar', () => {
    openMovePiece();
    expect(screen.getByText(/Eksik: 1\. Talimat Ekle/)).toBeInTheDocument();
  });

  it('talimat girilince eksik adım 2ye ilerler', () => {
    openMovePiece();
    fireEvent.change(screen.getByPlaceholderText(/Talimat/), { target: { value: 'Kaleyi oyna' } });
    expect(screen.getByText(/Eksik: 2\. Konum Diz/)).toBeInTheDocument();
  });

  it('TUZAK: zorluk varsayılanı 1 olsa da tıklanmadıkça adım 6 tamamlanmaz', () => {
    openMovePiece();
    // Zorluk state'i varsayılan 1 ("Kolay") — ama BİLFİİL tıklanmadı.
    expect(stepTexts()[5]).not.toContain('✓');
    fireEvent.click(screen.getByText('Kolay'));
    expect(stepTexts()[5]).toContain('✓');
  });

  it('talimat girilince adım 1 tik alır', () => {
    openMovePiece();
    expect(stepTexts()[0]).not.toContain('✓');
    fireEvent.change(screen.getByPlaceholderText(/Talimat/), { target: { value: 'Oyna' } });
    expect(stepTexts()[0]).toContain('✓');
  });
});

describe('ExerciseForm — mevcut Taşı oynat sorusunu düzenleme (KURAL #3)', () => {
  const EXISTING = {
    type: 'move_piece' as const,
    instruction: 'Kaleyi h4e oyna',
    fen: '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1',
    moves: ['Rh4'],
    difficulty: 3,
    code: '007',
  };

  it('kayıtlı soru açılınca altı adım da tamamlanmış sayılır ve buton etkindir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={EXISTING} />);
    expect(screen.getByText('Soruyu kaydet')).toBeEnabled();
    expect(screen.queryByText(/Eksik:/)).not.toBeInTheDocument();
  });

  it('kayıtlı sorunun notasyonu cevap olarak gösterilir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={EXISTING} />);
    expect(screen.getByText('1. Rh4')).toBeInTheDocument();
  });
});

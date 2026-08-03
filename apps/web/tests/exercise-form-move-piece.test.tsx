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

  it('REGRESYON: Kareye tıkla dizme tahtasını gösterir; seçici KAYITTAN sonra gelir', () => {
    const { container } = render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    // varsayılan zaten click_square — diz fazında tahta var, seçici yok
    expect(container.querySelectorAll('[data-square]')).toHaveLength(64);
    expect(screen.queryByText(/Doğru kare\(ler\)/)).not.toBeInTheDocument();
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
  });

  it('YENİ soruda "Taşı tanı" düğmesi YOKTUR', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.getByText('Kareye tıkla')).toBeInTheDocument();
    expect(screen.getByText('Taşı oynat')).toBeInTheDocument();
    expect(screen.queryByText('Taşı tanı')).not.toBeInTheDocument();
  });

  it('ESKİ Taşı tanı sorusu düzenlemede açılır: rozet görünür, tip düğmeleri kilitli', () => {
    render(
      <ExerciseForm
        onSubmit={vi.fn()}
        initial={{
          type: 'identify_piece',
          instruction: 'Bu taş nedir?',
          fen: '8/8/8/4N3/8/8/8/8 w - - 0 1',
          highlight_square: 'e5',
          options: ['At', 'Fil'],
          correct_index: 0,
          difficulty: 1,
        }}
      />,
    );
    expect(screen.getByText(/Bu soru "Taşı tanı" tipinde/)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Kareye tıkla' });
    expect(btn).toBeDisabled();
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

  it('dokuz adım da sırayla ve doğru etiketlerle listelenir', () => {
    openMovePiece();
    const texts = stepTexts();
    expect(texts).toHaveLength(9);
    expect(texts[0]).toContain('1. Talimatı Gir');
    expect(texts[1]).toContain('2. Konum Diz');
    expect(texts[2]).toContain('3. Hamle Sırasını Belirle');
    expect(texts[3]).toContain('4. Konumu Kaydet');
    expect(texts[4]).toContain('5. Cevap Hamlelerini Yap ve Notasyon Oluştur');
    expect(texts[5]).toContain('6. Notasyonu Kaydet');
    expect(texts[6]).toContain('7. Zorluk Düzeyini Belirle');
    expect(texts[7]).toContain('8. Yazı-Şekil-Renk Ekle');
    expect(texts[8]).toContain('9. Soruyu Ekle');
  });

  it('REGRESYON: Kareye tıkla seçiliyken adım listesi GÖSTERİLMEZ', () => {
    render(<ExerciseForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('Konum ekle'));
    expect(screen.queryByLabelText('Taşı Oynat adımları')).not.toBeInTheDocument();
  });

  it('REGRESYON: eski Taşı tanı sorusu düzenlenirken adım listesi GÖSTERİLMEZ', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={{
      type: 'identify_piece', instruction: 'Bu taş nedir?',
      fen: '8/8/8/4N3/8/8/8/8 w - - 0 1', highlight_square: 'e5',
      options: ['At', 'Fil'], correct_index: 0,
    }} />);
    expect(screen.queryByLabelText('Taşı Oynat adımları')).not.toBeInTheDocument();
  });

  it('eksik adım varken "Soruyu ekle" devre dışıdır', () => {
    openMovePiece();
    expect(screen.getByText('Soruyu ekle')).toBeDisabled();
  });

  it('eksik olan ilk adımı ekranda yazar', () => {
    openMovePiece();
    expect(screen.getByText(/Eksik: 1\. Talimatı Gir/)).toBeInTheDocument();
  });

  it('talimat girilince eksik adım 2ye ilerler', () => {
    openMovePiece();
    fireEvent.change(screen.getByPlaceholderText(/Talimat/), { target: { value: 'Kaleyi oyna' } });
    expect(screen.getByText(/Eksik: 2\. Konum Diz/)).toBeInTheDocument();
  });

  it('TUZAK: zorluk varsayılanı 1 olsa da tıklanmadıkça adım 7 tamamlanmaz', () => {
    openMovePiece();
    // Zorluk state'i varsayılan 1 ("Kolay") — ama BİLFİİL tıklanmadı.
    expect(stepTexts()[6]).not.toContain('✓');
    fireEvent.click(screen.getByText('Kolay'));
    expect(stepTexts()[6]).toContain('✓');
  });

  it('TUZAK: hamle sırası tıklanmadıkça adım 3 tamamlanmaz', () => {
    openMovePiece();
    expect(stepTexts()[2]).not.toContain('✓');
    fireEvent.click(screen.getByText('Siyah'));
    expect(stepTexts()[2]).toContain('✓');
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

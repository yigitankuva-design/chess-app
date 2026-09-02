import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeoriPratigiPoolView } from '@/components/admin/TeoriPratigiPoolView';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function soru(over: Partial<TeoriPratigiQuestion> = {}): TeoriPratigiQuestion {
  return {
    id: 'q1', instruction: 'İlk hamleleri oyna', fen: FEN,
    moves: ['e4'], opening_name: 'İtalyan Açılışı', student_color: 'w',
    ...over,
  };
}

function setup(over: Partial<React.ComponentProps<typeof TeoriPratigiPoolView>> = {}) {
  const props = {
    pool: [soru()],
    onAddQuestion: vi.fn().mockResolvedValue(undefined),
    onUpdateQuestion: vi.fn().mockResolvedValue(undefined),
    onDeleteQuestion: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(<TeoriPratigiPoolView {...props} />);
  return props;
}

describe('TeoriPratigiPoolView — havuz kartı (Kazanç Konumu ile AYNI desen)', () => {
  it('kapalıyken kodlar görünmez, kart üzerinde sayı yazar', () => {
    setup();
    expect(screen.getByText('Konum Havuzu')).toBeInTheDocument();
    expect(screen.getByText('Konum Havuzu').closest('button')).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: 'Soru 001' })).not.toBeInTheDocument();
  });

  it('karta tıklayınca kod kartları açılır', () => {
    setup({ pool: [soru({ id: 'q1' }), soru({ id: 'q2' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    expect(screen.getByRole('button', { name: 'Soru 001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Soru 002' })).toBeInTheDocument();
  });

  it('havuz boşken açılınca bilgi metni çıkar, ekle formu yine görünür', () => {
    setup({ pool: [] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    expect(screen.getByText('Henüz soru eklenmedi.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/İtalyan Açılışı'nın ilk hamlelerini oyna/)).toBeInTheDocument();
  });

  it('kayıtlı kod korunur, kodsuza boşta olan numara verilir', () => {
    setup({ pool: [soru({ id: 'a', code: '007' }), soru({ id: 'b' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    expect(screen.getByRole('button', { name: 'Soru 007' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Soru 001' })).toBeInTheDocument();
  });
});

describe('TeoriPratigiPoolView — düzenleme (Kazanç Konumu ile AYNI: tıkla-düzenle-sil)', () => {
  it('koda tıklayınca düzenleme açılır, alanlar mevcut soruyla dolu gelir (notasyon zaten kayıtlı)', () => {
    setup({ pool: [soru({ id: 'a', code: '001' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    fireEvent.click(screen.getByRole('button', { name: 'Soru 001' }));
    expect(screen.getByText('Soruyu kaydet')).toBeInTheDocument();
    expect(screen.getByText('Vazgeç')).toBeInTheDocument();
    // notationSaved=true ile başlar — "Kaydedilen cevap notasyonu" kartı görünür.
    expect(screen.getByText(/Kaydedilen cevap notasyonu/)).toBeInTheDocument();
    const acilisAdlari = screen.getAllByPlaceholderText(/Açılış veya varyant adı/);
    expect((acilisAdlari[1] as HTMLInputElement).value).toBe('İtalyan Açılışı');
  });

  it('"Soruyu kaydet" onUpdateQuestion\'ı ID/KOD DEĞİŞMEDEN çağırır', () => {
    const p = setup({ pool: [soru({ id: 'a', code: '005' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    fireEvent.click(screen.getByRole('button', { name: 'Soru 005' }));
    fireEvent.change(screen.getAllByPlaceholderText(/Açılış veya varyant adı/)[1], {
      target: { value: 'Güncellenmiş açılış adı' },
    });
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    expect(p.onUpdateQuestion).toHaveBeenCalledWith('a', expect.objectContaining({
      id: 'a', code: '005', opening_name: 'Güncellenmiş açılış adı',
    }));
  });

  it('Vazgeç düzenlemeyi kapatır, kaydetmez', () => {
    const p = setup({ pool: [soru({ id: 'a', code: '001' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    fireEvent.click(screen.getByRole('button', { name: 'Soru 001' }));
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(p.onUpdateQuestion).not.toHaveBeenCalled();
    expect(screen.queryByText('Soruyu kaydet')).not.toBeInTheDocument();
  });

  it('Sil onDeleteQuestion\'ı çağırır ve düzenlemeyi kapatır', () => {
    const p = setup({ pool: [soru({ id: 'a', code: '001' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    fireEvent.click(screen.getByRole('button', { name: 'Soru 001' }));
    fireEvent.click(screen.getByRole('button', { name: /001 kodlu Teori Pratiği sorusunu sil/ }));
    expect(p.onDeleteQuestion).toHaveBeenCalledWith('a');
    expect(screen.queryByText('Soruyu kaydet')).not.toBeInTheDocument();
  });

  it('koda tekrar tıklayınca düzenleme kapanır', () => {
    setup({ pool: [soru({ id: 'a', code: '001' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    fireEvent.click(screen.getByRole('button', { name: 'Soru 001' }));
    expect(screen.getByText('Soruyu kaydet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Soru 001' }));
    expect(screen.queryByText('Soruyu kaydet')).not.toBeInTheDocument();
  });
});

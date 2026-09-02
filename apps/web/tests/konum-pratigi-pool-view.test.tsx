import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KonumPratigiPoolView } from '@/components/admin/KonumPratigiPoolView';
import type { KonumPratigiQuestion } from '@/lib/customTabsApi';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function soru(over: Partial<KonumPratigiQuestion> = {}): KonumPratigiQuestion {
  return {
    id: 'q1', instruction: 'Bu hangi açılıştır?', fen: FEN,
    answer_kind: 'sentence', options: ['İtalyan Açılışı', 'İspanyol Açılışı'], correct_index: 0,
    ...over,
  };
}

function setup(over: Partial<React.ComponentProps<typeof KonumPratigiPoolView>> = {}) {
  const props = {
    pool: [soru()],
    onAddQuestion: vi.fn().mockResolvedValue(undefined),
    onUpdateQuestion: vi.fn().mockResolvedValue(undefined),
    onDeleteQuestion: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(<KonumPratigiPoolView {...props} />);
  return props;
}

describe('KonumPratigiPoolView — havuz kartı (Kazanç Konumu ile AYNI desen)', () => {
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
    expect(screen.getByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)')).toBeInTheDocument();
  });

  it('kayıtlı kod korunur, kodsuza boşta olan numara verilir', () => {
    setup({ pool: [soru({ id: 'a', code: '007' }), soru({ id: 'b' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    expect(screen.getByRole('button', { name: 'Soru 007' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Soru 001' })).toBeInTheDocument();
  });
});

describe('KonumPratigiPoolView — düzenleme (Kazanç Konumu ile AYNI: tıkla-düzenle-sil)', () => {
  it('koda tıklayınca düzenleme açılır, alanlar mevcut soruyla dolu gelir', () => {
    setup({ pool: [soru({ id: 'a', code: '001' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    fireEvent.click(screen.getByRole('button', { name: 'Soru 001' }));
    expect(screen.getByText('Soruyu kaydet')).toBeInTheDocument();
    expect(screen.getByText('Vazgeç')).toBeInTheDocument();
    // Ekle formu (üstte, her zaman görünür) + düzenleme formu (altta) AYNI
    // placeholder'ı paylaşır — düzenleme formu DOM sırasında İKİNCİ (index 1).
    const talimatlar = screen.getAllByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)');
    expect(talimatlar).toHaveLength(2);
    expect((talimatlar[1] as HTMLInputElement).value).toBe('Bu hangi açılıştır?');
  });

  it('"Soruyu kaydet" onUpdateQuestion\'ı ID/KOD DEĞİŞMEDEN çağırır', () => {
    const p = setup({ pool: [soru({ id: 'a', code: '005' })] });
    fireEvent.click(screen.getByText('Konum Havuzu'));
    fireEvent.click(screen.getByRole('button', { name: 'Soru 005' }));
    fireEvent.change(screen.getAllByPlaceholderText('Talimat (örn. Bu konum hangi açılıştır?)')[1], {
      target: { value: 'Güncellenmiş talimat' },
    });
    fireEvent.click(screen.getByText('Soruyu kaydet'));
    expect(p.onUpdateQuestion).toHaveBeenCalledWith('a', expect.objectContaining({
      id: 'a', code: '005', instruction: 'Güncellenmiş talimat',
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
    fireEvent.click(screen.getByRole('button', { name: /001 kodlu Konum Pratiği sorusunu sil/ }));
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

describe('KonumPratigiPoolView — yeni soru ekleme formu HER ZAMAN görünür', () => {
  it('havuz doluyken de listenin altında ekle formu vardır', () => {
    setup();
    fireEvent.click(screen.getByText('Konum Havuzu'));
    expect(screen.getAllByText('Soruyu ekle').length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PositionPoolFields } from '@/components/admin/PositionPoolFields';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SIYAH_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

/** Ortak kurulum — testler sadece ilgilendikleri prop'u değiştirir. */
function setup(over: Partial<React.ComponentProps<typeof PositionPoolFields>> = {}) {
  const props = {
    fen: START_FEN, turn: 'w' as const,
    onFenChange: vi.fn(), onTurnChange: vi.fn(),
    onSavePosition: vi.fn(),
    pool: [] as { id: string; fen: string }[],
    onDeletePosition: vi.fn(),
    onUpdatePosition: vi.fn(),
    ...over,
  };
  render(<PositionPoolFields {...props} />);
  return props;
}

describe('PositionPoolFields — iki ekleme yöntemi', () => {
  it('başlangıçta iki seçenek kartı görünür, hiçbiri açık değildir', () => {
    setup();
    expect(screen.getByText('Konum Dizerek Ekle')).toBeInTheDocument();
    expect(screen.getByText('FEN Ekle')).toBeInTheDocument();
    expect(screen.queryByText('Konumu Kaydet')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/FEN/i)).not.toBeInTheDocument();
  });

  it('Konum Dizerek Ekle seçilince tahta editörü ve Konumu Kaydet gelir', () => {
    setup();
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
  });

  it('FEN Ekle seçilince yapıştırma kutusu gelir', () => {
    setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    expect(screen.getByPlaceholderText(/FEN/i)).toBeInTheDocument();
  });
});

describe('PositionPoolFields — elle dizme (regresyon)', () => {
  it('Konumu Kaydet tıklanınca onSavePosition çağrılır', () => {
    const p = setup();
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(p.onSavePosition).toHaveBeenCalled();
  });
});

describe('PositionPoolFields — FEN ile ekleme', () => {
  it('geçersiz FEN uyarı verir ve kaydet düğmesi pasiftir', () => {
    setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: 'saçma metin' } });
    expect(screen.getByText(/geçerli değil/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' })).toBeDisabled();
  });

  it('geçerli FEN kaydedilince onSavePosition o FEN ile çağrılır', () => {
    const p = setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: START_FEN } });
    expect(screen.queryByText(/geçerli değil/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' }));
    expect(p.onSavePosition).toHaveBeenCalledWith(START_FEN);
  });

  it('hamle sırası FEN içinden otomatik gelir (siyah)', () => {
    setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: SIYAH_FEN } });
    expect(screen.getByRole('button', { name: 'Siyah' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hoca sırayı değiştirince kaydedilen FEN de değişir', () => {
    const p = setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: START_FEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Siyah' }));
    fireEvent.click(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' }));
    expect(p.onSavePosition).toHaveBeenCalledWith(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
    );
  });

  it('kaydettikten sonra kutu temizlenir', () => {
    setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    const kutu = screen.getByPlaceholderText(/FEN/i) as HTMLTextAreaElement;
    fireEvent.change(kutu, { target: { value: START_FEN } });
    fireEvent.click(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' }));
    expect((screen.getByPlaceholderText(/FEN/i) as HTMLTextAreaElement).value).toBe('');
  });
});

describe('PositionPoolFields — havuz listesi (regresyon)', () => {
  it('havuz kartı konum sayısını gösterir (kodlar kapalı durur)', () => {
    setup({ pool: [{ id: 'p1', fen: START_FEN }, { id: 'p2', fen: START_FEN }] });
    expect(screen.getByText(/Konum Havuzu/).closest('button')).toHaveTextContent('2');
    // Kod kartları havuz açılmadan görünmez — ayrıntılı testler
    // tests/position-pool-view.test.tsx dosyasında.
    expect(screen.queryByRole('button', { name: 'Konum 001' })).not.toBeInTheDocument();
  });

  it('havuz boşken kart 0 gösterir', () => {
    setup();
    expect(screen.getByText(/Konum Havuzu/).closest('button')).toHaveTextContent('0');
  });
});

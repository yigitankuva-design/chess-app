import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MovePieceFields } from '@/components/admin/MovePieceFields';

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';

/** Zorunlu propları tek yerden verir — testler yalnızca ilgilendiklerini ezer. */
function setup(over: Partial<React.ComponentProps<typeof MovePieceFields>> = {}) {
  const props = {
    setupFen: EMPTY,
    onSetupFenChange: vi.fn(),
    setupTurn: 'w' as const,
    onSetupTurnChange: vi.fn(),
    fen: null as string | null,
    moves: [] as string[],
    onChange: vi.fn(),
    notationSaved: false,
    onNotationSavedChange: vi.fn(),
    annotations: [] as import('@/lib/chess/paintItems').PaintItem[],
    onAnnotationsChange: vi.fn(),
    ...over,
  };
  render(<MovePieceFields {...props} />);
  return props;
}

describe('MovePieceFields', () => {
  it('fen null iken setup fazı: taş paleti ve "Konumu Kaydet" görünür', () => {
    setup();
    expect(screen.getByText('Konumu Kaydet')).toBeInTheDocument();
    expect(screen.getByLabelText('Beyaz Vezir')).toBeInTheDocument(); // BoardEditor paleti
    expect(screen.queryByText('Notasyon Tablosu')).not.toBeInTheDocument();
  });

  it('"Konumu Kaydet" tıklanınca ÜST BİLEŞENDEN gelen setupFen ile onChange çağrılır', () => {
    const props = setup({ setupFen: TWO_SIDED });
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(props.onChange).toHaveBeenCalledWith(TWO_SIDED, []);
  });

  it('KANIT: dizme tahtası ÜST BİLEŞENDEN gelen setupFen ile çizilir', () => {
    setup({ setupFen: TWO_SIDED });
    // BoardEditor kendi altında "FEN: ..." yazdırır — iç state kullanılsaydı
    // burada boş tahta FEN'i görünürdü.
    expect(screen.getByText(`FEN: ${TWO_SIDED}`)).toBeInTheDocument();
  });

  it('tahta temizlenince onSetupFenChange üst bileşene haber verir', () => {
    const props = setup({ setupFen: TWO_SIDED });
    fireEvent.click(screen.getByText('Tahtayı temizle'));
    expect(props.onSetupFenChange).toHaveBeenCalled();
  });

  it('hamle sırası değişince onSetupTurnChange üst bileşene haber verir', () => {
    const props = setup({ setupFen: TWO_SIDED });
    fireEvent.click(screen.getByText('Siyah'));
    expect(props.onSetupTurnChange).toHaveBeenCalledWith('b');
  });

  it('fen doluyken recording fazı: Notasyon Tablosu ve "Konumu Düzenle" görünür', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'] });
    expect(screen.getByText('Notasyon Tablosu')).toBeInTheDocument();
    expect(screen.getByText('Konumu Düzenle')).toBeInTheDocument();
    expect(screen.queryByText('Konumu Kaydet')).not.toBeInTheDocument();
  });

  it('"Konumu Düzenle" setup fazına döner ve hamleleri sıfırlar', () => {
    const props = setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4', 'Kf8'] });
    fireEvent.click(screen.getByText('Konumu Düzenle'));
    expect(props.onChange).toHaveBeenCalledWith(null, []);
  });
});

describe('MovePieceFields — Notasyonu Kaydet (adım 5)', () => {
  it('hamle yokken "Notasyonu Kaydet" devre dışıdır', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: [] });
    expect(screen.getByText('Notasyonu Kaydet')).toBeDisabled();
  });

  it('hamle varken "Notasyonu Kaydet" etkindir', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'] });
    expect(screen.getByText('Notasyonu Kaydet')).toBeEnabled();
  });

  it('"Notasyonu Kaydet" tıklanınca üst bileşene true bildirilir', () => {
    const props = setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'] });
    fireEvent.click(screen.getByText('Notasyonu Kaydet'));
    expect(props.onNotationSavedChange).toHaveBeenCalledWith(true);
  });

  it('notationSaved true iken kaydedilen notasyon cevap olarak gösterilir', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4', 'Kf8'], notationSaved: true });
    expect(screen.getByText('1. Rh4 Kf8')).toBeInTheDocument();
    expect(screen.getByText(/Kaydedilen cevap notasyonu/)).toBeInTheDocument();
  });

  it('notationSaved true iken tahta ve kaydet butonu gösterilmez (kilitli)', () => {
    setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'], notationSaved: true });
    expect(screen.queryByText('Notasyon Tablosu')).not.toBeInTheDocument();
    expect(screen.queryByText('Notasyonu Kaydet')).not.toBeInTheDocument();
  });

  it('"Notasyonu Düzenle" kilidi açar', () => {
    const props = setup({ setupFen: TWO_SIDED, fen: TWO_SIDED, moves: ['Rh4'], notationSaved: true });
    fireEvent.click(screen.getByText('Notasyonu Düzenle'));
    expect(props.onNotationSavedChange).toHaveBeenCalledWith(false);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotationCard } from '@/components/analiz/NotationCard';

const MOVES = [
  { ply: 1, san: 'e4', fenAfter: 'FEN1' },
  { ply: 2, san: 'e5', fenAfter: 'FEN2' },
  { ply: 3, san: 'Nf3', fenAfter: 'FEN3' },
];

function setup(over: Partial<React.ComponentProps<typeof NotationCard>> = {}) {
  const props: React.ComponentProps<typeof NotationCard> = {
    moves: MOVES, hideNotation: false, onToggleHideNotation: vi.fn(),
    ...over,
  };
  render(<NotationCard {...props} />);
  return props;
}

describe('NotationCard — görseldeki tasarım (madde 2026-09-05 (4))', () => {
  it('"Hamleler" başlığı ve "Notasyon Verilerini Gizle" onay kutusu üstte gösterilir', () => {
    setup();
    expect(screen.getByText('Hamleler')).toBeInTheDocument();
    expect(screen.getByLabelText('Notasyon Verilerini Gizle')).toBeInTheDocument();
  });

  it('madde 2026-09-06 (üçüncü tur/5): kart çerçevesi tema uyumlu (var(--t-accent))', () => {
    setup();
    const card = screen.getByText('Hamleler').closest<HTMLElement>('div.rounded-xl');
    expect(card?.style.borderColor).toBe('var(--t-accent)');
  });

  it('her tam hamle "N. beyaz - siyah" biçiminde (tire ile) gösterilir', () => {
    setup();
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByText('e5')).toBeInTheDocument();
  });

  it('siyah henüz oynanmadıysa yine de sondaki tire görünür (görseldeki "8. h3 -" gibi)', () => {
    setup({ moves: [{ ply: 1, san: 'h3', fenAfter: 'F' }] });
    const cell = screen.getByText('1.').closest('div');
    expect(cell?.textContent?.trim().endsWith('-')).toBe(true);
  });

  it('hamle yokken bilgi mesajı gösterir', () => {
    setup({ moves: [] });
    expect(screen.getByText('Henüz hamle yok.')).toBeInTheDocument();
  });

  it('checkbox tıklanınca onToggleHideNotation çağrılır', () => {
    const onToggleHideNotation = vi.fn();
    setup({ onToggleHideNotation });
    fireEvent.click(screen.getByLabelText('Notasyon Verilerini Gizle'));
    expect(onToggleHideNotation).toHaveBeenCalledTimes(1);
  });

  it('checked prop checkbox\'ın durumunu yansıtır', () => {
    setup({ hideNotation: true });
    expect(screen.getByLabelText('Notasyon Verilerini Gizle')).toBeChecked();
  });
});

describe('NotationCard — sağ tık menüsü (madde 2026-09-05 (3))', () => {
  it('bir hamleye sağ tıklayınca "FEN Kopyala" ve "Bu Hamleden Sonrasını Sil" menüsü açılır', () => {
    setup();
    fireEvent.contextMenu(screen.getByText('e5'));
    expect(screen.getByText('FEN Kopyala')).toBeInTheDocument();
    expect(screen.getByText('Bu Hamleden Sonrasını Sil')).toBeInTheDocument();
  });

  it('"FEN Kopyala" o hamlenin FEN\'ini panoya kopyalar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    fireEvent.contextMenu(screen.getByText('e5'));
    fireEvent.click(screen.getByText('FEN Kopyala'));
    expect(writeText).toHaveBeenCalledWith('FEN2');
  });

  it('"Bu Hamleden Sonrasını Sil" onDeleteAfter\'ı doğru ply ile çağırır', () => {
    const onDeleteAfter = vi.fn();
    setup({ onDeleteAfter });
    fireEvent.contextMenu(screen.getByText('e5'));
    fireEvent.click(screen.getByText('Bu Hamleden Sonrasını Sil'));
    expect(onDeleteAfter).toHaveBeenCalledWith(2);
  });

  it('menü dışına tıklanınca kapanır', () => {
    setup();
    fireEvent.contextMenu(screen.getByText('e5'));
    expect(screen.getByText('FEN Kopyala')).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(screen.queryByText('FEN Kopyala')).not.toBeInTheDocument();
  });
});

describe('NotationCard — tıklanabilirlik', () => {
  it('onSelectPly verilmezse hamleler tıklanamaz (span)', () => {
    setup();
    expect(screen.getByText('e5').tagName).toBe('SPAN');
  });

  it('onSelectPly verilirse tıklanabilir ve doğru ply ile çağrılır', () => {
    const onSelectPly = vi.fn();
    setup({ onSelectPly });
    fireEvent.click(screen.getByText('e5'));
    expect(onSelectPly).toHaveBeenCalledWith(2);
  });

  it('currentPly verilen hamleyi vurgular', () => {
    setup({ onSelectPly: vi.fn(), currentPly: 2 });
    expect(screen.getByText('e5')).toHaveStyle({ background: 'rgba(34,211,238,0.25)' });
  });
});

describe('NotationCard — hamle kalitesi işaretleri (madde 2026-09-05 (3))', () => {
  // ply1 (beyaz, e4): 0 → -250 = beyaz için -250 → "?" kırmızı.
  // ply2 (siyah, e5): -250 → -500 (beyaz açısından) = siyah için +250 → "!" açık mavi.
  // ply3 (Nf3): evalByPly'da yok → işaretsiz kalır.
  const EVAL_BY_PLY = {
    0: { cp: 0, mate: null },
    1: { cp: -250, mate: null },
    2: { cp: -500, mate: null },
  };

  it('ciddi kötüleşen hamlenin sonuna "?" eklenir ve kırmızı gösterilir', () => {
    setup({ evalByPly: EVAL_BY_PLY });
    const el = screen.getByText('e4?');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ color: '#f87171', fontWeight: '700' });
  });

  it('ciddi iyileşen hamlenin sonuna "!" eklenir ve açık mavi gösterilir', () => {
    setup({ evalByPly: EVAL_BY_PLY });
    const el = screen.getByText('e5!');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ color: '#7dd3fc' });
  });

  it('skoru olmayan/ciddi değişim yapmayan hamle işaretsiz kalır', () => {
    setup({ evalByPly: EVAL_BY_PLY });
    // toTurkishSan: "Nf3" (İngilizce At) → "Af3" (Türkçe).
    expect(screen.getByText('Af3')).toBeInTheDocument();
    expect(screen.queryByText('Af3?')).not.toBeInTheDocument();
    expect(screen.queryByText('Af3!')).not.toBeInTheDocument();
  });

  it('evalByPly verilmezse hiçbir hamle işaretlenmez (geriye dönük uyumlu)', () => {
    setup();
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.queryByText('e4?')).not.toBeInTheDocument();
  });

  it('evalProgress bitmemişken ilerleme satırı gösterilir', () => {
    setup({ evalProgress: { done: 1, total: 3 } });
    expect(screen.getByText('Hamleler değerlendiriliyor... (1/3)')).toBeInTheDocument();
  });

  it('evalProgress tamamlanınca ilerleme satırı kaybolur', () => {
    setup({ evalProgress: { done: 3, total: 3 } });
    expect(screen.queryByText(/değerlendiriliyor/)).not.toBeInTheDocument();
  });
});

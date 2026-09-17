import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameExportBlock } from '@/components/analiz/GameExportBlock';

/**
 * Madde 2026-09-14 (3d): notasyonun altında görünür "PGN Kopyala"/
 * "FEN Kopyala" — üç Analiz Et ekranının hepsine eklendi.
 */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

it('"FEN Kopyala" o an tahtada görüntülenen pozisyonun FEN\'ini panoya kopyalar', async () => {
  render(<GameExportBlock sanMoves={['e4']} currentFen={FEN_AFTER_E4} startFen={START_FEN} />);
  fireEvent.click(screen.getByText('FEN Kopyala'));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(FEN_AFTER_E4));
  await waitFor(() => screen.getByText('FEN Kopyalandı ✓'));
});

it('"PGN Kopyala" TÜM maçın PGN\'ini (standart başlangıçtan) panoya kopyalar', async () => {
  render(<GameExportBlock sanMoves={['e4', 'e5', 'Nf3']} currentFen={FEN_AFTER_E4} />);
  fireEvent.click(screen.getByText('PGN Kopyala'));
  await waitFor(() => expect(writeText).toHaveBeenCalled());
  const pgn = writeText.mock.calls[0][0] as string;
  expect(pgn).toContain('1. e4 e5 2. Nf3');
  await waitFor(() => screen.getByText('PGN Kopyalandı ✓'));
});

it('startFen standart olmayan bir konumsa PGN başlığında [FEN] etiketi olur', async () => {
  // Beyaz sadece şahla, siyah sadece şahla — standart olmayan başlangıç.
  const customStart = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
  render(<GameExportBlock sanMoves={['Kd2']} currentFen={customStart} startFen={customStart} />);
  fireEvent.click(screen.getByText('PGN Kopyala'));
  await waitFor(() => expect(writeText).toHaveBeenCalled());
  const pgn = writeText.mock.calls[0][0] as string;
  expect(pgn).toContain('[FEN');
});

it('pano erişimi başarısız olursa sessizce yoksayılır, hata FIRLATMAZ', async () => {
  writeText.mockRejectedValueOnce(new Error('no clipboard'));
  render(<GameExportBlock sanMoves={[]} currentFen={START_FEN} />);
  expect(() => fireEvent.click(screen.getByText('FEN Kopyala'))).not.toThrow();
});

it('madde 2026-09-18: her iki düğmenin de belirgin bir çerçevesi vardır', () => {
  render(<GameExportBlock sanMoves={[]} currentFen={START_FEN} />);
  expect(screen.getByText('PGN Kopyala')).toHaveStyle({ border: '2px solid var(--t-accent)' });
  expect(screen.getByText('FEN Kopyala')).toHaveStyle({ border: '2px solid var(--t-accent)' });
});

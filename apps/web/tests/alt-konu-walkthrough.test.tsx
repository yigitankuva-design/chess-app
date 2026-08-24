import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ExplanationCard } from '@/lib/customTabsApi';

// NEDEN STUB: gerçek react-chessboard, taş animasyonu için kareden
// getBoundingClientRect().width okur; happy-dom'da layout olmadığı için FEN
// değişince (kart/konum geçişinde) "Square width not found" fırlatır. Bu
// testlerde incelenen şey tahta çizimi DEĞİL, hangi konum/cümlenin aktif
// olduğu — bkz. tests/board-exercise-question-reset.test.tsx'teki AYNI desen.
vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, hideNotation }: { fen: string; hideNotation?: boolean }) => (
    <div>
      <div data-square="e4" data-fen={fen} />
      {!hideNotation && <span>a</span>}
    </div>
  ),
}));

import { AltKonuWalkthrough } from '@/components/custom/AltKonuWalkthrough';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN2 = '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1';

describe('AltKonuWalkthrough — görsel referans tasarımı (madde 2026-08-25)', () => {
  it('hiçbir konum/kart yokken tahta yerine bilgi mesajı gösterir', () => {
    render(<AltKonuWalkthrough positions={[]} cards={[]} />);
    expect(screen.getByText('Henüz konum eklenmedi.')).toBeInTheDocument();
    expect(screen.queryByText(/Konum Havuzu/)).not.toBeInTheDocument();
  });

  it('Konum Havuzu sayacı ve İleri/Geri okları üstte, sağda görünür', () => {
    render(<AltKonuWalkthrough positions={[{ id: 'p1', fen: FEN }, { id: 'p2', fen: FEN2 }]} cards={[]} />);
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();
    expect(screen.getByLabelText('Önceki konum')).toBeDisabled();
    expect(screen.getByLabelText('Sonraki konum')).toBeEnabled();

    fireEvent.click(screen.getByLabelText('Sonraki konum'));
    expect(screen.getByText('2 / 2 — Konum Havuzu 002')).toBeInTheDocument();
    expect(screen.getByLabelText('Sonraki konum')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Önceki konum'));
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();
  });

  it('açıklama kartları tahtanın solunda 1\'den başlayarak numaralanır, kart sayısı admin\'in girdiği kadardır', () => {
    const cards: ExplanationCard[] = [
      { id: 'c1', fen: FEN, sentence: 'Birinci açıklama.' },
      { id: 'c2', fen: FEN2, sentence: 'İkinci açıklama.' },
      { id: 'c3', fen: FEN, sentence: 'Üçüncü açıklama.' },
    ];
    render(<AltKonuWalkthrough positions={[]} cards={cards} />);
    expect(screen.getByLabelText('Açıklama 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Açıklama 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Açıklama 3')).toBeInTheDocument();
  });

  it('bir karta tıklanınca o kartın konumu tahtaya gelir ve cümlesi altta gösterilir', () => {
    const cards: ExplanationCard[] = [
      { id: 'c1', fen: FEN, sentence: 'Tahta 8x8 karelerden oluşur.' },
      { id: 'c2', fen: FEN2, sentence: 'Işıklı ve koyu kareler sırayla dizilir.' },
    ];
    render(<AltKonuWalkthrough positions={[]} cards={cards} />);
    expect(screen.getByText('Numaralı butonlara tıklandığında ekrana gelecek cümleler')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Açıklama 1'));
    expect(screen.getByText('Tahta 8x8 karelerden oluşur.')).toBeInTheDocument();
    expect(screen.getByLabelText('Açıklama 1')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByLabelText('Açıklama 2'));
    expect(screen.getByText('Işıklı ve koyu kareler sırayla dizilir.')).toBeInTheDocument();
    expect(screen.queryByText('Tahta 8x8 karelerden oluşur.')).not.toBeInTheDocument();
  });

  it('İleri/Geri ile Konum Havuzu\'na geçilince aktif kart bırakılır (placeholder cümle geri gelir)', () => {
    const cards: ExplanationCard[] = [{ id: 'c1', fen: FEN, sentence: 'Açıklama.' }];
    render(<AltKonuWalkthrough positions={[{ id: 'p1', fen: FEN }, { id: 'p2', fen: FEN2 }]} cards={cards} />);
    fireEvent.click(screen.getByLabelText('Açıklama 1'));
    expect(screen.getByText('Açıklama.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Sonraki konum'));
    expect(screen.getByText('Numaralı butonlara tıklandığında ekrana gelecek cümleler')).toBeInTheDocument();
    expect(screen.getByLabelText('Açıklama 1')).toHaveAttribute('aria-pressed', 'false');
  });

  it('madde 6: notasyon alanı ve "Notasyon Verilerini Gizle" onay kutusu gösterilir, işaretlenince tahta koordinatları gizlenir', () => {
    render(<AltKonuWalkthrough positions={[{ id: 'p1', fen: FEN }]} cards={[]} />);
    expect(screen.getByText('Notasyon alanı')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    const checkbox = screen.getByLabelText('Notasyon Verilerini Gizle');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
  });

  it('madde 3: tahta genişliği 420px (240px\'ten %75 büyütülmüş) bir kapta durur', () => {
    render(<AltKonuWalkthrough positions={[{ id: 'p1', fen: FEN }]} cards={[]} />);
    const board = document.querySelector('[data-square="e4"]');
    expect(board).toBeInTheDocument();
    const capsule = document.querySelector('div[style*="max-width: 420px"]');
    expect(capsule).toBeInTheDocument();
  });
});

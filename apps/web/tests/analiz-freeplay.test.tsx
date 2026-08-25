import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/analiz/AnalysisBoard', () => ({
  AnalysisBoard: ({
    fen, interactive, onPieceDrop,
  }: { fen: string; interactive?: boolean; onPieceDrop?: (from: string, to: string) => boolean }) => (
    <div data-testid="analysis-board" data-fen={fen} data-interactive={interactive ? 'true' : 'false'}>
      <button type="button" data-testid="drop-e2e4" onClick={() => onPieceDrop?.('e2', 'e4')} />
      <button type="button" data-testid="drop-illegal" onClick={() => onPieceDrop?.('e2', 'e5')} />
    </div>
  ),
}));

import { FreePlayAnalysis } from '@/components/analiz/FreePlayAnalysis';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('FreePlayAnalysis — "Yeni Analiz" (madde 2026-09-02 (2))', () => {
  it('başlangıç pozisyonuyla, interaktif olarak açılır (kayıtlı maç YOK)', () => {
    render(<FreePlayAnalysis />);
    const board = screen.getByTestId('analysis-board');
    expect(board).toHaveAttribute('data-fen', START_FEN);
    expect(board).toHaveAttribute('data-interactive', 'true');
  });

  it('geçerli bir hamle oynanınca AnalysisBoard\'a giden fen güncellenir', () => {
    render(<FreePlayAnalysis />);
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute(
      'data-fen', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
  });

  it('geçersiz bir hamle fen\'i DEĞİŞTİRMEZ', () => {
    render(<FreePlayAnalysis />);
    fireEvent.click(screen.getByTestId('drop-illegal'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', START_FEN);
  });
});

describe('FreePlayAnalysis — notasyon alanı (madde 2026-09-03 (1))', () => {
  it('başlangıçta "henüz hamle yok" gösterir', () => {
    render(<FreePlayAnalysis />);
    expect(screen.getByText('Henüz hamle yok.')).toBeInTheDocument();
  });

  it('hamle oynandıkça aday hamlelerin ALTINDA notasyon listesine eklenir', () => {
    render(<FreePlayAnalysis />);
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
  });
});

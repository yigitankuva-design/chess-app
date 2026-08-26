import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/analiz/AnalysisBoard', () => ({
  AnalysisBoard: ({
    fen, interactive, onPieceDrop, onWheelStep, hideNotation,
  }: {
    fen: string; interactive?: boolean; onPieceDrop?: (from: string, to: string) => boolean;
    onWheelStep?: (delta: 1 | -1) => void; hideNotation?: boolean;
  }) => (
    <div data-testid="analysis-board" data-fen={fen} data-interactive={interactive ? 'true' : 'false'}
      data-hide-notation={hideNotation ? 'true' : 'false'}>
      <button type="button" data-testid="drop-e2e4" onClick={() => onPieceDrop?.('e2', 'e4')} />
      <button type="button" data-testid="drop-e7e5" onClick={() => onPieceDrop?.('e7', 'e5')} />
      <button type="button" data-testid="drop-illegal" onClick={() => onPieceDrop?.('e2', 'e5')} />
      <button type="button" data-testid="wheel-forward" onClick={() => onWheelStep?.(1)} />
      <button type="button" data-testid="wheel-back" onClick={() => onWheelStep?.(-1)} />
    </div>
  ),
}));

// Madde 2026-09-05 (3): gerçek motor/Worker burada test edilmiyor (bkz.
// use-move-quality-eval.test.tsx) — bu dosya yalnızca FreePlayAnalysis'ın
// KENDİ mantığını (hamle oynama, tekerlek, dallanma, silme) test ediyor.
vi.mock('@/lib/chess/useMoveQualityEval', () => ({
  useMoveQualityEval: () => ({ evalByPly: {}, progress: { done: 0, total: 0 } }),
}));

import { FreePlayAnalysis } from '@/components/analiz/FreePlayAnalysis';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

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
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', FEN_AFTER_E4);
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

describe('FreePlayAnalysis — fare tekerleğiyle geri/ileri alma (madde 2026-09-05 (2))', () => {
  it('tekerlek geri, son oynanan hamleyi geri alır (tahtada görünmez olur)', () => {
    render(<FreePlayAnalysis />);
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', FEN_AFTER_E4);

    fireEvent.click(screen.getByTestId('wheel-back'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', START_FEN);
  });

  it('geri alındıktan sonra tekerlek ileri, hamleyi TEKRAR uygular', () => {
    render(<FreePlayAnalysis />);
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    fireEvent.click(screen.getByTestId('wheel-back'));
    fireEvent.click(screen.getByTestId('wheel-forward'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', FEN_AFTER_E4);
  });

  it('geri alınmış bir konumdan YENİ bir hamle oynanırsa, geri alınan hamle KALICI olarak budanır (dallanma)', () => {
    render(<FreePlayAnalysis />);
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    fireEvent.click(screen.getByTestId('drop-e7e5'));
    fireEvent.click(screen.getByTestId('wheel-back')); // e5'i geri al, e4'te kal
    fireEvent.click(screen.getByTestId('wheel-back')); // e4'ü de geri al, başlangıca dön
    fireEvent.click(screen.getByTestId('drop-e2e4')); // aynı hamleyi yeniden oyna
    // e7e5 artık geri gelemez — ileri tekerlek başlangıçtan sadece 1 adım ileri gidebilir.
    fireEvent.click(screen.getByTestId('wheel-forward'));
    fireEvent.click(screen.getByTestId('wheel-forward'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', FEN_AFTER_E4);
  });
});

describe('FreePlayAnalysis — Notasyon Verilerini Gizle (madde 2026-09-05 (4))', () => {
  it('checkbox tıklanınca AnalysisBoard\'a hideNotation olarak yansır', () => {
    render(<FreePlayAnalysis />);
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-hide-notation', 'false');
    fireEvent.click(screen.getByLabelText('Notasyon Verilerini Gizle'));
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-hide-notation', 'true');
  });
});

describe('FreePlayAnalysis — "Bu Hamleden Sonrasını Sil" (madde 2026-09-05 (3))', () => {
  it('seçilen hamleden sonrası kalıcı olarak kaldırılır', () => {
    render(<FreePlayAnalysis />);
    fireEvent.click(screen.getByTestId('drop-e2e4'));
    fireEvent.click(screen.getByTestId('drop-e7e5'));

    fireEvent.contextMenu(screen.getByText('e4'));
    fireEvent.click(screen.getByText('Bu Hamleden Sonrasını Sil'));

    expect(screen.queryByText('e5')).not.toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-board')).toHaveAttribute('data-fen', FEN_AFTER_E4);
  });
});

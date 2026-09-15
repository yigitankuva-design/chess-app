import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CandidateMovePoolFields } from '@/components/admin/CandidateMovePoolFields';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

let multiPvResult: { moveUci: string; scoreCp: number | null; mate: number | null; pvUci: string[] }[] = [
  { moveUci: 'e2e4', scoreCp: 30, mate: null, pvUci: ['e2e4'] },
  { moveUci: 'd2d4', scoreCp: 25, mate: null, pvUci: ['d2d4'] },
];

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async analyzeMultiPv() { return multiPvResult; }
    destroy() {}
  },
}));

// Gerçek react-chessboard happy-dom'da fen prop'u değişince yeniden render
// olurken "Square width not found" fırlatır (diğer test dosyalarında da
// belgelenmiş bir happy-dom/react-chessboard kısıtlaması, bkz.
// tests/bot-game-persistence.test.tsx). Burada test edilen tahta çizimi
// değil, "Analiz Et"/"Kaydet" gate mantığı — bu yüzden BoardEditor/
// SavedPositionBoard basit birer stub'a indirgeniyor.
vi.mock('@/components/BoardEditor', () => ({
  BoardEditor: ({ fen }: { fen: string }) => <div data-testid="board-editor" data-fen={fen} />,
}));
vi.mock('@/components/admin/SavedPositionBoard', () => ({
  SavedPositionBoard: ({ fen }: { fen: string }) => <div data-testid="saved-position-board" data-fen={fen} />,
}));

function setup(over: Partial<React.ComponentProps<typeof CandidateMovePoolFields>> = {}) {
  const props = {
    fen: START_FEN, turn: 'w' as const,
    onFenChange: vi.fn(), onTurnChange: vi.fn(),
    onSavePosition: vi.fn(),
    pool: [] as React.ComponentProps<typeof CandidateMovePoolFields>['pool'],
    onDeletePosition: vi.fn(),
    onUpdatePosition: vi.fn(),
    ...over,
  };
  const { rerender } = render(<CandidateMovePoolFields {...props} />);
  return { ...props, rerender };
}

describe('CandidateMovePoolFields — iki ekleme yöntemi (madde 2026-09-15)', () => {
  it('başlangıçta iki seçenek kartı görünür', () => {
    setup();
    expect(screen.getByText('Konum Dizerek Ekle')).toBeInTheDocument();
    expect(screen.getByText('FEN Ekle')).toBeInTheDocument();
    expect(screen.queryByText('Konumu Kaydet')).not.toBeInTheDocument();
  });

  it('Konumun Sahibi alanı YOKTUR (Kazanç Konumu\'na özgü, Aday Hamle\'de gereksiz)', () => {
    setup();
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    expect(screen.queryByText('Konumun Sahibi')).not.toBeInTheDocument();
  });
});

describe('CandidateMovePoolFields — dizme modu: analiz zorunlu (gate)', () => {
  it('analiz edilmeden "Konumu Kaydet" pasiftir', () => {
    setup();
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    expect(screen.getByRole('button', { name: 'Konumu Kaydet' })).toBeDisabled();
  });

  it('"Analiz Et" ile 3 aday hamle bulununca "Konumu Kaydet" aktifleşir ve doğru hamlelerle çağrılır', async () => {
    const p = setup();
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Konumu Kaydet' })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'Konumu Kaydet' }));
    expect(p.onSavePosition).toHaveBeenCalledWith(undefined, [
      { move_uci: 'e2e4', move_san: 'e4', score_cp: 30, mate: null },
      { move_uci: 'd2d4', move_san: 'd4', score_cp: 25, mate: null },
    ]);
  });

  it('pozisyon (fen prop) analiz SONRASI değişirse Kaydet tekrar pasifleşir', async () => {
    const p = setup();
    fireEvent.click(screen.getByText('Konum Dizerek Ekle'));
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Konumu Kaydet' })).not.toBeDisabled());

    const YENI_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const { rerender, ...componentProps } = p;
    rerender(<CandidateMovePoolFields {...componentProps} fen={YENI_FEN} />);
    expect(screen.getByRole('button', { name: 'Konumu Kaydet' })).toBeDisabled();
  });
});

describe('CandidateMovePoolFields — FEN yapıştırma modu: analiz burada da zorunlu (fark: PositionPoolFields\'ta yoktu)', () => {
  it('FEN yapıştırılınca analiz paneli görünür, analiz edilmeden Kaydet pasiftir', () => {
    setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: START_FEN } });
    expect(screen.getByText('🔍 Konumu Analiz Et')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' })).toBeDisabled();
  });

  it('analiz sonrası Kaydet aktifleşir ve doğru FEN + hamlelerle çağrılır', async () => {
    const p = setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    fireEvent.change(screen.getByPlaceholderText(/FEN/i), { target: { value: START_FEN } });
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' }));
    expect(p.onSavePosition).toHaveBeenCalledWith(START_FEN, [
      { move_uci: 'e2e4', move_san: 'e4', score_cp: 30, mate: null },
      { move_uci: 'd2d4', move_san: 'd4', score_cp: 25, mate: null },
    ]);
  });

  it('FEN metni değiştirilince analiz sonucu sıfırlanır', async () => {
    setup();
    fireEvent.click(screen.getByText('FEN Ekle'));
    const kutu = screen.getByPlaceholderText(/FEN/i);
    fireEvent.change(kutu, { target: { value: START_FEN } });
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' })).not.toBeDisabled());

    fireEvent.change(kutu, { target: { value: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' } });
    expect(screen.getByRole('button', { name: 'FEN Konumunu Kaydet' })).toBeDisabled();
  });
});

describe('CandidateMovePoolFields — havuz listesi (regresyon)', () => {
  it('havuz kartı konum sayısını gösterir', () => {
    setup({ pool: [{ id: 'p1', fen: START_FEN }, { id: 'p2', fen: START_FEN }] });
    expect(screen.getByText(/Konum Havuzu/).closest('button')).toHaveTextContent('2');
  });
});

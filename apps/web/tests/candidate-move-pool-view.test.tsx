import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CandidateMovePoolView } from '@/components/admin/CandidateMovePoolView';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

let multiPvResult: { moveUci: string; scoreCp: number | null; mate: number | null; pvUci: string[] }[] = [
  { moveUci: 'e2e4', scoreCp: 30, mate: null, pvUci: ['e2e4'] },
];

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async analyzeMultiPv() { return multiPvResult; }
    destroy() {}
  },
}));

function setup(over: Partial<React.ComponentProps<typeof CandidateMovePoolView>> = {}) {
  const props = {
    pool: [{ id: 'a', fen: FEN, code: '001', candidate_moves: [
      { move_uci: 'e2e4', move_san: 'e4', score_cp: 30, mate: null },
    ] }],
    onUpdatePosition: vi.fn(),
    onDeletePosition: vi.fn(),
    ...over,
  };
  render(<CandidateMovePoolView {...props} />);
  return props;
}

describe('CandidateMovePoolView — havuz kartı (madde 2026-09-15)', () => {
  it('kapalıyken kart sayı gösterir', () => {
    setup();
    expect(screen.getByText(/Konum Havuzu/).closest('button')).toHaveTextContent('1');
  });

  it('koda tıklayınca düzenleme açılır, kayıtlı cevap anahtarı gösterilir', () => {
    setup();
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    expect(screen.getByText('Kayıtlı cevap anahtarı:')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
  });
});

describe('CandidateMovePoolView — düzenleme: cevap anahtarı güncelse Kaydet aktif', () => {
  it('pozisyon değişmemişse (mevcut cevap anahtarı güncel) Değişikliği Kaydet baştan aktiftir', () => {
    const p = setup();
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    expect(screen.getByRole('button', { name: 'Değişikliği Kaydet' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Değişikliği Kaydet' }));
    expect(p.onUpdatePosition).toHaveBeenCalledWith('a', expect.objectContaining({
      fen: FEN,
      candidate_moves: [{ move_uci: 'e2e4', move_san: 'e4', score_cp: 30, mate: null }],
    }));
  });
});

describe('CandidateMovePoolView — düzenleme: cevap anahtarı yoksa/geçersizse yeniden analiz gerekir', () => {
  it('cevap anahtarı olmayan bir konumda Kaydet baştan pasiftir, analiz paneli görünür', () => {
    setup({ pool: [{ id: 'a', fen: FEN, code: '001' }] });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    expect(screen.getByRole('button', { name: 'Değişikliği Kaydet' })).toBeDisabled();
    expect(screen.getByText('🔍 Konumu Analiz Et')).toBeInTheDocument();
  });

  it('"Analiz Et" ile taze cevap anahtarı üretilince Kaydet aktifleşir ve yeni hamlelerle çağrılır', async () => {
    const p = setup({ pool: [{ id: 'a', fen: FEN, code: '001' }] });
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    fireEvent.click(screen.getByText('🔍 Konumu Analiz Et'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Değişikliği Kaydet' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Değişikliği Kaydet' }));
    expect(p.onUpdatePosition).toHaveBeenCalledWith('a', expect.objectContaining({
      candidate_moves: [{ move_uci: 'e2e4', move_san: 'e4', score_cp: 30, mate: null }],
    }));
  });
});

describe('CandidateMovePoolView — Vazgeç/Sil (regresyon)', () => {
  it('Vazgeç düzenlemeyi kapatır, kaydetmez', () => {
    const p = setup();
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    fireEvent.click(screen.getByText('Vazgeç'));
    expect(p.onUpdatePosition).not.toHaveBeenCalled();
    expect(screen.queryByText('Değişikliği Kaydet')).not.toBeInTheDocument();
  });

  it('Sil konumu kaldırır', () => {
    const p = setup();
    fireEvent.click(screen.getByText(/Konum Havuzu/));
    fireEvent.click(screen.getByRole('button', { name: 'Konum 001' }));
    fireEvent.click(screen.getByText('Sil'));
    expect(p.onDeletePosition).toHaveBeenCalledWith('a');
  });
});

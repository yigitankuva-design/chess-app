import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PositionPoolEntry } from '@/lib/customTabsApi';

// NEDEN STUB: gerçek react-chessboard, taş animasyonu için kareden
// getBoundingClientRect().width okur; happy-dom'da layout olmadığı için FEN
// değişince (adım/grup geçişinde) "Square width not found" fırlatır. Bu
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

function group(id: string, code: string, steps: PositionPoolEntry['steps']): PositionPoolEntry {
  return { id, code, steps };
}

describe('AltKonuWalkthrough — Konum Havuzu iki seviyeli gezinme (madde 2026-08-26)', () => {
  it('havuz boşken bilgi mesajı gösterir', () => {
    render(<AltKonuWalkthrough pool={[]} />);
    expect(screen.getByText('Henüz konum eklenmedi.')).toBeInTheDocument();
  });

  it('ilk grup (kod 001) ile açılır, sayaç ve tahta doğru gösterilir', () => {
    const pool = [
      group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'Birinci adım.', turn: 'w' }]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('1 / 1 — Konum Havuzu 001')).toBeInTheDocument();
    expect(screen.getByText('Birinci adım.')).toBeInTheDocument();
    expect(screen.getByLabelText('Önceki konum')).toBeDisabled();
    expect(screen.getByLabelText('Sonraki konum')).toBeDisabled();
  });

  it('İleri/Geri ile GRUPLAR arasında gezinir, grup değişince ilk adıma döner', () => {
    const pool = [
      group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'Grup 1 - Adım 1', turn: 'w' }]),
      group('g2', '002', [{ id: 's2', fen: FEN2, sentence: 'Grup 2 - Adım 1', turn: 'w' }]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Sonraki konum'));
    expect(screen.getByText('2 / 2 — Konum Havuzu 002')).toBeInTheDocument();
    expect(screen.getByText('Grup 2 - Adım 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Sonraki konum')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Önceki konum'));
    expect(screen.getByText('1 / 2 — Konum Havuzu 001')).toBeInTheDocument();
  });

  it('bir grubun İÇİNDEKİ adımlar numaralı butonlarla gezilir, grup sayacı DEĞİŞMEZ', () => {
    const pool = [
      group('g1', '001', [
        { id: 's1', fen: FEN, sentence: 'Adım 1 cümlesi', turn: 'w' },
        { id: 's2', fen: FEN2, sentence: 'Adım 2 cümlesi', turn: 'b' },
      ]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('Adım 1 cümlesi')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Adım 2'));
    expect(screen.getByText('Adım 2 cümlesi')).toBeInTheDocument();
    expect(screen.queryByText('Adım 1 cümlesi')).not.toBeInTheDocument();
    // Grup sayacı adım geçişinden ETKİLENMEZ.
    expect(screen.getByText('1 / 1 — Konum Havuzu 001')).toBeInTheDocument();
  });

  it('tek adımlı gruplarda numaralı buton sütunu gösterilmez', () => {
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.queryByLabelText('Adım 1')).not.toBeInTheDocument();
  });

  it('madde 6: notasyon alanı ve "Notasyon Verilerini Gizle" onay kutusu gösterilir, işaretlenince tahta koordinatları gizlenir', () => {
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} />);
    expect(screen.getByText('Notasyon alanı')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    const checkbox = screen.getByLabelText('Notasyon Verilerini Gizle');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.queryByText('a')).not.toBeInTheDocument();
  });

  it('madde 3: tahta genişliği 420px (240px\'ten %75 büyütülmüş) bir kapta durur', () => {
    const pool = [group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }])];
    render(<AltKonuWalkthrough pool={pool} />);
    const board = document.querySelector('[data-square="e4"]');
    expect(board).toBeInTheDocument();
    const capsule = document.querySelector('div[style*="max-width: 420px"]');
    expect(capsule).toBeInTheDocument();
  });

  it('madde 2026-08-28 (2/3): İleri/Geri çerçevesi ve sayacın yazı kalınlığı %50 artırılmış (600), sayaç tahtayla AYNI kapta durur', () => {
    const pool = [
      group('g1', '001', [{ id: 's1', fen: FEN, sentence: 'x', turn: 'w' }]),
      group('g2', '002', [{ id: 's2', fen: FEN2, sentence: 'y', turn: 'w' }]),
    ];
    render(<AltKonuWalkthrough pool={pool} />);

    const prevBtn = screen.getByLabelText('Önceki konum');
    expect(prevBtn).toHaveStyle({ borderWidth: '1.5px', fontWeight: '600' });
    const nextBtn = screen.getByLabelText('Sonraki konum');
    expect(nextBtn).toHaveStyle({ borderWidth: '1.5px', fontWeight: '600' });

    const counter = screen.getByText('1 / 2 — Konum Havuzu 001');
    expect(counter).toHaveStyle({ fontWeight: '600' });
    // Sayaç, tahtanın 420px'lik kabıyla AYNI kapsayıcı içinde (sol kenar hizası).
    const boardCapsule = document.querySelector('div[style*="max-width: 420px"]');
    expect(boardCapsule?.contains(counter)).toBe(true);
  });
});

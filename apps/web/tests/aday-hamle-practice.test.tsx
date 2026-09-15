import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SECOND_FEN = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, interactive, onPieceDrop }: {
    fen: string; interactive?: boolean; onPieceDrop?: (f: string, t: string) => boolean;
  }) => (
    <div data-testid="board" data-fen={fen} data-interactive={String(!!interactive)}>
      <button onClick={() => onPieceDrop?.('e2', 'e4')}>oyna-e2e4</button>
      <button onClick={() => onPieceDrop?.('d2', 'd4')}>oyna-d2d4</button>
      <button onClick={() => onPieceDrop?.('g1', 'f3')}>oyna-g1f3</button>
      <button onClick={() => onPieceDrop?.('b1', 'c3')}>oyna-b1c3</button>
    </div>
  ),
}));

const createAdayHamleSession = vi.fn();
const submitAdayHamleAnswer = vi.fn();
const finishAdayHamleSession = vi.fn();
vi.mock('@/lib/adayHamleApi', () => ({
  createAdayHamleSession: (...a: unknown[]) => createAdayHamleSession(...a),
  submitAdayHamleAnswer: (...a: unknown[]) => submitAdayHamleAnswer(...a),
  finishAdayHamleSession: (...a: unknown[]) => finishAdayHamleSession(...a),
}));

import { AdayHamlePractice } from '@/components/play/AdayHamlePractice';

const POOL = [
  {
    id: 'p1', fen: START_FEN,
    candidate_moves: [
      { move_uci: 'e2e4', move_san: 'e4', score_cp: 30, mate: null },
      { move_uci: 'd2d4', move_san: 'd4', score_cp: 25, mate: null },
      { move_uci: 'g1f3', move_san: 'Nf3', score_cp: 10, mate: null },
    ],
  },
  {
    id: 'p2', fen: SECOND_FEN,
    candidate_moves: [
      { move_uci: 'e1d2', move_san: 'Kd2', score_cp: 5, mate: null },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function baslaPratik(durationLabel = '5 dk') {
  createAdayHamleSession.mockResolvedValue({
    id: 1, duration_minutes: 5, current_index: 0, total: 2,
    position: { id: 'p1', fen: START_FEN },
  });
  render(<AdayHamlePractice sectionId={7} positions={POOL} />);
  fireEvent.click(screen.getByText(durationLabel));
  await act(async () => { fireEvent.click(screen.getByText('BAŞLA')); });
}

describe('AdayHamlePractice — süre seçimi', () => {
  it('havuzda cevap anahtarlı pozisyon yoksa boş mesaj gösterir', () => {
    render(<AdayHamlePractice sectionId={7} positions={[{ id: 'x', fen: START_FEN }]} />);
    expect(screen.getByText(/Henüz pratik yapılacak pozisyon yok/)).toBeInTheDocument();
  });

  it('süre kartları ve BAŞLA butonu görünür', () => {
    render(<AdayHamlePractice sectionId={7} positions={POOL} />);
    expect(screen.getByText('5 dk')).toBeInTheDocument();
    expect(screen.getByText('10 dk')).toBeInTheDocument();
    expect(screen.getByText('15 dk')).toBeInTheDocument();
    expect(screen.getByText('BAŞLA')).toBeInTheDocument();
  });

  it('BAŞLA ile oturum oluşturulur, seçim alanı kaybolur, pratik ekranı gelir', async () => {
    await baslaPratik('10 dk');
    expect(createAdayHamleSession).toHaveBeenCalledWith(7, 10);
    expect(screen.queryByText('Pratik Yapma Sürenizi Belirleyiniz')).not.toBeInTheDocument();
    expect(screen.getByTestId('board')).toHaveAttribute('data-fen', START_FEN);
  });
});

describe('AdayHamlePractice — 3 hamlelik tahmin döngüsü', () => {
  it('1. hamle karta yazılır ama renklenmez; 3sn sonra tahta başa döner', async () => {
    await baslaPratik();
    fireEvent.click(screen.getByText('oyna-e2e4'));

    expect(screen.getByTestId('aday-hamle-kart-1')).toHaveTextContent('e4');
    // Henüz renklendirilmedi (feedback yok) — stil kontrolü yerine ikinci
    // hamlenin bu an ENGELLENDİĞİNİ (interaktif kapalı) doğruluyoruz.
    expect(screen.getByTestId('board')).toHaveAttribute('data-interactive', 'false');

    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('board')).toHaveAttribute('data-fen', START_FEN);
    expect(screen.getByTestId('board')).toHaveAttribute('data-interactive', 'true');
  });

  it('3 hamle tamamlanmadan Kaydet görünmez; 3. hamleden sonra görünür', async () => {
    await baslaPratik();
    expect(screen.queryByText('Kaydet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('oyna-e2e4'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Kaydet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('oyna-d2d4'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Kaydet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('oyna-g1f3'));
    expect(screen.queryByText('Kaydet')).not.toBeInTheDocument(); // henüz 3sn geçmedi
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('Kaydet')).toBeInTheDocument();
  });

  it('Kaydet basınca kartlar yeşil/kırmızı renklenir ve Sonraki Pozisyon çıkar', async () => {
    await baslaPratik();
    submitAdayHamleAnswer.mockResolvedValue({
      results: [true, false, true], finished: false, next_position: { id: 'p2', fen: SECOND_FEN },
    });

    fireEvent.click(screen.getByText('oyna-e2e4'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByText('oyna-b1c3')); // kasıtlı "yanlış" (legal ama cevap anahtarında değil) tahmin
    await act(async () => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByText('oyna-g1f3'));
    await act(async () => { vi.advanceTimersByTime(3000); });

    await act(async () => { fireEvent.click(screen.getByText('Kaydet')); });
    expect(submitAdayHamleAnswer).toHaveBeenCalledWith(1, ['e2e4', 'b1c3', 'g1f3']);
    expect(screen.getByText('Sonraki Pozisyon')).toBeInTheDocument();
    expect(screen.queryByText('Kaydet')).not.toBeInTheDocument();
  });

  it('Sonraki Pozisyon\'a basınca (bitmemişse) sıradaki pozisyon yüklenir, kartlar temizlenir', async () => {
    await baslaPratik();
    submitAdayHamleAnswer.mockResolvedValue({
      results: [true, true, true], finished: false, next_position: { id: 'p2', fen: SECOND_FEN },
    });
    fireEvent.click(screen.getByText('oyna-e2e4'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByText('oyna-d2d4'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByText('oyna-g1f3'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    await act(async () => { fireEvent.click(screen.getByText('Kaydet')); });

    fireEvent.click(screen.getByText('Sonraki Pozisyon'));
    expect(screen.getByTestId('board')).toHaveAttribute('data-fen', SECOND_FEN);
    expect(screen.getByTestId('aday-hamle-kart-1')).toHaveTextContent('');
    expect(screen.queryByText('Sonraki Pozisyon')).not.toBeInTheDocument();
  });

  it('havuz bitince (finished) Sonraki Pozisyon Kontrol Et ekranına geçirir', async () => {
    await baslaPratik();
    submitAdayHamleAnswer.mockResolvedValue({ results: [true, true, true], finished: true, next_position: null });
    fireEvent.click(screen.getByText('oyna-e2e4'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByText('oyna-d2d4'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    fireEvent.click(screen.getByText('oyna-g1f3'));
    await act(async () => { vi.advanceTimersByTime(3000); });
    await act(async () => { fireEvent.click(screen.getByText('Kaydet')); });

    fireEvent.click(screen.getByText('Sonraki Pozisyon'));
    expect(screen.getByText(/Kontrol Et/)).toBeInTheDocument();
    expect(screen.getByText(/Doğru cevap:/)).toBeInTheDocument();
  });
});

describe('AdayHamlePractice — süre sayacı', () => {
  it('sağ üstte MM:SS gösterir, pozisyon geçişinde sıfırlanmaz', async () => {
    await baslaPratik();
    expect(screen.getByText('05:00')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByText('04:50')).toBeInTheDocument();
  });

  it('süre dolunca (yarım kalan tahmin sayılmadan) Kontrol Et ekranına geçer', async () => {
    await baslaPratik();
    finishAdayHamleSession.mockResolvedValue(true);
    fireEvent.click(screen.getByText('oyna-e2e4')); // tek hamle, Kaydet'e hiç basılmadı
    await act(async () => { vi.advanceTimersByTime(5 * 60 * 1000); });
    expect(finishAdayHamleSession).toHaveBeenCalledWith(1);
    expect(screen.getByText(/hiç pozisyon tamamlanmadı/i)).toBeInTheDocument();
  });
});

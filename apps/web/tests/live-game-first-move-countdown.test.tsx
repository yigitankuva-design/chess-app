import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

let handler: ((d: unknown) => void) | null = null;

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (_url: string | null, onMessage: (d: unknown) => void) => {
    handler = onMessage;
    return { send: vi.fn(), readyState: 1 };
  },
  wsBase: () => 'ws://test',
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { LiveGame } from '@/components/LiveGame';

function setup() {
  handler = null;
  return render(<LiveGame gameId={1} myColor="white" />);
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('LiveGame — ilk hamle 15sn geri sayımı (madde 4)', () => {
  it('mac hic hamlesiz basladiginda tahtanin ustunde geri sayim gorunur', () => {
    setup();
    act(() => handler!({ type: 'game_info', moves: [], status: 'active' }));
    expect(screen.getByText(/İlk hamle: 15sn/)).toBeInTheDocument();
  });

  it('macta zaten hamle varsa (yeniden baglanma) geri sayim GORUNMEZ', () => {
    setup();
    act(() => handler!({ type: 'game_info', moves: ['e4'], status: 'active' }));
    expect(screen.queryByText(/İlk hamle:/)).not.toBeInTheDocument();
  });

  it('her saniye geri sayim bir azalir', () => {
    setup();
    act(() => handler!({ type: 'game_info', moves: [], status: 'active' }));
    expect(screen.getByText(/İlk hamle: 15sn/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText(/İlk hamle: 14sn/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText(/İlk hamle: 11sn/)).toBeInTheDocument();
  });

  it('ilk hamle gelince (move_made) geri sayim hemen kaybolur', () => {
    setup();
    act(() => handler!({ type: 'game_info', moves: [], status: 'active' }));
    expect(screen.getByText(/İlk hamle: 15sn/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    // fen_after BAŞLANGIÇ konumuyla AYNI verilir: react-chessboard'un jsdom'da
    // FEN değişiminde tahtayı yeniden ölçmesi (kütüphanenin kendi sınırı,
    // hiçbir mevcut testte de denenmemiş) bu testin konusu DEĞİL — burada
    // yalnız geri sayımın move_made'de temizlendiği izole test ediliyor.
    act(() => handler!({
      type: 'move_made', san: 'e4',
      fen_after: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    }));
    expect(screen.queryByText(/İlk hamle:/)).not.toBeInTheDocument();
  });

  it('sunucudan game_aborted gelince mac biter ve iptal mesaji gosterilir, geri sayim kaybolur', () => {
    setup();
    act(() => handler!({ type: 'game_info', moves: [], status: 'active' }));
    act(() => handler!({ type: 'game_aborted', reason: 'first_move_timeout' }));

    expect(screen.queryByText(/İlk hamle:.*sn/)).not.toBeInTheDocument();
    expect(screen.getByText(/İlk hamle 15 saniye içinde yapılmadığı için maç iptal edildi/))
      .toBeInTheDocument();
    // Mac bitti — Terk Et artik devre disi.
    expect(screen.getByRole('button', { name: 'Terk Et' })).toBeDisabled();
  });

  it('iptal edilmis maca SONRADAN baglanan sporcu da (game_aborted mesajini kacirsa bile) nedeni gorur', () => {
    setup();
    // game_aborted YAYINI KAÇIRILDI — dogrudan aborted status'lu game_info geldi.
    act(() => handler!({ type: 'game_info', moves: [], status: 'aborted' }));
    expect(screen.getByText(/İlk hamle 15 saniye içinde yapılmadığı için maç iptal edildi/))
      .toBeInTheDocument();
  });

  it('geri sayim 0da durur, negatife inmez', () => {
    setup();
    act(() => handler!({ type: 'game_info', moves: [], status: 'active' }));
    act(() => { vi.advanceTimersByTime(20000); });
    expect(screen.getByText(/İlk hamle: 0sn/)).toBeInTheDocument();
  });
});

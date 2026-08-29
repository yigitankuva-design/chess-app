import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const sent: object[] = [];
let handler: ((d: unknown) => void) | null = null;
const push = vi.fn();

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (_url: string | null, onMessage: (d: unknown) => void) => {
    handler = onMessage;
    return { send: (d: object) => { sent.push(d); }, readyState: 1 };
  },
  wsBase: () => 'ws://test',
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { LiveGame } from '@/components/LiveGame';

function setup(tournamentId?: number) {
  sent.length = 0;
  handler = null;
  push.mockReset();
  return render(<LiveGame gameId={1} myColor="white" tournamentId={tournamentId} />);
}

describe('LiveGame — turnuva maçı (madde 2026-09-09, 1/2/3)', () => {
  describe('madde 3: "Tekrar Oyna" yerine "Turnuvaya Geri Dön"', () => {
    it('tournamentId verilince kart "Turnuvaya Geri Dön" olur, "Tekrar Oyna" YOKTUR', () => {
      setup(7);
      expect(screen.getByRole('button', { name: 'Turnuvaya Geri Dön' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tekrar Oyna' })).not.toBeInTheDocument();
    });

    it('mac surerken de kart gorunur ama devre disidir (Tekrar Oyna ile AYNI davranis)', () => {
      setup(7);
      expect(screen.getByRole('button', { name: 'Turnuvaya Geri Dön' })).toBeDisabled();
    });

    it('mac bitince tiklaninca DOGRUDAN turnuva sayfasina doner, WS mesaji GONDERMEZ', () => {
      setup(7);
      act(() => handler!({ type: 'game_over', result: '1-0' }));
      const btn = screen.getByRole('button', { name: 'Turnuvaya Geri Dön' });
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
      expect(push).toHaveBeenCalledWith('/play/tournament/7');
      expect(sent).toEqual([]);
    });

    it('tournamentId verilmeyince eski "Tekrar Oyna" davranisi AYNEN kalir', () => {
      setup(undefined);
      expect(screen.getByRole('button', { name: 'Tekrar Oyna' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Turnuvaya Geri Dön' })).not.toBeInTheDocument();
    });
  });

  describe('madde 2: maç iptal olunca (game_aborted) otomatik turnuva sayfasına döner', () => {
    it('tournamentId verilmisse game_aborted gelince /play/tournament/{id}\'e yönlendirir', () => {
      setup(7);
      act(() => handler!({ type: 'game_info', moves: [], status: 'active' }));
      act(() => handler!({ type: 'game_aborted', reason: 'first_move_timeout' }));
      expect(push).toHaveBeenCalledWith('/play/tournament/7');
    });

    it('turnuva suresi dolup iptal olduysa da (reason=tournament_ended) AYNI sekilde doner', () => {
      setup(7);
      act(() => handler!({ type: 'game_info', moves: [], status: 'active' }));
      act(() => handler!({ type: 'game_aborted', reason: 'tournament_ended' }));
      expect(push).toHaveBeenCalledWith('/play/tournament/7');
    });

    it('tournamentId YOKSA game_aborted otomatik yönlendirme YAPMAZ (regresyon)', () => {
      setup(undefined);
      act(() => handler!({ type: 'game_info', moves: [], status: 'active' }));
      act(() => handler!({ type: 'game_aborted', reason: 'first_move_timeout' }));
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe('madde 1: ilk hamle bekleme penceresinde saat YEREL de azalmaz', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('geri sayım sürerken saat kutuları sabit kalır, ilk hamleden sonra normal işler', () => {
      setup(7);
      act(() => handler!({
        type: 'game_info', moves: [], status: 'active',
        white_ms: 300_000, black_ms: 300_000, white_to_move: true,
      }));
      expect(screen.getAllByText('05:00')).toHaveLength(2); // beyaz + siyah kutusu

      // 15sn'lik geri sayım sürerken (madde 1/4) yerel saat İLERLEMEMELİ.
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getAllByText('05:00')).toHaveLength(2);

      // İlk hamle gelir — geri sayım kapanır; sunucu 'clock' ile sırayı bildirir.
      // fen_after BAŞLANGIÇ konumuyla AYNI verilir (bkz. live-game-first-move-
      // countdown.test.tsx'teki AYNI yorum) — react-chessboard'un jsdom'da FEN
      // değişiminde tahtayı yeniden ölçmesi bu testin konusu DEĞİL, sadece saat.
      act(() => handler!({
        type: 'move_made', san: 'e4',
        fen_after: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      }));
      act(() => handler!({ type: 'clock', white_ms: 300_000, black_ms: 300_000, white_to_move: false }));
      act(() => { vi.advanceTimersByTime(1000); });
      // Artık sıra rakipte (siyah, üstte) — onun saati düşmeli, benimki (beyaz) sabit kalır.
      expect(screen.getAllByText('05:00')).toHaveLength(1);
    });
  });
});

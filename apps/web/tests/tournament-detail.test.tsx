import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

let wsHandler: ((d: unknown) => void) | null = null;
let lastWsUrl: string | null = null;
vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (url: string | null, onMessage: (d: unknown) => void) => {
    lastWsUrl = url;
    wsHandler = url ? onMessage : null;
    return { send: vi.fn(), readyState: url ? 1 : 3 };
  },
  wsBase: () => 'ws://test',
}));

import { TournamentDetailView } from '@/components/play/TournamentDetailView';

function mockFetchOnce(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

function standingRow(overrides: Record<string, unknown> = {}) {
  return { child_id: 1, display_name: 'Ali', score: 4, sb: 2.5, streak: 2, rating: null, title: null, ...overrides };
}

function baseDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, name: 'Yaz Turnuvası',
    starts_at: new Date().toISOString(), duration_minutes: 60,
    ends_at: new Date().toISOString(), seconds_remaining: 1800,
    base_ms: 300000, increment_ms: 0, status: 'active', joined: true, rated: false, tempo: null,
    description: null, start_fen: null, winning_streak_bonus: true, participant_count: 1,
    standings: [standingRow()],
    my_pairing: null,
    recent_pairings: [],
    ...overrides,
  };
}

async function renderPage(detail: unknown) {
  global.fetch = vi.fn().mockResolvedValue(mockFetchOnce(detail));
  const utils = render(<TournamentDetailView tournamentId={1} />);
  await waitFor(() => expect(screen.queryByText('Yükleniyor...')).not.toBeInTheDocument());
  return utils;
}

describe('Canlı turnuva sayfası — /play/tournament/[id]', () => {
  beforeEach(() => { push.mockClear(); wsHandler = null; lastWsUrl = null; });

  it('katılmamış sporcuya "KATIL" butonu gösterir, kuyruğa bağlanmaz', async () => {
    await renderPage(baseDetail({ joined: false }));
    expect(screen.getByRole('button', { name: 'KATIL' })).toBeInTheDocument();
    expect(lastWsUrl).toBeNull();
  });

  it('katılmış ve aktif ama eşleşmesi yoksa kuyruğa bağlanır ve durum şeridi "Hazır Ol! Eşleşme Yapılıyor" gösterir', async () => {
    await renderPage(baseDetail({ joined: true, my_pairing: null }));
    expect(lastWsUrl).toContain('/ws/tournament/1/queue');
    expect(screen.getByText(/Hazır Ol! Eşleşme Yapılıyor/)).toBeInTheDocument();
  });

  it('WS "matched" mesajı gelince /play/online/{gameId}\'e yönlendirir', async () => {
    await renderPage(baseDetail({ joined: true, my_pairing: null }));
    act(() => wsHandler!({ type: 'matched', game_id: 55, color: 'black' }));
    expect(push).toHaveBeenCalledWith('/play/online/55?color=black');
  });

  it('zaten aktif bir eşleşmesi varsa kuyruğa GİRMEZ, "Maça Devam Et" gösterir', async () => {
    await renderPage(baseDetail({
      joined: true,
      my_pairing: { id: 9, opponent_id: 2, opponent_name: 'Ayşe', my_color: 'white', game_id: 77 },
    }));
    expect(lastWsUrl).toBeNull();
    expect(screen.getByText(/Ayşe/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Maça Devam Et' }));
    expect(push).toHaveBeenCalledWith('/play/online/77?color=white');
  });

  it('sıralamada 2+ galibiyet serisi 🔥 ile gösterilir', async () => {
    await renderPage(baseDetail());
    expect(screen.getByText(/🔥/)).toBeInTheDocument();
  });

  it('"Galibiyet Ödülü" kapalıysa (winning_streak_bonus=false) 🔥 gösterilmez', async () => {
    await renderPage(baseDetail({ winning_streak_bonus: false }));
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
  });

  it('turnuva silinince lobiye yönlendirir', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchOnce(baseDetail()))
      .mockResolvedValueOnce(mockFetchOnce({ deleted: true }));
    global.fetch = fetchMock;
    render(<TournamentDetailView tournamentId={1} />);
    await waitFor(() => screen.getByRole('button', { name: 'Turnuvayı Sil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turnuvayı Sil' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/play/tournament/lobby'));
  });

  describe('Madde 2026-09-09 (5): KATIL/ÇEKİL ve sayfalanan sıralama', () => {
    it('katılan sporcuya "ÇEKİL" gösterilir, tıklayınca turnuvadan çıkar', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchOnce(baseDetail({ joined: true })))
        .mockResolvedValueOnce(mockFetchOnce({ joined: false }))
        .mockResolvedValueOnce(mockFetchOnce(baseDetail({ joined: false })));
      global.fetch = fetchMock;
      render(<TournamentDetailView tournamentId={1} />);
      await waitFor(() => screen.getByRole('button', { name: 'ÇEKİL' }));
      fireEvent.click(screen.getByRole('button', { name: 'ÇEKİL' }));
      await waitFor(() => expect(fetchMock.mock.calls[1][0]).toContain('/tournaments/1/leave'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'KATIL' })).toBeInTheDocument());
    });

    it('katılımcı listesi 20\'den fazlaysa sayfalanır, gezinme düğmeleri çalışır', async () => {
      const standings = Array.from({ length: 25 }, (_, i) =>
        standingRow({ child_id: i + 1, display_name: `Sporcu${i + 1}`, score: 25 - i, streak: 0 }));
      await renderPage(baseDetail({ standings, participant_count: 25 }));

      expect(screen.getByText('1/2 - 25 Kişi')).toBeInTheDocument();
      expect(screen.getByText('Sporcu1')).toBeInTheDocument();
      expect(screen.queryByText('Sporcu21')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Önceki sayfa' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'İlk sayfa' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Sonraki sayfa' }));
      expect(screen.getByText('2/2 - 25 Kişi')).toBeInTheDocument();
      expect(screen.getByText('Sporcu21')).toBeInTheDocument();
      expect(screen.queryByText('Sporcu1')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sonraki sayfa' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Son sayfa' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'İlk sayfa' }));
      expect(screen.getByText('1/2 - 25 Kişi')).toBeInTheDocument();
    });

    it('20 veya daha az katılımcıda sayfalama tek sayfa gösterir, düğmeler pasif', async () => {
      await renderPage(baseDetail());
      expect(screen.getByText('1/1 - 1 Kişi')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sonraki sayfa' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Son sayfa' })).toBeDisabled();
    });
  });
});

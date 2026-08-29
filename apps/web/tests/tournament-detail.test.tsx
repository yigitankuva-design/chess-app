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
  return {
    child_id: 1, display_name: 'Ali', score: 4, sb: 2.5, streak: 2, rating: null, title: null,
    games_played: 5, win_rate: 60,
    ...overrides,
  };
}

function baseDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, name: 'Yaz Turnuvası',
    starts_at: new Date().toISOString(), duration_minutes: 60,
    ends_at: new Date().toISOString(), seconds_remaining: 1800,
    base_ms: 300000, increment_ms: 0, status: 'active', joined: true, rated: false, tempo: null,
    description: null, start_fen: null, winning_streak_bonus: true, participant_count: 1,
    can_delete: true,
    // Madde 2026-09-10 (Turnuva Türü / Berserk): varsayılan Arena.
    tournament_type: 'arena', rounds_total: null, current_round: null, berserk_enabled: false,
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

  it('WS "matched" mesajı gelince /play/online/{gameId}\'e tournamentId ile yönlendirir', async () => {
    await renderPage(baseDetail({ joined: true, my_pairing: null }));
    act(() => wsHandler!({ type: 'matched', game_id: 55, color: 'black' }));
    expect(push).toHaveBeenCalledWith('/play/online/55?color=black&tournamentId=1&berserk=0');
  });

  it('zaten aktif bir eşleşmesi varsa kuyruğa GİRMEZ, "Maça Devam Et" gösterir', async () => {
    await renderPage(baseDetail({
      joined: true,
      my_pairing: { id: 9, opponent_id: 2, opponent_name: 'Ayşe', my_color: 'white', game_id: 77 },
    }));
    expect(lastWsUrl).toBeNull();
    expect(screen.getByText(/Ayşe/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Maça Devam Et' }));
    expect(push).toHaveBeenCalledWith('/play/online/77?color=white&tournamentId=1&berserk=0');
  });

  it('Madde 2026-09-10: arena + berserk_enabled + Hızlı tempoda berserk=1 taşınır', async () => {
    await renderPage(baseDetail({
      joined: true, berserk_enabled: true, tempo: 'Hızlı',
      my_pairing: { id: 9, opponent_id: 2, opponent_name: 'Ayşe', my_color: 'white', game_id: 77 },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Maça Devam Et' }));
    expect(push).toHaveBeenCalledWith('/play/online/77?color=white&tournamentId=1&berserk=1');
  });

  it('Klasik tempoda berserk_enabled=true olsa bile berserk=0 taşınır', async () => {
    await renderPage(baseDetail({
      joined: true, berserk_enabled: true, tempo: 'Klasik',
      my_pairing: { id: 9, opponent_id: 2, opponent_name: 'Ayşe', my_color: 'white', game_id: 77 },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Maça Devam Et' }));
    expect(push).toHaveBeenCalledWith('/play/online/77?color=white&tournamentId=1&berserk=0');
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

  describe('Madde 2026-09-09 (4): "Turnuvayı Sil" sadece oluşturana ve başlamadan önce', () => {
    it('can_delete=false ise "Turnuvayı Sil" HİÇ gösterilmez', async () => {
      await renderPage(baseDetail({ can_delete: false }));
      expect(screen.queryByRole('button', { name: 'Turnuvayı Sil' })).not.toBeInTheDocument();
    });

    it('can_delete=true ise gösterilir (regresyon)', async () => {
      await renderPage(baseDetail({ can_delete: true }));
      expect(screen.getByRole('button', { name: 'Turnuvayı Sil' })).toBeInTheDocument();
    });
  });

  describe('Madde 2026-09-09 (6): turnuva bitiş bildirimi (podyum)', () => {
    it('aktiften bitmişe GEÇİŞTE ilk 3\'ün bilgileriyle bildirim açılır, "Kapat" kapatır', async () => {
      const standings = [
        standingRow({ child_id: 1, display_name: 'Bir', score: 10, rating: 2607, title: 'NM', games_played: 15, win_rate: 93 }),
        standingRow({ child_id: 2, display_name: 'İki', score: 8, rating: 2770, title: 'CM', games_played: 14, win_rate: 87 }),
        standingRow({ child_id: 3, display_name: 'Üç', score: 6, rating: 2611, title: null, games_played: 13, win_rate: 92 }),
      ];
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockFetchOnce(baseDetail({ status: 'active', standings })))
        .mockResolvedValueOnce(mockFetchOnce(baseDetail({ status: 'finished', standings })));
      global.fetch = fetchMock;

      vi.useFakeTimers();
      try {
        render(<TournamentDetailView tournamentId={1} />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // ilk yükleme (active)
        expect(screen.getByText(/Yaz Turnuvası/)).toBeInTheDocument();
        expect(screen.queryByText(/Tamamlanmıştır/)).not.toBeInTheDocument();

        // 10sn'lik periyodik yenileme — ikinci fetch "finished" döner, GEÇİŞ tetiklenir.
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(screen.getByText('Yaz Turnuvası Tamamlanmıştır.')).toBeInTheDocument();
        expect(screen.getByText('Performans 2607')).toBeInTheDocument();
        expect(screen.getByText('Oynanmış oyunlar 15')).toBeInTheDocument();
        expect(screen.getByText('Kazanma oranı 93%')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
        expect(screen.queryByText(/Tamamlanmıştır/)).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('turnuva İLK AÇILIŞTA zaten bitmişse bildirim OTOMATİK açılmaz (geçiş yok)', async () => {
      await renderPage(baseDetail({ status: 'finished' }));
      expect(screen.queryByText(/Tamamlanmıştır/)).not.toBeInTheDocument();
    });
  });

  describe('Madde 2026-09-10: İsviçre turnuvası görünümü', () => {
    it('katılmış + eşleşmesi yoksa "Tur N/Toplam bitmesi bekleniyor" gösterir, kuyruğa BAĞLANMAZ', async () => {
      await renderPage(baseDetail({
        tournament_type: 'swiss', rounds_total: 4, current_round: 2,
        joined: true, my_pairing: null,
      }));
      expect(screen.getByText(/Tur 2\/4 bitmesi bekleniyor\./)).toBeInTheDocument();
      expect(lastWsUrl).toBeNull();
    });

    it('footer\'da "Kalan Süre" yerine "Tur N/Toplam" gösterilir', async () => {
      await renderPage(baseDetail({
        tournament_type: 'swiss', rounds_total: 4, current_round: 2, joined: true, my_pairing: null,
      }));
      expect(screen.getByText('Tur 2/4')).toBeInTheDocument();
    });

    it('1. tur başladıktan sonra katılmamış sporcuya KATIL butonu GÖSTERİLMEZ', async () => {
      await renderPage(baseDetail({
        tournament_type: 'swiss', rounds_total: 4, current_round: 1, joined: false,
      }));
      expect(screen.queryByRole('button', { name: 'KATIL' })).not.toBeInTheDocument();
      expect(screen.getByText(/Turnuva başladı, katılım kapandı\./)).toBeInTheDocument();
    });

    it('henüz 1. tur başlamadıysa (current_round=0) katılmamış sporcuya KATIL gösterilir', async () => {
      await renderPage(baseDetail({
        tournament_type: 'swiss', rounds_total: 4, current_round: 0, joined: false, status: 'upcoming',
      }));
      expect(screen.getByRole('button', { name: 'KATIL' })).toBeInTheDocument();
    });

    it('eşleşmesi varsa Arena\'dakiyle AYNI şekilde "Maça Devam Et" gösterir', async () => {
      await renderPage(baseDetail({
        tournament_type: 'swiss', rounds_total: 4, current_round: 1, joined: true,
        my_pairing: { id: 9, opponent_id: 2, opponent_name: 'Ayşe', my_color: 'white', game_id: 77 },
      }));
      expect(lastWsUrl).toBeNull();
      expect(screen.getByRole('button', { name: 'Maça Devam Et' })).toBeInTheDocument();
    });
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

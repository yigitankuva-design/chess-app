import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/lib/settings/settings-context', async () => {
  const { TIME_GROUPS } = await vi.importActual<typeof import('@/lib/play/levels')>('@/lib/play/levels');
  return {
    useSettings: () => ({
      settings: {
        play: {
          timeGroups: TIME_GROUPS,
          tournamentDefaults: { durationMinutes: 60, timeControlLabel: '10+0', rated: true },
        },
      },
    }),
  };
});

import TournamentCreatePage from '@/app/(child)/play/tournament/create/page';

function mockFetchOnce(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

describe('Turnuva Oluştur — /play/tournament/create', () => {
  beforeEach(() => { push.mockClear(); });

  it('8 kutu (Zafer\'in görseline göre 5 satır) da render edilir', () => {
    render(<TournamentCreatePage />);
    expect(screen.getByLabelText('Turnuva ismi')).toBeInTheDocument();
    expect(screen.getByLabelText('Turnuva süresi')).toBeInTheDocument();
    expect(screen.getByLabelText('Başlangıç tarihi')).toBeInTheDocument();
    expect(screen.getByLabelText('Başlangıç saati')).toBeInTheDocument();
    expect(screen.getByLabelText('Turnuva ile ilgili açıklama')).toBeInTheDocument();
    expect(screen.getByLabelText('Maç başı süre')).toBeInTheDocument();
    expect(screen.getByLabelText('Başlangıç konumu')).toBeInTheDocument();
    expect(screen.getByLabelText('Puan durumu')).toBeInTheDocument();
    expect(screen.getByLabelText('Galibiyet ödülü')).toBeInTheDocument();
    // Madde 2026-09-10: yeni 2 kart.
    expect(screen.getByLabelText('Turnuva türü')).toBeInTheDocument();
    expect(screen.getByLabelText('Berserk')).toBeInTheDocument();
  });

  it('admin varsayılanları baştan seçili gelir (60 dk, 10+0, Puanlı, Ödül Olsun)', () => {
    render(<TournamentCreatePage />);
    expect(screen.getByLabelText('Turnuva süresi')).toHaveValue('60');
    expect(screen.getByLabelText('Maç başı süre')).toHaveValue('10+0');
    expect(screen.getByLabelText('Puan durumu')).toHaveValue('rated');
    expect(screen.getByLabelText('Galibiyet ödülü')).toHaveValue('on');
  });

  it('süre dropdown\'ında Zafer\'in verdiği tam liste bulunur (20..720)', () => {
    render(<TournamentCreatePage />);
    const select = screen.getByLabelText('Turnuva süresi') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual([
      '20', '25', '30', '35', '40', '45', '50', '55', '60', '70', '80', '90',
      '100', '110', '120', '150', '180', '210', '240', '270', '300', '330',
      '360', '420', '480', '540', '600', '660', '720',
    ]);
  });

  it('ad girilmeden Oluştur butonu pasiftir', () => {
    render(<TournamentCreatePage />);
    expect(screen.getByRole('button', { name: /Turnuvayı Oluştur/ })).toBeDisabled();
  });

  it('kriterler seçilip oluşturulunca POST /tournaments\'a TÜM alanları gönderir ve turnuva sayfasına yönlendirir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchOnce({ id: 42, name: 'Test Turnuvası' }));
    global.fetch = fetchMock;
    render(<TournamentCreatePage />);

    fireEvent.change(screen.getByLabelText('Turnuva ismi'), { target: { value: 'Test Turnuvası' } });
    fireEvent.change(screen.getByLabelText('Turnuva süresi'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Başlangıç tarihi'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Başlangıç saati'), { target: { value: '14:30' } });
    fireEvent.change(screen.getByLabelText('Turnuva ile ilgili açıklama'), { target: { value: 'Açıklama metni' } });
    fireEvent.change(screen.getByLabelText('Başlangıç konumu'), {
      target: { value: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
    });
    fireEvent.change(screen.getByLabelText('Puan durumu'), { target: { value: 'unrated' } });
    fireEvent.change(screen.getByLabelText('Galibiyet ödülü'), { target: { value: 'off' } });

    fireEvent.click(screen.getByRole('button', { name: /Turnuvayı Oluştur/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain('/tournaments');
    const body = JSON.parse(call[1].body as string);
    expect(body.name).toBe('Test Turnuvası');
    expect(body.duration_minutes).toBe(30);
    expect(body.starts_at).toBe(new Date('2026-10-05T14:30').toISOString());
    expect(body.description).toBe('Açıklama metni');
    expect(body.start_fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(body.rated).toBe(false);
    expect(body.winning_streak_bonus).toBe(false);
    // Madde 2026-09-10: varsayılan Arena, İsviçre alanları null, berserk kapalı.
    expect(body.tournament_type).toBe('arena');
    expect(body.rounds_total).toBeNull();
    expect(body.berserk_enabled).toBe(false);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/play/tournament/42'));
  });

  it('açıklama/başlangıç konumu boş bırakılırsa null gönderilir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchOnce({ id: 43, name: 'X' }));
    global.fetch = fetchMock;
    render(<TournamentCreatePage />);
    fireEvent.change(screen.getByLabelText('Turnuva ismi'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /Turnuvayı Oluştur/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.description).toBeNull();
    expect(body.start_fen).toBeNull();
  });

  it('başarısız olunca SUNUCUNUN gerçek hata mesajını gösterir (genel "oluşturulamadı" değil)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockFetchOnce({ detail: 'Bir hocaya bağlı değilsin' }, false),
    );
    render(<TournamentCreatePage />);
    fireEvent.change(screen.getByLabelText('Turnuva ismi'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /Turnuvayı Oluştur/ }));
    await waitFor(() => expect(screen.getByText('Bir hocaya bağlı değilsin')).toBeInTheDocument());
  });

  it('422 doğrulama hatasında pydantic mesajını gösterir', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockFetchOnce({ detail: [{ msg: 'Value error, geçersiz tarih' }] }, false),
    );
    render(<TournamentCreatePage />);
    fireEvent.change(screen.getByLabelText('Turnuva ismi'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /Turnuvayı Oluştur/ }));
    await waitFor(() => expect(screen.getByText('Value error, geçersiz tarih')).toBeInTheDocument());
  });

  describe('Madde 2026-09-10: Turnuva Türü (Arena/İsviçre) + Berserk', () => {
    it('İsviçre seçilince "Turnuva süresi" yerine "Tur sayısı" gelir, Berserk kartı kaybolur', () => {
      render(<TournamentCreatePage />);
      fireEvent.change(screen.getByLabelText('Turnuva türü'), { target: { value: 'swiss' } });
      expect(screen.queryByLabelText('Turnuva süresi')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Tur sayısı')).toBeInTheDocument();
      expect(screen.queryByLabelText('Berserk')).not.toBeInTheDocument();
    });

    it('Tur sayısı dropdown\'ında 2-15 arası bulunur', () => {
      render(<TournamentCreatePage />);
      fireEvent.change(screen.getByLabelText('Turnuva türü'), { target: { value: 'swiss' } });
      const select = screen.getByLabelText('Tur sayısı') as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']);
    });

    it('Klasik tempo seçilince (Arena kalsa bile) Berserk kartı kaybolur', () => {
      render(<TournamentCreatePage />);
      fireEvent.change(screen.getByLabelText('Maç başı süre'), { target: { value: '30+0' } });
      expect(screen.queryByLabelText('Berserk')).not.toBeInTheDocument();
    });

    it('İsviçre turnuvası oluşturulunca duration_minutes null, rounds_total ve tournament_type doğru gönderilir', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockFetchOnce({ id: 44, name: 'İsviçre' }));
      global.fetch = fetchMock;
      render(<TournamentCreatePage />);
      fireEvent.change(screen.getByLabelText('Turnuva ismi'), { target: { value: 'İsviçre' } });
      fireEvent.change(screen.getByLabelText('Turnuva türü'), { target: { value: 'swiss' } });
      fireEvent.change(screen.getByLabelText('Tur sayısı'), { target: { value: '7' } });
      fireEvent.click(screen.getByRole('button', { name: /Turnuvayı Oluştur/ }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.tournament_type).toBe('swiss');
      expect(body.rounds_total).toBe(7);
      expect(body.duration_minutes).toBeNull();
      expect(body.berserk_enabled).toBe(false);
    });

    it('Berserk "Olsun" seçilince payload\'da berserk_enabled=true gönderilir', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockFetchOnce({ id: 45, name: 'Berserkli' }));
      global.fetch = fetchMock;
      render(<TournamentCreatePage />);
      fireEvent.change(screen.getByLabelText('Turnuva ismi'), { target: { value: 'Berserkli' } });
      fireEvent.change(screen.getByLabelText('Berserk'), { target: { value: 'on' } });
      fireEvent.click(screen.getByRole('button', { name: /Turnuvayı Oluştur/ }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(body.berserk_enabled).toBe(true);
    });
  });
});

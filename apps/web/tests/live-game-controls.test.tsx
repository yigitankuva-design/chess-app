import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const sent: object[] = [];
let handler: ((d: unknown) => void) | null = null;

vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (_url: string | null, onMessage: (d: unknown) => void) => {
    handler = onMessage;
    return { send: (d: object) => { sent.push(d); }, readyState: 1 };
  },
  wsBase: () => 'ws://test',
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { LiveGame } from '@/components/LiveGame';

function setup() {
  sent.length = 0;
  handler = null;
  return render(<LiveGame gameId={1} myColor="white" />);
}

describe('LiveGame — Terk Et', () => {
  it('buton metni "Terk Et"tir (kullanıcının kelimesi)', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Teslim ol/ })).not.toBeInTheDocument();
  });

  it('onaylanınca resign mesajı gönderir', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Terk Et' }));
    expect(sent).toContainEqual({ type: 'resign' });
  });
});

describe('LiveGame — sonuç bildirimi formatı (madde c)', () => {
  it('beyaz kazandığında "1 – 0 (Beyaz Kazandı)" gösterir', () => {
    setup();
    act(() => handler!({ type: 'game_over', result: '1-0' }));
    expect(screen.getByText('1 – 0 (Beyaz Kazandı)')).toBeInTheDocument();
  });

  it('siyah kazandığında "0 – 1 (Siyah Kazandı)" gösterir', () => {
    setup();
    act(() => handler!({ type: 'game_over', result: '0-1' }));
    expect(screen.getByText('0 – 1 (Siyah Kazandı)')).toBeInTheDocument();
  });

  it('beraberlikte "1/2 – 1/2 (Beraberlik)" gösterir', () => {
    setup();
    act(() => handler!({ type: 'game_over', result: '1/2-1/2' }));
    expect(screen.getByText('1/2 – 1/2 (Beraberlik)')).toBeInTheDocument();
  });
});

describe('LiveGame — beraberlik teklifi (madde d)', () => {
  it('teklif gelince Kabul Et ve Kabul Etme butonları görünür', () => {
    setup();
    act(() => handler!({ type: 'draw_offered', by_child_id: 2 }));
    expect(screen.getByRole('button', { name: 'Kabul Et' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kabul Etme' })).toBeInTheDocument();
  });

  it('Kabul Et accept_draw gönderir', () => {
    setup();
    act(() => handler!({ type: 'draw_offered', by_child_id: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Et' }));
    expect(sent).toContainEqual({ type: 'accept_draw' });
  });

  it('Kabul Etme decline_draw gönderir ve teklif kartını kapatır', () => {
    setup();
    act(() => handler!({ type: 'draw_offered', by_child_id: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Etme' }));
    expect(sent).toContainEqual({ type: 'decline_draw' });
    expect(screen.queryByRole('button', { name: 'Kabul Et' })).not.toBeInTheDocument();
  });

  it('kalan hak sayısını gösterir ve 3 teklif sonrası buton devre dışı kalır', () => {
    setup();
    const btn = () => screen.getByRole('button', { name: /Beraberlik Teklif Et/ });
    expect(btn()).not.toBeDisabled();
    act(() => handler!({ type: 'draw_offer_sent', offers_used: 3 }));
    expect(btn()).toBeDisabled();
  });

  it('teklif reddedilirse bilgi mesajı gösterilir, oyun devam eder', () => {
    setup();
    act(() => handler!({ type: 'draw_declined', by_child_id: 2 }));
    expect(screen.getByText(/reddetti/i)).toBeInTheDocument();
    // Oyun bitmedi: Terk Et butonu hâlâ duruyor
    expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument();
  });
});

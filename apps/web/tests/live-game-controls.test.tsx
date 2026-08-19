import { describe, it, expect, vi } from 'vitest';
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

function setup(myColor: 'white' | 'black' = 'white') {
  sent.length = 0;
  handler = null;
  push.mockReset();
  return render(<LiveGame gameId={1} myColor={myColor} />);
}

describe('LiveGame — Terk Et (madde 3, 2026-08-20: Açılış Pratiği tasarımı)', () => {
  it('dairesel "Terk Et" kartı aria-label ile erişilir', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Terk Et' })).toBeInTheDocument();
  });

  it('onaylanınca resign mesajı gönderir', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Terk Et' }));
    expect(sent).toContainEqual({ type: 'resign' });
  });
});

describe('LiveGame — geri bildirim kartı (madde 3)', () => {
  it('beyaz kazandığında (myColor=white) "Kazandın" gösterir', () => {
    setup('white');
    act(() => handler!({ type: 'game_over', result: '1-0' }));
    expect(screen.getByText('Kazandın')).toBeInTheDocument();
  });

  it('siyah kazandığında (myColor=white) "Rakip Kazandı" gösterir', () => {
    setup('white');
    act(() => handler!({ type: 'game_over', result: '0-1' }));
    expect(screen.getByText('Rakip Kazandı')).toBeInTheDocument();
  });

  it('beraberlikte "Berabere Bitti" gösterir', () => {
    setup('white');
    act(() => handler!({ type: 'game_over', result: '1/2-1/2' }));
    expect(screen.getByText('Berabere Bitti')).toBeInTheDocument();
  });

  it('siyah oynayan sporcu için 0-1 "Kazandın" gösterir (renk göreli)', () => {
    setup('black');
    act(() => handler!({ type: 'game_over', result: '0-1' }));
    expect(screen.getByText('Kazandın')).toBeInTheDocument();
  });

  it('mac surerken geri bildirim karti yok', () => {
    setup();
    expect(screen.queryByText('Kazandın')).not.toBeInTheDocument();
    expect(screen.queryByText('Rakip Kazandı')).not.toBeInTheDocument();
    expect(screen.queryByText('Berabere Bitti')).not.toBeInTheDocument();
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

  it('kalan hak sayısı aria-label\'da görünür ve 3 teklif sonrası kart devre dışı kalır', () => {
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
    expect(screen.getByRole('button', { name: 'Terk Et' })).not.toBeDisabled();
  });
});

describe('LiveGame — Tekrar Oyna (madde 3, 2026-08-20)', () => {
  it('mac surerken "Tekrar Oyna" kartı devre dışıdır', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Tekrar Oyna' })).toBeDisabled();
  });

  it('mac bitince "Tekrar Oyna" tıklanabilir ve rematch_offer gönderir', () => {
    setup();
    act(() => handler!({ type: 'game_over', result: '1-0' }));
    const btn = screen.getByRole('button', { name: 'Tekrar Oyna' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(sent).toContainEqual({ type: 'rematch_offer' });
  });

  it('teklif gönderildikten sonra "Rakip bekleniyor" gösterilir ve kart tekrar devre dışı kalır', () => {
    setup();
    act(() => handler!({ type: 'game_over', result: '1-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Oyna' }));
    expect(screen.getByText(/Rakip bekleniyor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar Oyna' })).toBeDisabled();
  });

  it('rakip teklif edince Kabul Et/Kabul Etme kartı görünür', () => {
    setup();
    act(() => handler!({ type: 'game_over', result: '1-0' }));
    act(() => handler!({ type: 'rematch_offered', by_child_id: 2 }));
    expect(screen.getByText('Rakip yeniden oynamak istiyor')).toBeInTheDocument();
  });

  it('Kabul Et rematch_accept gönderir', () => {
    setup();
    act(() => handler!({ type: 'game_over', result: '1-0' }));
    act(() => handler!({ type: 'rematch_offered', by_child_id: 2 }));
    const buttons = screen.getAllByRole('button', { name: 'Kabul Et' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(sent).toContainEqual({ type: 'rematch_accept' });
  });

  it('rematch_ready gelince renk TAKAS edilerek yeni maça yönlendirir', () => {
    setup('white');
    act(() => handler!({ type: 'game_over', result: '1-0' }));
    act(() => handler!({ type: 'rematch_ready', game_id: 42 }));
    expect(push).toHaveBeenCalledWith('/play/online/42?color=black');
  });

  it('teklif reddedilirse bilgi mesajı gösterilir', () => {
    setup();
    act(() => handler!({ type: 'game_over', result: '1-0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Oyna' }));
    act(() => handler!({ type: 'rematch_declined', by_child_id: 2 }));
    expect(screen.getByText(/istemedi/)).toBeInTheDocument();
  });
});

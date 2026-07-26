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

import { ChallengeScreen } from '@/components/ChallengeScreen';

function setup(onMatched = vi.fn()) {
  sent.length = 0;
  handler = null;
  const utils = render(<ChallengeScreen onMatched={onMatched} />);
  return { ...utils, onMatched };
}

describe('ChallengeScreen', () => {
  it('önce maç kriterleri sorulur', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Teklif Gönder/ })).toBeInTheDocument();
  });

  it('kriterler seçilince aktif sporcu listesi gösterilir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Gönder/ }));
    act(() => handler!({ type: 'lobby_joined', players: [{ child_id: 9, display_name: 'Veli' }] }));
    expect(screen.getByText('Veli')).toBeInTheDocument();
  });

  it('kimse aktif değilse bilgi mesajı gösterir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 1' }));
    fireEvent.click(screen.getByRole('button', { name: '3+2' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Gönder/ }));
    act(() => handler!({ type: 'lobby_joined', players: [] }));
    expect(screen.getByText(/şu an aktif sporcu yok/i)).toBeInTheDocument();
  });

  it('bir sporcuya tıklayınca challenge mesajı gönderilir', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 3' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Beyaz' }));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Gönder/ }));
    act(() => handler!({ type: 'lobby_joined', players: [{ child_id: 9, display_name: 'Veli' }] }));
    fireEvent.click(screen.getByText('Veli'));
    const challenge = sent.find((m) => (m as { type?: string }).type === 'challenge') as
      { target_child_id: number; criteria: { color: string; skill: number } };
    expect(challenge.target_child_id).toBe(9);
    expect(challenge.criteria.color).toBe('w');
    expect(challenge.criteria.skill).toBe(6);
  });

  it('gelen davet bildiriminde Kabul Et / Kabul Etme çıkar', () => {
    setup();
    act(() => handler!({ type: 'challenge_received', from_child_id: 5, from_name: 'Ayşe', criteria: {} }));
    expect(screen.getByText(/Ayşe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kabul Et' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kabul Etme' })).toBeInTheDocument();
  });

  it('daveti kabul edince challenge_accept gönderilir', () => {
    setup();
    act(() => handler!({ type: 'challenge_received', from_child_id: 5, from_name: 'Ayşe', criteria: { color: 'b' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Et' }));
    const acc = sent.find((m) => (m as { type?: string }).type === 'challenge_accept') as
      { from_child_id: number; criteria: { color: string } };
    expect(acc.from_child_id).toBe(5);
    expect(acc.criteria.color).toBe('b');
  });

  it('daveti reddedince challenge_decline gönderilir ve bildirim kapanır', () => {
    setup();
    act(() => handler!({ type: 'challenge_received', from_child_id: 5, from_name: 'Ayşe', criteria: {} }));
    fireEvent.click(screen.getByRole('button', { name: 'Kabul Etme' }));
    expect(sent).toContainEqual({ type: 'challenge_decline', from_child_id: 5 });
    expect(screen.queryByRole('button', { name: 'Kabul Et' })).not.toBeInTheDocument();
  });

  it('eşleşme olunca onMatched çağrılır', () => {
    const onMatched = vi.fn();
    setup(onMatched);
    act(() => handler!({ type: 'matched', game_id: 42, color: 'black', opponent_id: 9 }));
    expect(onMatched).toHaveBeenCalledWith({ gameId: 42, color: 'black' });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveLessonRoom } from '@/lib/useLiveLessonRoom';

vi.mock('@/lib/liveLessonsApi', () => ({
  liveLessonWsUrl: (id: number) => `ws://test/live-lessons/ws/live-lesson/${id}?token=x`,
}));

/** Madde 2026-09-15 (Online Dersler): `useLiveLessonRoom` ders-içi
 *  WebSocket kanalını yönetir — gerçek bir sunucu olmadan, `WebSocket`
 *  global'i sahte bir sınıfla değiştirilerek test edilir. */
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly OPEN = 1;
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; this.readyState = 3; this.onclose?.(); }
  emitOpen() { this.readyState = MockWebSocket.OPEN; this.onopen?.(); }
  emitMessage(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

function latestSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
});

describe('useLiveLessonRoom', () => {
  it('bağlanılan URL doğru kurulur, açılınca connected true olur', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    expect(latestSocket().url).toBe('ws://test/live-lessons/ws/live-lesson/1?token=x');
    act(() => latestSocket().emitOpen());
    expect(result.current.connected).toBe(true);
  });

  it('lesson_state mesajı fen/sanHistory/controllerChildId set eder', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    act(() => latestSocket().emitMessage({
      type: 'lesson_state', fen: 'FEN1', san_history: ['e4'], controller_child_id: 7,
    }));
    expect(result.current.fen).toBe('FEN1');
    expect(result.current.sanHistory).toEqual(['e4']);
    expect(result.current.controllerChildId).toBe(7);
  });

  it('participant_joined/left katılımcı listesini günceller', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, true));
    act(() => latestSocket().emitMessage({ type: 'participant_joined', child_id: 11 }));
    expect(result.current.connectedChildIds).toEqual([11]);
    act(() => latestSocket().emitMessage({ type: 'participant_joined', child_id: 22 }));
    expect(result.current.connectedChildIds).toEqual([11, 22]);
    act(() => latestSocket().emitMessage({ type: 'participant_left', child_id: 11 }));
    expect(result.current.connectedChildIds).toEqual([22]);
  });

  it('join_requested pendingRequests\'e eklenir, dismissPendingRequest kaldırır', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, true));
    act(() => latestSocket().emitMessage({ type: 'join_requested', child_id: 5, name: 'Ali' }));
    expect(result.current.pendingRequests).toEqual([{ childId: 5, name: 'Ali' }]);
    act(() => result.current.dismissPendingRequest(5));
    expect(result.current.pendingRequests).toEqual([]);
  });

  it('control_changed ve move/board_reset tahta durumunu günceller', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    act(() => latestSocket().emitMessage({ type: 'control_changed', child_id: 9 }));
    expect(result.current.controllerChildId).toBe(9);

    act(() => latestSocket().emitMessage({ type: 'move', fen: 'FEN2', san: 'e4' }));
    expect(result.current.fen).toBe('FEN2');
    expect(result.current.sanHistory).toEqual(['e4']);

    act(() => latestSocket().emitMessage({ type: 'board_reset', fen: 'FEN0' }));
    expect(result.current.fen).toBe('FEN0');
    expect(result.current.sanHistory).toEqual([]);
  });

  it('muted ve lesson_ended bayraklarını set eder', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    act(() => latestSocket().emitMessage({ type: 'muted' }));
    expect(result.current.muted).toBe(true);
    act(() => latestSocket().emitMessage({ type: 'lesson_ended' }));
    expect(result.current.lessonEnded).toBe(true);
  });

  it('chat_message sohbet listesine eklenir', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    act(() => latestSocket().emitMessage({ type: 'chat_message', from: 'Antrenör', text: 'Merhaba', is_host: true }));
    expect(result.current.chatMessages).toEqual([{ from: 'Antrenör', text: 'Merhaba', isHost: true }]);
  });

  it('sendMove/grantControl/revokeControl/muteChild/sendChat doğru JSON gönderir', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, true));
    act(() => latestSocket().emitOpen());

    act(() => result.current.sendMove('e2e4'));
    act(() => result.current.grantControl(5));
    act(() => result.current.revokeControl());
    act(() => result.current.resetBoard('FENX'));
    act(() => result.current.muteChild(5));
    act(() => result.current.sendChat('Selam'));

    const sent = latestSocket().sent.map((s) => JSON.parse(s));
    expect(sent).toEqual([
      { type: 'move', uci: 'e2e4' },
      { type: 'grant_control', child_id: 5 },
      { type: 'revoke_control' },
      { type: 'reset_board', fen: 'FENX' },
      { type: 'mute', child_id: 5 },
      { type: 'chat_message', text: 'Selam' },
    ]);
  });

  it('lessonId=null iken bağlantı hiç açılmaz', () => {
    renderHook(() => useLiveLessonRoom(null, false));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('unmount olunca bağlantı kapanır', () => {
    const { unmount } = renderHook(() => useLiveLessonRoom(1, false));
    const ws = latestSocket();
    unmount();
    expect(ws.closed).toBe(true);
  });
});

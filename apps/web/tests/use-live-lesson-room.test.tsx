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

  it('lesson_state mesajı fen/sanHistory/controllerChildId/mutedChildIds set eder', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    act(() => latestSocket().emitMessage({
      type: 'lesson_state', fen: 'FEN1', san_history: ['e4'], controller_child_id: 7,
      muted_child_ids: [3],
    }));
    expect(result.current.fen).toBe('FEN1');
    expect(result.current.sanHistory).toEqual(['e4']);
    expect(result.current.controllerChildId).toBe(7);
    expect(result.current.mutedChildIds).toEqual(new Set([3]));
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

  it('muted ve lesson_ended bayraklarını set eder, muted:false ile sesi açar', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    act(() => latestSocket().emitMessage({ type: 'muted', muted: true }));
    expect(result.current.muted).toBe(true);
    act(() => latestSocket().emitMessage({ type: 'muted', muted: false }));
    expect(result.current.muted).toBe(false);
    act(() => latestSocket().emitMessage({ type: 'lesson_ended' }));
    expect(result.current.lessonEnded).toBe(true);
  });

  it('mute_state_changed host tarafındaki mutedChildIds\'i günceller (madde 2026-09-16, Faz A)', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, true));
    act(() => latestSocket().emitMessage({ type: 'mute_state_changed', muted_child_ids: [5, 8] }));
    expect(result.current.mutedChildIds).toEqual(new Set([5, 8]));
  });

  it('madde 2026-09-17 ("Söz Hakkı İstiyor" v2): hand_state_changed handRaisedIds\'i günceller', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, true));
    act(() => latestSocket().emitMessage({ type: 'hand_state_changed', child_id: 11, raised: true }));
    expect(result.current.handRaisedIds).toEqual(new Set([11]));
    act(() => latestSocket().emitMessage({ type: 'hand_state_changed', child_id: 22, raised: true }));
    expect(result.current.handRaisedIds).toEqual(new Set([11, 22]));
    act(() => latestSocket().emitMessage({ type: 'hand_state_changed', child_id: 11, raised: false }));
    expect(result.current.handRaisedIds).toEqual(new Set([22]));
  });

  it('lesson_state hand_raised_ids\'i de okur (reconnect)', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, true));
    act(() => latestSocket().emitMessage({
      type: 'lesson_state', fen: 'FEN1', san_history: [], controller_child_id: null,
      muted_child_ids: [], hand_raised_ids: [7, 9],
    }));
    expect(result.current.handRaisedIds).toEqual(new Set([7, 9]));
  });

  it('floor_granted floorAnnouncement\'i set eder, aynı isimle tekrar gelse bile nonce artar', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    act(() => latestSocket().emitMessage({ type: 'floor_granted', name: 'Defne Hüma' }));
    expect(result.current.floorAnnouncement).toEqual({ name: 'Defne Hüma', nonce: 1 });
    act(() => latestSocket().emitMessage({ type: 'floor_granted', name: 'Defne Hüma' }));
    expect(result.current.floorAnnouncement).toEqual({ name: 'Defne Hüma', nonce: 2 });
  });

  it('arrows/marks mesajları durumu günceller, sendArrows/sendMarks doğru JSON gönderir (madde 2026-09-16, Faz B)', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, true));
    act(() => latestSocket().emitOpen());

    act(() => latestSocket().emitMessage({ type: 'arrows', arrows: [{ from: 'e2', to: 'e4', color: 'green' }] }));
    expect(result.current.arrows).toEqual([{ from: 'e2', to: 'e4', color: 'green' }]);

    act(() => latestSocket().emitMessage({ type: 'marks', marks: { e4: 'red' } }));
    expect(result.current.marks).toEqual({ e4: 'red' });

    act(() => result.current.sendArrows([{ from: 'd2', to: 'd4', color: 'blue' }]));
    act(() => result.current.sendMarks({ d4: 'yellow' }));
    const sent = latestSocket().sent.map((s) => JSON.parse(s));
    expect(sent).toEqual([
      { type: 'arrows', arrows: [{ from: 'd2', to: 'd4', color: 'blue' }] },
      { type: 'marks', marks: { d4: 'yellow' } },
    ]);
  });

  it('chat_message sohbet listesine eklenir', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, false));
    act(() => latestSocket().emitMessage({ type: 'chat_message', from: 'Antrenör', text: 'Merhaba', is_host: true }));
    expect(result.current.chatMessages).toEqual([{ from: 'Antrenör', text: 'Merhaba', isHost: true }]);
  });

  it('sendMove/grantControl/revokeControl/muteChild/muteAll/raiseHand/grantFloor/sendChat doğru JSON gönderir', () => {
    const { result } = renderHook(() => useLiveLessonRoom(1, true));
    act(() => latestSocket().emitOpen());

    act(() => result.current.sendMove('e2e4'));
    act(() => result.current.grantControl(5));
    act(() => result.current.revokeControl());
    act(() => result.current.resetBoard('FENX'));
    act(() => result.current.muteChild(5));
    act(() => result.current.muteChild(5, false));
    act(() => result.current.muteAll());
    act(() => result.current.raiseHand(true));
    act(() => result.current.raiseHand(false));
    act(() => result.current.grantFloor(11));
    act(() => result.current.sendChat('Selam'));

    const sent = latestSocket().sent.map((s) => JSON.parse(s));
    expect(sent).toEqual([
      { type: 'move', uci: 'e2e4' },
      { type: 'grant_control', child_id: 5 },
      { type: 'revoke_control' },
      { type: 'reset_board', fen: 'FENX' },
      { type: 'mute', child_id: 5, muted: true },
      { type: 'mute', child_id: 5, muted: false },
      { type: 'mute_all' },
      { type: 'raise_hand', raised: true },
      { type: 'raise_hand', raised: false },
      { type: 'grant_floor', child_id: 11 },
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

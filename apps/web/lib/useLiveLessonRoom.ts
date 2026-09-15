'use client';
import { useEffect, useRef, useState } from 'react';
import { liveLessonWsUrl } from '@/lib/liveLessonsApi';

/** Madde 2026-09-15: ders-içi gerçek zamanlı durum kanalı (paylaşılan
 *  tahta, taş oynatma yetkisi, katılımcı listesi, sohbet) — LiveKit'ten
 *  AYRI (o SADECE ses/görüntü taşır). Hem antrenörün ders odası hem
 *  sporcunun katılım ekranı AYNI hook'u kullanır — `isHost` davranışı
 *  farklılaştırır (ör. `pendingRequests` sadece antrenöre gelir).
 */

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface ChatMessage {
  from: string;
  text: string;
  isHost: boolean;
}

export interface PendingJoinRequest {
  childId: number;
  name: string;
}

interface State {
  connected: boolean;
  fen: string;
  sanHistory: string[];
  controllerChildId: number | null;
  connectedChildIds: number[];
  pendingRequests: PendingJoinRequest[];
  chatMessages: ChatMessage[];
  lessonEnded: boolean;
  /** Sadece sporcu tarafında: antrenör bu bağlantıyı susturduysa true —
   *  gerçek susturma LiveKit'te olur, bu SADECE arayüz bilgisi. */
  muted: boolean;
}

export function useLiveLessonRoom(lessonId: number | null, isHost: boolean) {
  const [state, setState] = useState<State>({
    connected: false, fen: START_FEN, sanHistory: [], controllerChildId: null,
    connectedChildIds: [], pendingRequests: [], chatMessages: [], lessonEnded: false,
    muted: false,
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (lessonId == null) return;
    const ws = new WebSocket(liveLessonWsUrl(lessonId));
    wsRef.current = ws;

    ws.onopen = () => setState((s) => ({ ...s, connected: true }));
    ws.onclose = () => setState((s) => ({ ...s, connected: false }));
    ws.onmessage = (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'lesson_state':
          setState((s) => ({
            ...s, fen: (msg.fen as string) ?? s.fen,
            sanHistory: (msg.san_history as string[]) ?? [],
            controllerChildId: (msg.controller_child_id as number | null) ?? null,
          }));
          break;
        case 'participant_joined':
          setState((s) => ({
            ...s, connectedChildIds: Array.from(new Set([...s.connectedChildIds, msg.child_id as number])),
          }));
          break;
        case 'participant_left':
          setState((s) => ({
            ...s, connectedChildIds: s.connectedChildIds.filter((id) => id !== msg.child_id),
          }));
          break;
        case 'join_requested':
          setState((s) => ({
            ...s, pendingRequests: [...s.pendingRequests, { childId: msg.child_id as number, name: msg.name as string }],
          }));
          break;
        case 'control_changed':
          setState((s) => ({ ...s, controllerChildId: (msg.child_id as number | null) ?? null }));
          break;
        case 'move':
          setState((s) => ({ ...s, fen: msg.fen as string, sanHistory: [...s.sanHistory, msg.san as string] }));
          break;
        case 'board_reset':
          setState((s) => ({ ...s, fen: msg.fen as string, sanHistory: [] }));
          break;
        case 'muted':
          setState((s) => ({ ...s, muted: true }));
          break;
        case 'chat_message':
          setState((s) => ({
            ...s,
            chatMessages: [...s.chatMessages, { from: msg.from as string, text: msg.text as string, isHost: msg.is_host as boolean }],
          }));
          break;
        case 'lesson_ended':
          setState((s) => ({ ...s, lessonEnded: true }));
          break;
        default:
          break;
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [lessonId, isHost]);

  function send(msg: Record<string, unknown>) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  return {
    ...state,
    sendMove: (uci: string) => send({ type: 'move', uci }),
    grantControl: (childId: number) => send({ type: 'grant_control', child_id: childId }),
    revokeControl: () => send({ type: 'revoke_control' }),
    resetBoard: (fen?: string) => send({ type: 'reset_board', fen }),
    muteChild: (childId: number) => send({ type: 'mute', child_id: childId }),
    sendChat: (text: string) => send({ type: 'chat_message', text }),
    dismissPendingRequest: (childId: number) => setState((s) => ({
      ...s, pendingRequests: s.pendingRequests.filter((p) => p.childId !== childId),
    })),
  };
}

'use client';
import { useEffect, useRef, useState } from 'react';

type MessageHandler = (data: unknown) => void;

export function useWebSocket(url: string | null, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!url) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setReadyState(WebSocket.CONNECTING);
    ws.onopen = () => setReadyState(WebSocket.OPEN);
    ws.onclose = () => setReadyState(WebSocket.CLOSED);
    ws.onerror = () => setReadyState(WebSocket.CLOSED);
    ws.onmessage = (e) => {
      try { onMessageRef.current(JSON.parse(e.data)); } catch { /* ignore */ }
    };
    return () => { ws.close(); wsRef.current = null; };
  }, [url]);

  return {
    send: (data: object) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
    readyState,
  };
}

export function wsBase(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return api.replace(/^http/, 'ws');
}

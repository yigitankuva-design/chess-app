'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Square } from 'chess.js';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { useAuth } from '@/lib/auth-context';
import { ChessBoard } from '@/components/ChessBoard';
import {
  requestLiveLessonJoin, pollLiveLessonJoinStatus, leaveLiveLesson,
} from '@/lib/liveLessonsApi';
import type { LiveKitConnectionInfo } from '@/lib/liveLessonsApi';
import { useLiveLessonRoom } from '@/lib/useLiveLessonRoom';
import type { ChatMessage } from '@/lib/useLiveLessonRoom';

const POLL_INTERVAL_MS = 2000;

/**
 * Madde 2026-09-15 (Online Dersler, Zafer'in madde 3'ü): sporcunun katılım
 * ekranı. "Derse Katıl"a basınca ya anında (otomatik katılım) ya da
 * antrenör onayından SONRA (izinli katılım — bu sırada bekleme ekranı,
 * POLL ile kontrol edilir) LiveKit'e SADECE SES ile bağlanır — kamera/
 * ekran paylaşımı arayüzü hiç YOK. İstediği an "Dersten Ayrıl" ile çıkıp
 * "Derse Katıl"a tekrar basarak girebilir.
 */
export default function DerslerCanliJoinPage() {
  const params = useParams<{ id: string }>();
  const lessonId = Number(params.id);
  const { role, userId } = useAuth();

  // undefined = henüz katılmadı, 'pending' = onay bekliyor, 'denied' =
  // reddedildi, LiveKitConnectionInfo = bağlanmaya hazır.
  const [state, setState] = useState<'idle' | 'pending' | 'denied' | 'error'>('idle');
  const [conn, setConn] = useState<LiveKitConnectionInfo | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    return () => { pollingRef.current = false; };
  }, []);

  async function handleJoin() {
    const res = await requestLiveLessonJoin(lessonId);
    if (!res) { setState('error'); return; }
    if (res.status === 'admitted') {
      setConn({ token: res.token, livekit_url: res.livekit_url });
      return;
    }
    if (res.status === 'denied') { setState('denied'); return; }
    setState('pending');
    pollingRef.current = true;
    void poll();
  }

  async function poll() {
    while (pollingRef.current) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (!pollingRef.current) return;
      const res = await pollLiveLessonJoinStatus(lessonId);
      if (!res) continue;
      if (res.status === 'admitted') {
        pollingRef.current = false;
        setConn({ token: res.token, livekit_url: res.livekit_url });
        return;
      }
      if (res.status === 'denied') {
        pollingRef.current = false;
        setState('denied');
        return;
      }
    }
  }

  if (role !== 'child' && role !== 'athlete') {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Bu sayfa yalnızca sporcular içindir.</p></main>;
  }

  if (conn) {
    return (
      <LiveKitRoom serverUrl={conn.livekit_url} token={conn.token} audio video={false} style={{ display: 'contents' }}>
        <RoomAudioRenderer />
        <StudentRoomInner lessonId={lessonId} ownChildId={userId} onLeft={() => setConn(null)} />
      </LiveKitRoom>
    );
  }

  return (
    <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-extrabold t-premium">Canlı Ders</h1>
      {state === 'idle' && (
        <button type="button" onClick={handleJoin}
          className="w-full rounded-xl px-4 py-3 text-sm font-bold"
          style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
          Derse Katıl
        </button>
      )}
      {state === 'pending' && (
        <div className="t-card p-4 text-center space-y-2">
          <p className="text-sm t-muted">Antrenörünün onayı bekleniyor…</p>
        </div>
      )}
      {state === 'denied' && (
        <div className="t-card p-4 text-center">
          <p className="text-sm" style={{ color: '#f43f5e' }}>Antrenörün katılım isteğini kabul etmedi.</p>
        </div>
      )}
      {state === 'error' && (
        <div className="t-card p-4 text-center">
          <p className="text-sm" style={{ color: '#f43f5e' }}>Derse bağlanılamadı. Az sonra tekrar dene.</p>
        </div>
      )}
    </main>
  );
}

function StudentRoomInner({ lessonId, ownChildId, onLeft }: {
  lessonId: number; ownChildId: number | null; onLeft: () => void;
}) {
  const router = useRouter();
  const room = useLiveLessonRoom(lessonId, false);
  const canMove = ownChildId !== null && room.controllerChildId === ownChildId;

  function handleDrop(from: Square, to: Square): boolean {
    if (!canMove) return false;
    room.sendMove(`${from}${to}`);
    return true;
  }

  async function handleLeave() {
    await leaveLiveLesson(lessonId);
    onLeft();
  }

  useEffect(() => {
    if (room.lessonEnded) {
      router.push('/bildirimler');
    }
  }, [room.lessonEnded, router]);

  return (
    <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold t-premium">Canlı Ders</h1>
        <button type="button" onClick={handleLeave}
          className="rounded-lg px-3 py-2 text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)' }}>
          Dersten Ayrıl
        </button>
      </div>

      {room.muted && (
        <p className="text-xs text-center" style={{ color: '#f43f5e' }}>Antrenörün seni sustur.</p>
      )}
      {canMove && (
        <p className="text-xs text-center font-bold" style={{ color: 'var(--t-accent)' }}>
          Taş oynatma sırası sende!
        </p>
      )}

      <ChessBoard fen={room.fen} interactive={canMove} onPieceDrop={handleDrop} boardOrientation="white" />

      <ChatPanel messages={room.chatMessages} onSend={room.sendChat} />
    </main>
  );
}

function ChatPanel({ messages, onSend }: { messages: ChatMessage[]; onSend: (t: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="t-card p-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest t-muted">Sohbet</p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {messages.map((m, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <p key={i} className="text-sm"><b>{m.from}:</b> {m.text}</p>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }}
        className="flex gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesaj yaz…"
          className="flex-1 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
        <button type="submit" className="rounded-lg px-3 py-2 text-xs font-bold"
          style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
          Gönder
        </button>
      </form>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Square } from 'chess.js';
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant } from '@livekit/components-react';
import { useAuth } from '@/lib/auth-context';
import { ChessBoard } from '@/components/ChessBoard';
import {
  requestLiveLessonJoin, pollLiveLessonJoinStatus, leaveLiveLesson,
} from '@/lib/liveLessonsApi';
import type { LiveKitConnectionInfo } from '@/lib/liveLessonsApi';
import { useLiveLessonRoom } from '@/lib/useLiveLessonRoom';
import type { ChatMessage } from '@/lib/useLiveLessonRoom';
import { WaitingGame } from '@/components/WaitingGame';

const POLL_INTERVAL_MS = 2000;

/**
 * Madde 2026-09-15 (Online Dersler, Zafer'in madde 3'ü): sporcunun katılım
 * ekranı. "Derse Katıl"a basınca ya anında (otomatik katılım) ya da
 * antrenör onayından SONRA (izinli katılım — bu sırada bekleme ekranı,
 * POLL ile kontrol edilir) LiveKit'e SADECE SES ile bağlanır — kamera/
 * ekran paylaşımı arayüzü hiç YOK. İstediği an "Dersten Ayrıl" ile çıkıp
 * "Derse Katıl"a tekrar basarak girebilir.
 *
 * Madde 2026-09-17 (Sporcu Ekranı): "Canlı Ders" kartı ile "Dersten Ayrıl"
 * arasında 3 durum ikonu — El (antrenör kontrolünde, salt-okunur taş
 * oynatma yetkisi göstergesi), Mikrofon (antrenör susturmadıysa sporcu
 * kendi kendine aç/kapa yapabilir, saf LiveKit istemci çağrısı), "Söz
 * Hakkı İstiyor" (turuncu↔mavi, tam akış useLiveLessonRoom.ts'te). Telefon
 * HER ZAMAN dikey düzeni kullanır (fiziksel yatay olsa bile); tablet
 * yatayken tahta solda, ikon+sohbet sütunu sağda (Tailwind `md:landscape:`
 * + `order-*` — tek JSX bloğu, iki panel için de aynı kod).
 *
 * Madde 2026-09-17 (madde 6): antrenörün ONAY beklenen ekranında
 * (`state==='pending'`) bekleme mini-oyunu (`WaitingGame`) gömülü —
 * onaylanınca bu blok zaten unmount olur, ekstra kapatma mantığı gerekmez.
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
        <div className="space-y-2">
          <p className="text-sm t-muted text-center">Antrenörünün onayı bekleniyor…</p>
          <WaitingGame />
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

function HandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 11V6a2 2 0 1 1 4 0v5M12 11V4a2 2 0 1 1 4 0v7M16 12V7a2 2 0 1 1 4 0v6c0 4-2 8-7 8h-1c-3.2 0-5-1.3-7-4.2l-1.6-2.4a1.6 1.6 0 0 1 2.5-1.9L8 12"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" />
      {muted && <line x1="4" y1="3" x2="20" y2="21" strokeLinecap="round" />}
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 9a3 3 0 1 1 4 2.83c-.6.24-1 .85-1 1.5V14" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="17.5" x2="12" y2="17.51" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function StudentRoomInner({ lessonId, ownChildId, onLeft }: {
  lessonId: number; ownChildId: number | null; onLeft: () => void;
}) {
  const router = useRouter();
  const room = useLiveLessonRoom(lessonId, false);
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const canMove = ownChildId !== null && room.controllerChildId === ownChildId;
  const handRaised = ownChildId !== null && room.handRaisedIds.has(ownChildId);

  function handleDrop(from: Square, to: Square): boolean {
    if (!canMove) return false;
    room.sendMove(`${from}${to}`);
    return true;
  }

  async function handleLeave() {
    await leaveLiveLesson(lessonId);
    onLeft();
  }

  function toggleMic() {
    if (room.muted) return; // antrenör susturdu — kendi kendine açamaz
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }

  useEffect(() => {
    if (room.lessonEnded) {
      router.push('/bildirimler');
    }
  }, [room.lessonEnded, router]);

  // Madde 2026-09-17: antrenör söz hakkı verince (SADECE bu sporcuya gelen
  // "floor_granted") tarayıcının kendi sesli okuma özelliğiyle (ücretsiz,
  // cihazda) anons çalar — kimseye duyulmaz, sadece bu cihazda.
  useEffect(() => {
    if (!room.floorAnnouncement || typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(
      `${room.floorAnnouncement.name}, söz hakkı senin, konuşabilirsin`,
    );
    u.lang = 'tr-TR';
    window.speechSynthesis.speak(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.floorAnnouncement]);

  const micOn = !room.muted && isMicrophoneEnabled;

  return (
    <main className="px-4 pt-6 pb-12 max-w-xl md:landscape:max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold t-premium">Canlı Ders</h1>
        <button type="button" onClick={handleLeave}
          className="rounded-lg px-3 py-2 text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)' }}>
          Dersten Ayrıl
        </button>
      </div>

      {canMove && (
        <p className="text-xs text-center font-bold mt-4" style={{ color: 'var(--t-accent)' }}>
          Taş oynatma sırası sende!
        </p>
      )}

      <div className="flex flex-col md:landscape:flex-row gap-4 mt-4">
        <div className="md:landscape:flex-1 min-w-0">
          <ChessBoard fen={room.fen} interactive={canMove} onPieceDrop={handleDrop} boardOrientation="white"
            externalArrows={room.arrows} externalMarks={room.marks} />
        </div>

        <div className="flex flex-col gap-3 md:landscape:w-64 md:landscape:flex-shrink-0">
          <div className="flex flex-row md:landscape:flex-col justify-center gap-3">
            <div className="order-1 md:landscape:order-3 rounded-full p-2.5"
              title={canMove ? 'Taş oynatma yetkin var' : 'Taş oynatma yetkin yok'}
              style={{ background: canMove ? '#22c55e' : '#ef4444', color: '#fff' }}>
              <HandIcon />
            </div>
            <button type="button" onClick={toggleMic} disabled={room.muted}
              className="order-2 rounded-full p-2.5 disabled:cursor-not-allowed"
              title={room.muted ? 'Antrenör seni sustur' : (micOn ? 'Mikrofonu kapat' : 'Mikrofonu aç')}
              style={{ background: micOn ? '#22c55e' : '#ef4444', color: '#fff' }}>
              <MicIcon muted={!micOn} />
            </button>
            <button type="button" onClick={() => room.raiseHand(!handRaised)}
              className={`order-3 md:landscape:order-1 rounded-full p-2.5 ${handRaised ? 'request-floor-blink' : ''}`}
              title={handRaised ? 'Söz hakkı isteğini iptal et' : 'Söz hakkı iste'}
              style={{ background: handRaised ? '#2563eb' : '#f97316', color: '#fff' }}>
              <QuestionIcon />
            </button>
          </div>

          <ChatPanel messages={room.chatMessages} onSend={room.sendChat} />
        </div>
      </div>
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

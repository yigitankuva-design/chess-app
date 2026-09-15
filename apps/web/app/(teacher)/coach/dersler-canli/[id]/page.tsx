'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Square } from 'chess.js';
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useAuth } from '@/lib/auth-context';
import { ChessBoard } from '@/components/ChessBoard';
import {
  fetchLiveLesson, startLiveLesson, endLiveLesson, admitLiveLessonParticipant,
} from '@/lib/liveLessonsApi';
import type { LiveLesson, LiveKitConnectionInfo } from '@/lib/liveLessonsApi';
import { fetchClassStudents } from '@/lib/homeworkApi';
import type { ClassStudent } from '@/lib/homeworkApi';
import { useLiveLessonRoom } from '@/lib/useLiveLessonRoom';
import type { ChatMessage } from '@/lib/useLiveLessonRoom';

/**
 * Madde 2026-09-15 (Online Dersler): antrenörün ders odası. LiveKit SADECE
 * ses/görüntü taşır (`LiveKitRoom`); paylaşılan tahta/katılım/sohbet
 * `useLiveLessonRoom`'un AYRI WebSocket'i üzerinden yürür. Ekran tasarımı
 * sonraya bırakıldı (Zafer'in notu) — burada işlevsellik önceliklidir.
 */
export default function DerslerCanliHostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const lessonId = Number(params.id);
  const { role } = useAuth();

  const [lesson, setLesson] = useState<LiveLesson | null>(null);
  const [conn, setConn] = useState<LiveKitConnectionInfo | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId || role !== 'teacher') return;
    (async () => {
      const l = await fetchLiveLesson(lessonId);
      if (!l) { setErr('Ders bulunamadı.'); return; }
      setLesson(l);
      fetchClassStudents(l.class_id).then(setStudents);
      const info = await startLiveLesson(lessonId);
      if (!info) { setErr('Derse bağlanılamadı — LiveKit sunucusu şu an erişilemiyor olabilir.'); return; }
      setConn(info);
    })();
  }, [lessonId, role]);

  if (role !== 'teacher') {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Bu sayfa yalnızca antrenörler içindir.</p></main>;
  }
  if (err) {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="text-sm" style={{ color: '#f43f5e' }}>{err}</p></main>;
  }
  if (!lesson || !conn) {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Bağlanılıyor…</p></main>;
  }

  return (
    <LiveKitRoom serverUrl={conn.livekit_url} token={conn.token} audio video style={{ display: 'contents' }}>
      <RoomAudioRenderer />
      <HostRoomInner
        lessonId={lessonId} lesson={lesson} students={students}
        onEnded={() => router.push('/coach/dersler-canli')}
      />
    </LiveKitRoom>
  );
}

function HostRoomInner({ lessonId, lesson, students, onEnded }: {
  lessonId: number; lesson: LiveLesson; students: ClassStudent[]; onEnded: () => void;
}) {
  const room = useLiveLessonRoom(lessonId, true);
  const cameraTracks = useTracks([Track.Source.Camera]);

  function studentName(id: number): string {
    return students.find((s) => s.id === id)?.display_name ?? `#${id}`;
  }

  function handleDrop(from: Square, to: Square): boolean {
    // Madde: v1'de terfi seçici YOK (ekran tasarımı sonraya bırakıldı) —
    // sunucu (validate_move) terfi harfi olmayan bir UCI'yi piyon son
    // sıraya ulaşınca zaten reddeder; bu nadir durumda antrenör normal
    // bir hamleyle devam eder.
    room.sendMove(`${from}${to}`);
    return true;
  }

  async function handleEnd() {
    if (!confirm('Dersi sonlandırmak istiyor musun?')) return;
    await endLiveLesson(lessonId);
    onEnded();
  }

  return (
    <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold t-premium truncate">{lesson.title}</h1>
        <button type="button" onClick={handleEnd}
          className="rounded-lg px-3 py-2 text-xs font-bold flex-shrink-0"
          style={{ background: '#ef4444', color: '#fff' }}>
          Dersi Sonlandır
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cameraTracks.map((t) => (
          <VideoTrack key={t.publication?.trackSid ?? t.participant.identity} trackRef={t}
            className="rounded-lg w-full aspect-video object-cover" />
        ))}
      </div>

      <ChessBoard fen={room.fen} interactive onPieceDrop={handleDrop} boardOrientation="white" />

      {room.pendingRequests.length > 0 && (
        <div className="t-card p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest t-muted">Katılım İstekleri</p>
          {room.pendingRequests.map((p) => (
            <div key={p.childId} className="flex items-center justify-between gap-2">
              <span className="text-sm">{p.name}</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={async () => {
                  await admitLiveLessonParticipant(lessonId, p.childId, true);
                  room.dismissPendingRequest(p.childId);
                }} className="rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  style={{ background: '#22c55e', color: '#0a0a0a' }}>
                  Kabul Et
                </button>
                <button type="button" onClick={async () => {
                  await admitLiveLessonParticipant(lessonId, p.childId, false);
                  room.dismissPendingRequest(p.childId);
                }} className="rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)' }}>
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="t-card p-3 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest t-muted">
          Katılımcılar ({room.connectedChildIds.length})
        </p>
        {room.connectedChildIds.length === 0 && <p className="text-xs t-muted">Henüz katılan yok.</p>}
        {room.connectedChildIds.map((cid) => (
          <div key={cid} className="flex items-center justify-between gap-2">
            <span className="text-sm">{studentName(cid)}</span>
            <div className="flex gap-1.5">
              {room.controllerChildId === cid ? (
                <button type="button" onClick={() => room.revokeControl()}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
                  Taş Yetkisini Al
                </button>
              ) : (
                <button type="button" onClick={() => room.grantControl(cid)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)' }}>
                  Taş Oynatma Yetkisi Ver
                </button>
              )}
              <button type="button" onClick={() => room.muteChild(cid)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-bold"
                style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)' }}>
                Sustur
              </button>
            </div>
          </div>
        ))}
      </div>

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

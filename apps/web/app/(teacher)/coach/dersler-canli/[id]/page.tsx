'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Square } from 'chess.js';
import { LiveKitRoom, RoomAudioRenderer, VideoTrack, useTracks, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useAuth } from '@/lib/auth-context';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardEditor, EMPTY_FEN, START_FEN } from '@/components/BoardEditor';
import { EvalBar } from '@/components/analiz/EvalBar';
import { StockfishEngine } from '@/lib/chess/stockfish';
import { scoreForWhite } from '@/lib/chess/analysisFormat';
import { NestedSectionAccordion } from '@/components/custom/NestedSectionAccordion';
import { AltKonuWalkthrough } from '@/components/custom/AltKonuWalkthrough';
import { OdevGonderInner } from '@/components/OdevGonderInner';
import { listCustomTabs, getCustomTab } from '@/lib/customTabsApi';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import { isAntrenorCalismalarTab } from '@/lib/customTabs/calismalarTab';
import {
  fetchLiveLesson, startLiveLesson, endLiveLesson, admitLiveLessonParticipant,
  fetchLiveLessonUsageEstimate,
} from '@/lib/liveLessonsApi';
import type { LiveLessonUsageEstimate } from '@/lib/liveLessonsApi';
import type { LiveLesson, LiveKitConnectionInfo } from '@/lib/liveLessonsApi';
import { fetchClassStudents } from '@/lib/homeworkApi';
import type { ClassStudent } from '@/lib/homeworkApi';
import { useLiveLessonRoom } from '@/lib/useLiveLessonRoom';
import type { ChatMessage } from '@/lib/useLiveLessonRoom';

const EVAL_DEPTH = 18;
const EVAL_MOVETIME_MS = 800;

/**
 * Madde 2026-09-15 (Online Dersler): antrenörün ders odası. LiveKit SADECE
 * ses/görüntü taşır (`LiveKitRoom`); paylaşılan tahta/katılım/sohbet
 * `useLiveLessonRoom`'un AYRI WebSocket'i üzerinden yürür.
 *
 * Madde 2026-09-16 (Antrenör Ekranı, Faz A): geniş masaüstü düzeni (tahta +
 * sağda katılımcılar paneli), ikon+renk tabanlı sustur/yetki kontrolleri,
 * "Hepsini Kapat", "söz hakkı istiyor" bildirimi, Ekran Ayarları.
 *
 * Madde 2026-09-16 (Faz B): "Anlatım Ortamı" — Analiz Tahtası (varsayılan,
 * hamle oynanan tahta + antrenörün tarayıcısında hesaplanan değerlendirme
 * çubuğu) / Konum Tahtası (BoardEditor, taş paleti ile serbest pozisyon
 * dizme — `resetBoard` üzerinden sporcuya canlı yayınlanır, YENİ bir WS
 * mesaj tipi gerekmedi). Antrenörün çizdiği ok/daire işaretleri de artık
 * sporcuya yayınlanıyor (sporcu tarafında GÖSTERİMİ henüz yok — sonraki
 * round).
 *
 * Madde 2026-09-16 (Faz C): "Anlatım Tahtası" — antrenörün KENDİ
 * "Çalışmalar" sekmesinin Düzey/Konu/Alt Konu ağacı (aynı `NestedSectionAccordion`,
 * route DEĞİŞTİRMEDEN — `onSelectAltKonu` ile) canlı ders içine gömülü.
 * Seçilen Alt Konu `AltKonuWalkthrough`'un kendisiyle (tahtası GİZLİ,
 * `hideBoard`) gösterilir; adım geçişleri ANA tahtayı (`room.resetBoard`)
 * günceller. "Ödev Gönder" de route DEĞİŞTİRMEDEN (aksi halde LiveKitRoom
 * unmount olup ses/görüntü bağlantısı kopardı) gömülü bir modalde açılır —
 * bkz. `OdevGonderInner` (odev-gonder/page.tsx'ten route-bağımsız hale
 * getirildi).
 *
 * Madde 2026-09-17 (Sporcu Ekranı, "Söz Hakkı İstiyor" v2): Faz A'daki
 * "sallanan el + dismiss edilebilir banner" tasarımı KALDIRILDI — yerine
 * katılımcı satırındaki 3. ikon (turuncu↔mavi) geldi. Antrenör mavi
 * ikona tıklarsa (`grantFloor`) sunucu diğer TÜM öğrencileri susturur,
 * söz isteyeni açar, sadece ona sesli anons tetikler; sporcu kendi
 * ikonuna tekrar basınca herkesin mikrofonu ÖNCEKİ duruma döner (bkz.
 * backend `_end_floor`).
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

function HandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 11V6a2 2 0 1 1 4 0v5M12 11V4a2 2 0 1 1 4 0v7M16 12V7a2 2 0 1 1 4 0v6c0 4-2 8-7 8h-1c-3.2 0-5-1.3-7-4.2l-1.6-2.4a1.6 1.6 0 0 1 2.5-1.9L8 12"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Madde 2026-09-17 (Sporcu Ekranı, "Söz Hakkı İstiyor" v2): katılımcı
 *  satırındaki 3. ikon — turuncu (istek yok) / mavi (istek var). */
function QuestionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 9a3 3 0 1 1 4 2.83c-.6.24-1 .85-1 1.5V14" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="17.5" x2="12" y2="17.51" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

interface ScreenSettings {
  camera: boolean;
  notation: boolean;
  evalBar: boolean;
  /** Madde 2026-09-18 (madde 3): sağdaki "LiveKit Kotası" kartını gösterip gizler. */
  kota: boolean;
}

type HostViewMode = 'analiz' | 'konum' | 'anlatim';

function HostRoomInner({ lessonId, lesson, students, onEnded }: {
  lessonId: number; lesson: LiveLesson; students: ClassStudent[]; onEnded: () => void;
}) {
  const room = useLiveLessonRoom(lessonId, true);
  const cameraTracks = useTracks([Track.Source.Camera]);
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [screen, setScreen] = useState<ScreenSettings>({ camera: true, notation: true, evalBar: true, kota: true });
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [hostViewMode, setHostViewMode] = useState<HostViewMode>('analiz');
  const engineRef = useRef<StockfishEngine | null>(null);
  const evalRequestRef = useRef(0);
  const [scoreCp, setScoreCp] = useState<number | null>(null);
  const [mate, setMate] = useState<number | null>(null);
  // Madde 2026-09-16 (Faz C): antrenörün "Çalışmalar" sekmesi — undefined =
  // henüz çekilmedi, null = bulunamadı. "Anlatım Tahtası" moduna İLK
  // geçişte tembel (lazy) yüklenir.
  const [calismalarTab, setCalismalarTab] = useState<CustomTabDetail | null | undefined>(undefined);
  const [selectedAltKonuId, setSelectedAltKonuId] = useState<number | null>(null);
  const [odevGonderSectionId, setOdevGonderSectionId] = useState<number | null>(null);
  // Madde 2026-09-17 (madde 6): LiveKit'in ücretsiz kotasına göre KABA
  // tahmin — gerçek API bu planda erişilemiyor (bkz. backend endpoint'i).
  const [usage, setUsage] = useState<LiveLessonUsageEstimate | null>(null);

  useEffect(() => () => { engineRef.current?.destroy(); }, []);

  // Madde 2026-09-18 (madde 4): backend zaten devam eden dersler için
  // (ended_at ?? now) - started_at hesaplıyor — yani şu anki oturumun
  // süresi ZATEN dahil. Sadece bir kere çekersek ekranda donuk kalır;
  // periyodik yeniden çekerek "canlı artan" bir toplam gösteriyoruz.
  useEffect(() => {
    fetchLiveLessonUsageEstimate().then(setUsage);
    const interval = setInterval(() => {
      fetchLiveLessonUsageEstimate().then(setUsage);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Madde 2026-09-17 (madde 4): "Anlatım Ortamları" birbirinden bağımsız —
  // mod değişince tahta o modun kendi varsayılanına sıfırlanır, bir önceki
  // moddaki konum diğerine TAŞINMAZ.
  function switchMode(mode: HostViewMode) {
    if (mode === hostViewMode) return;
    setHostViewMode(mode);
    if (mode === 'anlatim') {
      room.resetBoard(EMPTY_FEN);
      setSelectedAltKonuId(null);
    } else {
      room.resetBoard(START_FEN);
    }
  }

  useEffect(() => {
    if (hostViewMode !== 'anlatim' || calismalarTab !== undefined) return;
    (async () => {
      const tabs = await listCustomTabs();
      const found = tabs.find((t) => isAntrenorCalismalarTab(t));
      if (!found) { setCalismalarTab(null); return; }
      const detail = await getCustomTab(found.id);
      setCalismalarTab(detail);
    })();
  }, [hostViewMode, calismalarTab]);

  // Madde 2026-09-16 (Faz B): değerlendirme çubuğu — SADECE Analiz Tahtası
  // modunda ve açıkken çalışır (Konum Tahtası modunda tahta geçersiz/eksik
  // pozisyonlar içerebilir, motora göndermenin anlamı yok). Antrenörün
  // TARAYICISINDA hesaplanır, sporcuya YAYINLANMAZ.
  useEffect(() => {
    if (hostViewMode !== 'analiz' || !screen.evalBar) return;
    const requestId = ++evalRequestRef.current;
    (async () => {
      if (!engineRef.current) {
        const eng = new StockfishEngine();
        await eng.init();
        eng.setSkill(20);
        engineRef.current = eng;
      }
      const result = await engineRef.current.analyze(room.fen, EVAL_DEPTH, EVAL_MOVETIME_MS);
      if (requestId !== evalRequestRef.current) return;
      const sideToMove: 'w' | 'b' = room.fen.split(' ')[1] === 'b' ? 'b' : 'w';
      const white = scoreForWhite(result.scoreCp, result.mate, sideToMove);
      setScoreCp(white.cp);
      setMate(white.mate);
    })();
  }, [room.fen, hostViewMode, screen.evalBar]);

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

  function toggleScreen(key: keyof ScreenSettings) {
    setScreen((s) => ({ ...s, [key]: !s[key] }));
  }

  function startResize(e: React.PointerEvent) {
    resizeRef.current = { startY: e.clientY, startHeight: panelHeight ?? 320 };
    function onMove(ev: PointerEvent) {
      if (!resizeRef.current) return;
      const delta = ev.clientY - resizeRef.current.startY;
      setPanelHeight(Math.max(180, Math.min(800, resizeRef.current.startHeight + delta)));
    }
    function onUp() {
      resizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <main className="px-4 pt-6 pb-12 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold t-premium truncate">{lesson.title}</h1>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button type="button" onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            title={isMicrophoneEnabled ? 'Mikrofonumu kapat' : 'Mikrofonumu aç'}
            className="rounded-full p-1.5"
            style={{ background: isMicrophoneEnabled ? '#22c55e' : '#ef4444', color: '#fff' }}>
            <MicIcon muted={!isMicrophoneEnabled} />
          </button>
          <button type="button" onClick={handleEnd}
            className="rounded-lg px-3 py-2 text-xs font-bold"
            style={{ background: '#ef4444', color: '#fff' }}>
            Dersi Sonlandır
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[720px_1fr_1fr] items-start">
        <div className="space-y-4 min-w-0" style={{ maxWidth: 720 }}>
          {hostViewMode === 'analiz' && (
            <div className="flex items-stretch gap-2">
              {screen.evalBar && <EvalBar scoreCp={scoreCp} mate={mate} showMarker />}
              <div style={{ width: '100%', marginLeft: 50 }}>
                <ChessBoard fen={room.fen} interactive onPieceDrop={handleDrop} boardOrientation="white"
                  hideNotation={!screen.notation}
                  onArrowsChange={room.sendArrows} onMarksChange={room.sendMarks} />
              </div>
            </div>
          )}

          {hostViewMode === 'konum' && (
            <BoardEditor
              fen={room.fen}
              turn={room.fen.split(' ')[1] === 'b' ? 'b' : 'w'}
              onChange={(fen) => room.resetBoard(fen)}
              onTurnChange={() => {}}
              paletteLayout="split"
              onArrowsChange={room.sendArrows}
              onMarksChange={room.sendMarks}
            />
          )}

          {hostViewMode === 'anlatim' && (
            <>
              {/* Madde 2026-09-16 (Faz C): "numaralı adım geçişleri ana
                  tahtayı günceller" — bu, ANA (sol sütun) tahta; salt-okunur
                  (Anlatım Tahtası'nda taş oynanmaz, sadece hazır konumlar
                  gösterilir). */}
              <ChessBoard fen={room.fen} boardOrientation="white" hideNotation={!screen.notation}
                onArrowsChange={room.sendArrows} onMarksChange={room.sendMarks} />

              <div className="t-card p-3 space-y-3">
                {calismalarTab === undefined && <p className="text-xs t-muted">Çalışmalar sekmesi yükleniyor…</p>}
                {calismalarTab === null && <p className="text-xs t-muted">Çalışmalar sekmesi bulunamadı.</p>}
                {calismalarTab && selectedAltKonuId == null && (
                  <NestedSectionAccordion
                    tabId={calismalarTab.id} sections={calismalarTab.sections} parentId={null} depth={0}
                    onSelectAltKonu={setSelectedAltKonuId}
                  />
                )}
                {calismalarTab && selectedAltKonuId != null && (() => {
                  const section = calismalarTab.sections.find((s) => s.id === selectedAltKonuId);
                  if (!section) return <p className="text-xs t-muted">Bölüm bulunamadı.</p>;
                  return (
                    <div className="space-y-3">
                      <button type="button" onClick={() => setSelectedAltKonuId(null)}
                        className="text-xs t-muted underline">← Konu listesine dön</button>
                      <AltKonuWalkthrough
                        pool={section.position_pool ?? []}
                        sourceSectionId={section.id}
                        sourceSectionTitle={section.title}
                        sourceTabId={calismalarTab.id}
                        linkedLessonStepId={section.linked_lesson_step_id ?? null}
                        hideBoard
                        onStepChange={(fen) => room.resetBoard(fen)}
                        onSendHomework={() => setOdevGonderSectionId(section.id)}
                      />
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {screen.notation && (
            <div className="t-card p-3">
              <p className="text-xs font-bold uppercase tracking-widest t-muted mb-2">Notasyon</p>
              {room.sanHistory.length === 0 ? (
                <p className="text-xs t-muted">Henüz hamle yok.</p>
              ) : (
                <p className="text-sm font-mono leading-relaxed">
                  {room.sanHistory.map((san, i) => (
                    <span key={i}>
                      {i % 2 === 0 && <span className="t-muted">{Math.floor(i / 2) + 1}. </span>}
                      {san}{' '}
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="t-card p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest t-muted">Anlatım Ortamı</p>
            <div className="grid grid-cols-2 gap-1.5">
              <ModeButton label="Analiz Tahtası" active={hostViewMode === 'analiz'}
                onClick={() => switchMode('analiz')} />
              <ModeButton label="Konum Tahtası" active={hostViewMode === 'konum'}
                onClick={() => switchMode('konum')} />
              <ModeButton label="Anlatım Tahtası" active={hostViewMode === 'anlatim'}
                onClick={() => switchMode('anlatim')} />
            </div>
          </div>

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
            <p className="text-xs font-bold uppercase tracking-widest t-muted">Ekran Ayarları</p>
            <div className="grid grid-cols-2 gap-1.5">
              <ScreenToggle label="Kamera" on={screen.camera} onClick={() => toggleScreen('camera')} />
              <ScreenToggle label="Notasyon" on={screen.notation} onClick={() => toggleScreen('notation')} />
              <ScreenToggle label="Değerlendirme" on={screen.evalBar} onClick={() => toggleScreen('evalBar')} />
              <ScreenToggle label="LiveKit Kotası" on={screen.kota} onClick={() => toggleScreen('kota')} />
            </div>
          </div>

          <div className="t-card p-3 space-y-2 flex flex-col" style={panelHeight ? { height: panelHeight } : undefined}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-widest t-muted">
                Katılımcılar ({room.connectedChildIds.length})
              </p>
              {room.connectedChildIds.length > 0 && (
                <button type="button" onClick={() => room.muteAll()}
                  className="rounded-lg px-2 py-1 text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)' }}>
                  Hepsini Kapat
                </button>
              )}
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {room.connectedChildIds.length === 0 && <p className="text-xs t-muted">Henüz katılan yok.</p>}
              {room.connectedChildIds.map((cid) => {
                const muted = room.mutedChildIds.has(cid);
                const controlling = room.controllerChildId === cid;
                const raised = room.handRaisedIds.has(cid);
                return (
                  <div key={cid} className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${raised ? 'request-floor-blink' : ''}`}
                      style={{ color: raised ? '#2563eb' : undefined, fontWeight: raised ? 700 : undefined }}>
                      {studentName(cid)}
                    </span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button type="button" title={controlling ? 'Taş yetkisini al' : 'Taş oynatma yetkisi ver'}
                        onClick={() => (controlling ? room.revokeControl() : room.grantControl(cid))}
                        className="rounded-full p-1.5" style={{
                          background: controlling ? '#22c55e' : '#ef4444', color: '#fff',
                        }}>
                        <HandIcon />
                      </button>
                      <button type="button" title={muted ? 'Sesi aç' : 'Sustur'}
                        onClick={() => room.muteChild(cid, !muted)}
                        className="rounded-full p-1.5" style={{
                          background: muted ? '#ef4444' : '#22c55e', color: '#fff',
                        }}>
                        <MicIcon muted={muted} />
                      </button>
                      <button type="button" title={raised ? 'Söz hakkı ver' : 'Söz hakkı istemiyor'}
                        disabled={!raised} onClick={() => room.grantFloor(cid)}
                        className={`rounded-full p-1.5 disabled:cursor-not-allowed ${raised ? 'request-floor-blink' : ''}`}
                        style={{ background: raised ? '#2563eb' : '#f97316', color: '#fff' }}>
                        <QuestionIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div onPointerDown={startResize}
              className="mx-auto w-10 h-1.5 rounded-full cursor-ns-resize flex-shrink-0"
              style={{ background: 'var(--t-border)' }} />
          </div>
        </div>

        <div className="space-y-4">
          {screen.camera && cameraTracks.length > 0 && hostViewMode === 'analiz' && (
            <div className="grid grid-cols-1 gap-2">
              {cameraTracks.map((t) => (
                <VideoTrack key={t.publication?.trackSid ?? t.participant.identity} trackRef={t}
                  className="rounded-lg w-full aspect-video object-cover" />
              ))}
            </div>
          )}

          {screen.kota && usage && (
            <div className="t-card p-3 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest t-muted">LiveKit Kotası (tahmini)</p>
              <p className="text-sm font-bold">
                Bu ay ~{usage.estimated_minutes} dk / {usage.free_tier_minutes} dk
              </p>
              <p className="text-[11px] t-muted">
                Bu sayı odanın açık kaldığı süreye dayanır — LiveKit gerçek kotayı
                katılımcı başına bağlantı dakikası sayar, bu yüzden birden çok
                sporcu katılan derslerde gerçek kullanım bu rakamdan yüksek olabilir.
              </p>
            </div>
          )}

          <ChatPanel messages={room.chatMessages} onSend={room.sendChat} />
        </div>
      </div>

      {odevGonderSectionId != null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-xl mt-8 rounded-2xl overflow-hidden t-card">
            <div className="flex justify-end p-2">
              <button type="button" onClick={() => setOdevGonderSectionId(null)} aria-label="Kapat"
                className="rounded-lg px-2.5 py-1 text-xs font-bold"
                style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)' }}>
                ✕
              </button>
            </div>
            <OdevGonderInner sectionId={odevGonderSectionId} onClose={() => setOdevGonderSectionId(null)} />
          </div>
        </div>
      )}
    </main>
  );
}

function ModeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-lg px-2.5 py-1.5 text-xs font-bold"
      style={{
        background: active ? 'var(--t-accent)' : 'var(--t-surface-2)',
        color: active ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
      }}>
      {label}
    </button>
  );
}

function ScreenToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-lg px-2.5 py-1.5 text-xs font-bold"
      style={{ background: on ? '#22c55e' : '#ef4444', color: on ? '#0a0a0a' : '#fff' }}>
      {label}
    </button>
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

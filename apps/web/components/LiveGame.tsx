'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { useBoardNotation } from '@/lib/board-notation-context';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';
import { canOfferDraw, offersLeft } from '@/lib/play/drawOffers';
import { PracticeMatchLayout } from '@/components/play/PracticeMatchLayout';
import type { PracticeAction, PracticeOutcome } from '@/components/play/PracticeMatchLayout';
import type { PlayerInfo } from '@/components/play/MatchLayout';
import { MoveList } from '@/components/play/MoveList';
import { PromotionPicker } from '@/components/play/PromotionPicker';
import { isPromotionMove, toUci } from '@/lib/play/promotion';
import { playMoveSound } from '@/lib/sounds/pieceSounds';
import type { PromotionPiece } from '@/lib/play/promotion';
import { fensFromSan } from '@/lib/play/moveNavigation';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';
import { HistoryBanner } from '@/components/play/HistoryBanner';
import { resolvePremove } from '@/lib/play/premove';
import type { Premove } from '@/lib/play/premove';

interface Props { gameId: number; myColor: 'white' | 'black'; }

/** Backend'deki FIRST_MOVE_TIMEOUT_SECONDS ile AYNI (madde 4) — yalnızca
 *  görsel geri sayım için; gerçek iptal kararı sunucuda verilir. */
const FIRST_MOVE_TIMEOUT_SECONDS = 15;

/** Sunucudan gelen '1-0'/'0-1'/'1/2-1/2' sonucunu BENİM açımdan kazandım/
 *  berabere/kaybettim'e çevirir (madde 3, 2026-08-20) — geri bildirim
 *  kartının rengini/metnini belirler. Sonuç yoksa (mac hâlâ sürüyor) null. */
function outcomeFor(result: string | undefined, myColor: 'white' | 'black'): PracticeOutcome | null {
  if (result === '1/2-1/2') return 'draw';
  if (result === '1-0') return myColor === 'white' ? 'win' : 'loss';
  if (result === '0-1') return myColor === 'black' ? 'win' : 'loss';
  return null;
}

export function LiveGame({ gameId, myColor }: Props) {
  const router = useRouter();
  const { hideNotation } = useBoardNotation();
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [status, setStatus] = useState<'active' | 'over'>('active');
  const [info, setInfo] = useState<string>('');
  const [rawResult, setRawResult] = useState<string | undefined>(undefined);
  /** Madde 3 (2026-08-20): "Tekrar Oyna" — ben teklif ettim, rakip bekleniyor. */
  const [rematchOffered, setRematchOffered] = useState(false);
  /** Rakip teklif etti, benim Kabul/Reddet cevabım bekleniyor. */
  const [rematchIncoming, setRematchIncoming] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [myOffersUsed, setMyOffersUsed] = useState(0);
  const [whiteName, setWhiteName] = useState('Sporcu');
  const [blackName, setBlackName] = useState('Sporcu');
  const [whiteAvatar, setWhiteAvatar] = useState('default');
  const [blackAvatar, setBlackAvatar] = useState('default');
  const [whiteMs, setWhiteMs] = useState<number | null>(null);
  const [blackMs, setBlackMs] = useState<number | null>(null);
  const [whiteToMove, setWhiteToMove] = useState(true);
  const [sanList, setSanList] = useState<string[]>([]);
  const [startFen, setStartFen] = useState<string | null>(null);
  const [pending, setPending] = useState<{ from: Square; to: Square } | null>(null);
  const [premove, setPremove] = useState<Premove | null>(null);
  /** Madde 4: ilk hamle için görsel geri sayım — null = gösterilmiyor. */
  const [firstMoveCountdown, setFirstMoveCountdown] = useState<number | null>(null);
  /** WebSocket geri çağrısı eski closure'ı görebilir; ref ile ikizlenir. */
  const premoveRef = useRef<Premove | null>(null);

  function choosePremove(from: Square, to: Square) {
    const pm = { from, to };
    premoveRef.current = pm;
    setPremove(pm);
  }

  function clearPremove() {
    premoveRef.current = null;
    setPremove(null);
  }

  /** Bayrak bir kez gonderilir; her tikta tekrar gonderilmez. */
  const flagSentRef = useRef(false);

  // LiveGame'de chess.load() gecmisi siler; bu yuzden gezinme SUNUCUDAN
  // gelen sanList uzerinden yeniden kurulur (chessRef.history() KULLANILMAZ).
  const fens = useMemo(() => fensFromSan(startFen, sanList), [startFen, sanList]);
  const nav = useMoveHistoryNav(fens);

  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token ? `${wsBase()}/ws/game/${gameId}?token=${encodeURIComponent(token)}` : null;

  const { send } = useWebSocket(url, (data: unknown) => {
    const msg = data as {
      type?: string;
      fen_after?: string;
      is_checkmate?: boolean;
      is_stalemate?: boolean;
      result?: string;
      by_resign?: boolean;
      offers_used?: number;
      max_offers?: number;
      white_name?: string;
      black_name?: string;
      white_avatar?: string;
      black_avatar?: string;
      white_ms?: number;
      black_ms?: number;
      increment_ms?: number;
      white_to_move?: boolean;
      current_fen?: string;
      start_fen?: string | null;
      moves?: string[];
      san?: string;
      fen?: string;
      message?: string;
      status?: string;
      reason?: string;
      by_child_id?: number;
      game_id?: number;
      white_id?: number;
      black_id?: number;
    };
    const t = msg?.type;
    if (t === 'move_made') {
      // Madde 4: ilk hamle geldi — geri sayım artık anlamsız, kapanır.
      setFirstMoveCountdown(null);
      const chess = chessRef.current;
      // chess.load() gecmisi SILER; notasyon bu yuzden ayrica biriktirilir.
      if (typeof msg.san === 'string') setSanList((p) => [...p, msg.san as string]);
      if (msg.fen_after && chess.fen() !== msg.fen_after) {
        try {
          chess.load(msg.fen_after); setFen(msg.fen_after);
          // Madde 2: SADECE rakibin hamlesinde caliyor — kendi hamlem icin
          // asagida applyMyMove zaten calar, burda tekrar etmez cunku
          // chess.fen() bu noktada zaten esitlenmis olur.
          playMoveSound();
          // Madde 5: rakip oynadı, sıra bana geldi — ön-hamle varsa oynanır.
          const myTurnNow = (chess.turn() === 'w' && myColor === 'white')
            || (chess.turn() === 'b' && myColor === 'black');
          if (myTurnNow) {
            const pm = resolvePremove(chess.fen(), premoveRef.current);
            clearPremove();
            if (pm) applyMyMove(pm.from, pm.to);
          }
        } catch { /* ignore */ }
      }
      // Mat/pat'ta sonuc satiri game_over mesajiyla gelir; burada sadece bilgi.
      if (msg.is_checkmate) { setStatus('over'); setInfo('Mat! Oyun bitti.'); }
      else if (msg.is_stalemate) { setStatus('over'); setInfo('Pat!'); }
    } else if (t === 'game_info') {
      setWhiteName(String(msg.white_name ?? 'Sporcu'));
      setBlackName(String(msg.black_name ?? 'Sporcu'));
      setWhiteAvatar(typeof msg.white_avatar === 'string' ? msg.white_avatar : 'default');
      setBlackAvatar(typeof msg.black_avatar === 'string' ? msg.black_avatar : 'default');
      setWhiteMs(typeof msg.white_ms === 'number' ? msg.white_ms : null);
      setBlackMs(typeof msg.black_ms === 'number' ? msg.black_ms : null);
      setWhiteToMove(msg.white_to_move !== false);
      // Acilis pratiginde tahta standart konumdan BASLAMAZ; sunucunun
      // bildirdigi konuma kurulur. Yeniden baglanmada da dogru konum gelir.
      setStartFen(typeof msg.start_fen === 'string' ? msg.start_fen : null);
      if (Array.isArray(msg.moves)) setSanList(msg.moves.map(String));
      // Madde 4: hiç hamle yokken (mac yeni basladi) gorsel geri sayim baslar.
      // Gercek iptal karari sunucuda (FIRST_MOVE_TIMEOUT_SECONDS) — bu SADECE gorseldir.
      setFirstMoveCountdown(
        Array.isArray(msg.moves) && msg.moves.length === 0 && msg.status === 'active'
          ? FIRST_MOVE_TIMEOUT_SECONDS
          : null,
      );
      // Mac bitmisse ekran bunu SOYLER; aksi halde sporcu bitmis macta
      // hamle yapmaya calisip "olmuyor" der.
      if (msg.status && msg.status !== 'active') {
        setStatus('over');
        setRawResult(msg.result);
        // Madde 4: iptal edilmis maca SONRADAN baglanan sporcu da (game_aborted
        // yayinini kacirmis olsa bile) nedeni gorsun — bos ekranla kalmasin.
        if (msg.status === 'aborted') {
          setInfo(`İlk hamle ${FIRST_MOVE_TIMEOUT_SECONDS} saniye içinde yapılmadığı için maç iptal edildi.`);
        }
      }
      if (typeof msg.current_fen === 'string' && msg.current_fen) {
        try { chessRef.current.load(msg.current_fen); setFen(msg.current_fen); }
        catch { /* bozuk FEN gelirse standart konumda kalinir */ }
      }
    } else if (t === 'clock') {
      // Sunucudan gelen deger YEREL sayimin UZERINE yazilir — otorite sunucu.
      setWhiteMs(typeof msg.white_ms === 'number' ? msg.white_ms : null);
      setBlackMs(typeof msg.black_ms === 'number' ? msg.black_ms : null);
      setWhiteToMove(msg.white_to_move !== false);
      flagSentRef.current = false;   // yeni hamle: bayrak hakki tazelenir
    } else if (t === 'game_over') {
      setStatus('over');
      setRawResult(msg.result);
      setInfo(msg.by_resign ? 'Maç terk edildi.' : '');
    } else if (t === 'game_aborted') {
      // Madde 4: sunucu 10sn'de ilk hamle gelmediğine karar verdi, mac iptal.
      setFirstMoveCountdown(null);
      setStatus('over');
      setInfo(`İlk hamle ${FIRST_MOVE_TIMEOUT_SECONDS} saniye içinde yapılmadığı için maç iptal edildi.`);
    } else if (t === 'opponent_disconnected') {
      setInfo('Rakip bağlantısı koptu.');
    } else if (t === 'invalid_move' || t === 'error') {
      // Sunucu hamleyi kabul etmedi. Iyimser oynadigimiz tas GERI ALINIR ve
      // tahta sunucunun konumuna donerr; yoksa istemci sunucudan kopar ve
      // sporcu bir daha hamle yapamaz (bildirilen "2. hamle olmuyor").
      resyncTo(msg.fen);
      setInfo(msg.message === 'not_your_turn'
        ? 'Sıra sende değil.'
        : 'Bu hamle kabul edilmedi.');
    } else if (t === 'draw_offered') {
      setDrawOffered(true);
    } else if (t === 'draw_declined') {
      setInfo('Rakip beraberlik teklifini reddetti.');
    } else if (t === 'draw_offer_sent') {
      setMyOffersUsed(msg.offers_used ?? 0);
      setInfo('Beraberlik teklifi gönderildi.');
    } else if (t === 'draw_offer_rejected') {
      setMyOffersUsed(msg.max_offers ?? 3);
      setInfo('Beraberlik teklif hakkın kalmadı.');
    } else if (t === 'rematch_offered') {
      // Madde 3 (2026-08-20): rakip "Tekrar Oyna" teklif etti, cevabım bekleniyor.
      setRematchIncoming(true);
    } else if (t === 'rematch_declined') {
      setRematchOffered(false);
      setInfo('Rakip yeniden oynamak istemedi.');
    } else if (t === 'rematch_ready' && typeof msg.game_id === 'number') {
      // Renkler yeni maçta TAKAS edilir (sunucu tarafında) — bu yüzden
      // yönlendirme de rengimi çevirerek yapılır, child_id bilmeye gerek yok.
      const newColor = myColor === 'white' ? 'black' : 'white';
      router.push(`/play/online/${msg.game_id}?color=${newColor}`);
    }
  });

  // Madde 4: ilk hamle geri sayımı da YEREL/GÖRSELDİR — gerçek iptal kararını
  // sunucu verir (game_aborted mesajı). 0'da durur, negatife inmez.
  // TEK bir setInterval — her tikte YENİDEN kurulan setTimeout DEĞİL (mevcut
  // saat efekti ile aynı desen); "aktif mi" bilgisi ayrı bir bağımlılık
  // olarak tutulur ki interval her azalışta yeniden kurulup bozulmasın.
  const countdownActive = firstMoveCountdown !== null && status === 'active';
  useEffect(() => {
    if (!countdownActive) return;
    const id = setInterval(() => {
      setFirstMoveCountdown((v) => (v === null || v <= 0 ? v : v - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [countdownActive]);

  // YEREL geri sayim SADECE GORSELDIR. Gercek sure sunucuda; her hamlede
  // gelen 'clock' mesaji bu degerin uzerine yazar.
  const clockless = whiteMs === null || blackMs === null;
  useEffect(() => {
    if (clockless || status !== 'active') return;
    const id = setInterval(() => {
      if (whiteToMove) setWhiteMs((v) => (v === null ? v : Math.max(0, v - 100)));
      else setBlackMs((v) => (v === null ? v : Math.max(0, v - 100)));
    }, 100);
    return () => clearInterval(id);
  }, [whiteToMove, clockless, status]);

  // 'flag' YALNIZCA sira RAKIPTEYKEN ve onun saati bitince gonderilir.
  // Kimse kendi yenilgisini bildirmez. Bir kez gonderilir.
  useEffect(() => {
    if (clockless || status !== 'active' || flagSentRef.current) return;
    const iAmWhite = myColor === 'white';
    const opponentToMove = iAmWhite ? !whiteToMove : whiteToMove;
    const opponentMs = iAmWhite ? blackMs : whiteMs;
    if (opponentToMove && opponentMs !== null && opponentMs <= 0) {
      flagSentRef.current = true;
      send({ type: 'flag' });
    }
  }, [whiteMs, blackMs, whiteToMove, clockless, status, myColor, send]);

  /** Tahtayi sunucunun bildirdigi konuma sabitler. FEN gelmediyse en azindan
   *  son gecerli konuma geri doner. */
  function resyncTo(serverFen?: string) {
    const chess = chessRef.current;
    if (serverFen) {
      try { chess.load(serverFen); } catch { chess.undo(); }
    } else {
      chess.undo();
    }
    const now = chess.fen();
    setFen(now);
    setWhiteToMove(now.split(' ')[1] === 'w');
  }

  function applyMyMove(from: Square, to: Square, promo?: PromotionPiece): boolean {
    const chess = chessRef.current;
    let move;
    try { move = chess.move({ from, to, promotion: promo }); } catch { return false; }
    if (!move) return false;
    setFen(chess.fen());
    clearPremove(); // yeni hamle yapıldı, eski ön-hamle geçersiz.
    playMoveSound(); // madde 2: kendi hamlemde aninda ses.
    // Notasyona BURADA eklenmez: room.broadcast exclude kullanmiyor, kendi
    // hamlem de move_made ile geri geliyor — eklersem liste ikiye katlanir.
    // Terfi harfi UCI'ye MUTLAKA girer, yoksa sunucu vezire terfi eder.
    send({ type: 'move', uci: toUci(from, to, promo) });
    return true;
  }

  function handleDrop(from: Square, to: Square): boolean {
    if (status !== 'active') return false;
    const chess = chessRef.current;
    const myTurn = (chess.turn() === 'w' && myColor === 'white') || (chess.turn() === 'b' && myColor === 'black');
    if (!myTurn) return false;
    // Terfide once tas sorulur (madde 2).
    if (isPromotionMove(chess.get(from), to)) {
      setPending({ from, to });
      return false;
    }
    return applyMyMove(from, to);
  }

  const canOffer = canOfferDraw(myOffersUsed);
  const iAmWhite = myColor === 'white';
  const top: PlayerInfo = {
    avatarId: iAmWhite ? blackAvatar : whiteAvatar,
    name: iAmWhite ? blackName : whiteName,
    ms: iAmWhite ? blackMs : whiteMs,
    active: status === 'active' && (iAmWhite ? !whiteToMove : whiteToMove),
  };
  const bottom: PlayerInfo = {
    avatarId: iAmWhite ? whiteAvatar : blackAvatar,
    name: iAmWhite ? whiteName : blackName,
    ms: iAmWhite ? whiteMs : blackMs,
    active: status === 'active' && (iAmWhite ? whiteToMove : !whiteToMove),
  };

  // Madde 3 (2026-08-20): Açılış Pratiği'yle AYNI tasarım — 3 dairesel eylem
  // kartı (Beraberlik/Terk Et/Tekrar Oyna) + renkli geri bildirim kartı.
  const actions: PracticeAction[] = [
    {
      icon: '🤝',
      label: `Beraberlik Teklif Et (${offersLeft(myOffersUsed)})`,
      onClick: () => send({ type: 'offer_draw' }),
      enabled: status === 'active' && canOffer,
    },
    {
      icon: '🏳️',
      label: 'Terk Et',
      onClick: () => {
        if (confirm('Maçı terk etmek istiyor musun? Maçı kaybedeceksin.')) send({ type: 'resign' });
      },
      enabled: status === 'active',
    },
    {
      icon: '🔁',
      label: 'Tekrar Oyna',
      onClick: () => { send({ type: 'rematch_offer' }); setRematchOffered(true); },
      enabled: status === 'over' && !rematchOffered && !rematchIncoming,
    },
  ];

  return (
    <PracticeMatchLayout
      top={top}
      bottom={bottom}
      outcome={status === 'over' ? outcomeFor(rawResult, myColor) : null}
      outcomeText={{ win: 'Kazandın', loss: 'Rakip Kazandı' }}
      actions={actions}
      board={
        <div style={{ position: 'relative' }}>
          <ChessBoard
            fen={nav.isLive ? fen : nav.viewFen}
            interactive={status === 'active' && nav.isLive}
            onPieceDrop={handleDrop}
            boardOrientation={myColor}
            onWheelStep={nav.step}
            historyView={!nav.isLive}
            onLeaveHistory={nav.goLive}
            onPremove={choosePremove}
            premoveColor={myColor === 'white' ? 'w' : 'b'}
            premoveSquares={premove}
            hideNotation={hideNotation}
          />
          {firstMoveCountdown !== null && (
            <div
              role="timer"
              aria-label={`İlk hamle için ${firstMoveCountdown} saniye kaldı`}
              className="t-card-i"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                padding: '0.7rem 1.8rem',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: '1.8rem',
                background: 'var(--t-surface)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              }}
            >
              <span aria-hidden="true">⏳</span>
              <span>İlk hamle: {firstMoveCountdown}sn</span>
            </div>
          )}
          <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
        </div>
      }
      moveList={
        <MoveList
          san={sanList}
          startFen={startFen}
          onSelectPly={nav.goTo}
          activePly={nav.isLive ? undefined : nav.viewIndex}
        />
      }
      extra={
        <>
          {pending && (
            <PromotionPicker
              onPick={(piece) => {
                const p = pending;
                setPending(null);
                applyMyMove(p.from, p.to, piece);
              }}
              onCancel={() => setPending(null)}
            />
          )}

          {drawOffered && status === 'active' && (
            <div className="t-ok p-3 space-y-2">
              <p className="text-sm font-semibold">Rakip beraberlik teklif etti</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { send({ type: 'accept_draw' }); setDrawOffered(false); }}
                  className="t-btn px-4 py-2 text-sm"
                >
                  Kabul Et
                </button>
                <button
                  type="button"
                  onClick={() => { send({ type: 'decline_draw' }); setDrawOffered(false); }}
                  className="t-btn-ghost px-4 py-2 text-sm"
                >
                  Kabul Etme
                </button>
              </div>
            </div>
          )}

          {rematchIncoming && (
            <div className="t-ok p-3 space-y-2">
              <p className="text-sm font-semibold">Rakip yeniden oynamak istiyor</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { send({ type: 'rematch_accept' }); setRematchIncoming(false); }}
                  className="t-btn px-4 py-2 text-sm"
                >
                  Kabul Et
                </button>
                <button
                  type="button"
                  onClick={() => { send({ type: 'rematch_decline' }); setRematchIncoming(false); }}
                  className="t-btn-ghost px-4 py-2 text-sm"
                >
                  Kabul Etme
                </button>
              </div>
            </div>
          )}
          {rematchOffered && !rematchIncoming && (
            <p className="text-center text-sm t-muted">Rakip bekleniyor…</p>
          )}

          {info && <p className="text-center text-sm t-muted">{info}</p>}
        </>
      }
    />
  );
}

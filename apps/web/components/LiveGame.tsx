'use client';
import { useState, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';
import { formatGameResult } from '@/lib/play/resultText';
import { canOfferDraw, offersLeft } from '@/lib/play/drawOffers';
import { PlayerClock } from '@/components/play/PlayerClock';

interface Props { gameId: number; myColor: 'white' | 'black'; }

export function LiveGame({ gameId, myColor }: Props) {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [status, setStatus] = useState<'active' | 'over'>('active');
  const [info, setInfo] = useState<string>('');
  const [resultLine, setResultLine] = useState<string>('');
  const [drawOffered, setDrawOffered] = useState(false);
  const [myOffersUsed, setMyOffersUsed] = useState(0);
  const [whiteName, setWhiteName] = useState('Sporcu');
  const [blackName, setBlackName] = useState('Sporcu');
  const [whiteMs, setWhiteMs] = useState<number | null>(null);
  const [blackMs, setBlackMs] = useState<number | null>(null);
  const [whiteToMove, setWhiteToMove] = useState(true);
  /** Bayrak bir kez gonderilir; her tikta tekrar gonderilmez. */
  const flagSentRef = useRef(false);

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
      white_ms?: number;
      black_ms?: number;
      increment_ms?: number;
      white_to_move?: boolean;
      current_fen?: string;
    };
    const t = msg?.type;
    if (t === 'move_made') {
      const chess = chessRef.current;
      if (msg.fen_after && chess.fen() !== msg.fen_after) {
        try { chess.load(msg.fen_after); setFen(msg.fen_after); } catch { /* ignore */ }
      }
      // Mat/pat'ta sonuc satiri game_over mesajiyla gelir; burada sadece bilgi.
      if (msg.is_checkmate) { setStatus('over'); setInfo('Mat! Oyun bitti.'); }
      else if (msg.is_stalemate) { setStatus('over'); setInfo('Pat!'); }
    } else if (t === 'game_info') {
      setWhiteName(String(msg.white_name ?? 'Sporcu'));
      setBlackName(String(msg.black_name ?? 'Sporcu'));
      setWhiteMs(typeof msg.white_ms === 'number' ? msg.white_ms : null);
      setBlackMs(typeof msg.black_ms === 'number' ? msg.black_ms : null);
      setWhiteToMove(msg.white_to_move !== false);
      // Acilis pratiginde tahta standart konumdan BASLAMAZ; sunucunun
      // bildirdigi konuma kurulur. Yeniden baglanmada da dogru konum gelir.
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
      setResultLine(formatGameResult(msg.result));
      setInfo(msg.by_resign ? 'Maç terk edildi.' : '');
    } else if (t === 'opponent_disconnected') {
      setInfo('Rakip bağlantısı koptu.');
    } else if (t === 'invalid_move') {
      setFen(chessRef.current.fen());
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
    }
  });

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

  function handleDrop(from: Square, to: Square): boolean {
    if (status !== 'active') return false;
    const chess = chessRef.current;
    const myTurn = (chess.turn() === 'w' && myColor === 'white') || (chess.turn() === 'b' && myColor === 'black');
    if (!myTurn) return false;
    let move;
    try { move = chess.move({ from, to, promotion: 'q' }); } catch { return false; }
    if (!move) return false;
    setFen(chess.fen());
    send({ type: 'move', uci: `${from}${to}` });
    return true;
  }

  const canOffer = canOfferDraw(myOffersUsed);

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-3">
      <PlayerClock
        name={myColor === 'white' ? blackName : whiteName}
        ms={myColor === 'white' ? blackMs : whiteMs}
        active={myColor === 'white' ? !whiteToMove : whiteToMove}
      />

      <ChessBoard fen={fen} interactive={status === 'active'} onPieceDrop={handleDrop} boardOrientation={myColor} />

      <PlayerClock
        name={myColor === 'white' ? whiteName : blackName}
        ms={myColor === 'white' ? whiteMs : blackMs}
        active={myColor === 'white' ? whiteToMove : !whiteToMove}
      />

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

      {status === 'over' ? (
        <div className="t-ok p-4 text-center space-y-1">
          {resultLine && <p className="text-lg font-bold">{resultLine}</p>}
          {info && <p className="text-sm t-muted">{info}</p>}
        </div>
      ) : (
        <>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              disabled={!canOffer}
              onClick={() => send({ type: 'offer_draw' })}
              className="t-btn-ghost px-4 py-2 text-sm disabled:opacity-40"
            >
              Beraberlik Teklif Et ({offersLeft(myOffersUsed)})
            </button>
            <button
              type="button"
              onClick={() => { if (confirm('Maçı terk etmek istiyor musun? Maçı kaybedeceksin.')) send({ type: 'resign' }); }}
              className="t-btn px-4 py-2 text-sm"
              style={{ background: 'var(--t-err-bg, #ef4444)', color: '#fff' }}
            >
              Terk Et
            </button>
          </div>
          {info && <p className="text-center text-sm t-muted">{info}</p>}
        </>
      )}
    </div>
  );
}

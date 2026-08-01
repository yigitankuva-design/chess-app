'use client';
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { MatchHeader } from '@/components/play/MatchHeader';
import { MoveList } from '@/components/play/MoveList';
import { PromotionPicker } from '@/components/play/PromotionPicker';
import { isPromotionMove, promotionFromUci, toUci } from '@/lib/play/promotion';
import { playMoveSound } from '@/lib/sounds/pieceSounds';
import { botAcceptsDraw } from '@/lib/play/botDraw';
import { canOfferDraw, offersLeft } from '@/lib/play/drawOffers';
import type { PromotionPiece } from '@/lib/play/promotion';
import { ChessBoard } from './ChessBoard';
import { StockfishEngine } from '@/lib/chess/stockfish';
import { getToken, getAthleteName } from '@/lib/auth-storage';

export interface TimeControl {
  base: number;       // seconds on the clock at start
  increment: number;  // seconds added after each move
  label: string;      // e.g. "5+3"
}

interface Props {
  skillLevel: number;
  depth: number;
  timeControl?: TimeControl | null;
  /** Sporcunun oynadigi renk (madde f). Varsayilan 'w' — eski cagrilar bozulmaz. */
  studentColor?: 'w' | 'b';
  /** Acilis pratigi icin baslangic pozisyonu. Verilmezse standart baslangic. */
  startFen?: string;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function BotGame({ skillLevel, depth, timeControl, studentColor = 'w', startFen, onGameEnd }: Props) {
  const chessRef = useRef(new Chess(startFen));
  const botColor = studentColor === 'w' ? 'b' : 'w';
  const engineRef = useRef<StockfishEngine | null>(null);
  const gameIdRef = useRef<number | null>(null);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [pending, setPending] = useState<{ from: Square; to: Square } | null>(null);
  /** Madde 6: bota karsi da terk ve beraberlik hakki. Hak sayisi insan
   *  maclariyla AYNI kuraldan gelir (drawOffers.ts) — iki yerde iki sayi olmaz. */
  const [drawOffersUsed, setDrawOffersUsed] = useState(0);
  const [drawNote, setDrawNote] = useState('');
  // Sporcunun adi girişte saklaniyor; yoksa nötr bir etiket kullanilir.
  const [studentName] = useState(() => getAthleteName() || 'Sen');
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState<'loading' | 'playing' | 'over'>('loading');
  const [resultText, setResultText] = useState<string>('');

  const tc = timeControl ?? null;
  const [whiteTime, setWhiteTime] = useState(tc ? tc.base : 0);
  const [blackTime, setBlackTime] = useState(tc ? tc.base : 0);

  // ── Engine + backend game setup ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const eng = new StockfishEngine();
      await eng.init();
      eng.setSkill(skillLevel);
      engineRef.current = eng;

      try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/games/bot/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ skill_level: skillLevel }),
        });
        if (res.ok) {
          const data = await res.json();
          gameIdRef.current = data.game_id;
        }
      } catch { /* offline OK */ }

      if (!cancelled) setStatus('playing');

      // Sporcu siyahsa beyaz (bot) baslar — ilk hamleyi otomatik oynat.
      if (!cancelled && chessRef.current.turn() === botColor) {
        setThinking(true);
        try {
          const uci = await eng.bestMove(chessRef.current.fen(), depth);
          if (uci && uci !== '(none)') {
            chessRef.current.move({
              from: uci.slice(0, 2) as Square,
              to: uci.slice(2, 4) as Square,
              promotion: 'q',
            });
            setFen(chessRef.current.fen());
            await persistMove(uci);
          }
        } catch { /* motor hatasi oyunu kilitlemez */ }
        if (!cancelled) setThinking(false);
      }
    })();
    return () => {
      cancelled = true;
      engineRef.current?.destroy();
    };
  }, [skillLevel, depth, botColor]);

  // ── Clock tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tc || status !== 'playing') return;
    const id = setInterval(() => {
      const turn = chessRef.current.turn();
      if (turn === 'w') setWhiteTime((t) => Math.max(0, t - 1));
      else setBlackTime((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [tc, status]);

  // ── Flag (time-out) detection ───────────────────────────────────────────────
  useEffect(() => {
    if (!tc || status !== 'playing') return;
    const studentTime = studentColor === 'w' ? whiteTime : blackTime;
    const botTime = studentColor === 'w' ? blackTime : whiteTime;
    if (studentTime <= 0) {
      setStatus('over');
      setResultText('⏰ Süren bitti — Bot kazandı.');
      onGameEnd('loss');
    } else if (botTime <= 0) {
      setStatus('over');
      setResultText('⏰ Botun süresi bitti — Kazandın! 🎉');
      onGameEnd('win');
    }
  }, [whiteTime, blackTime, status, tc, onGameEnd, studentColor]);

  async function persistMove(uci: string) {
    const gid = gameIdRef.current;
    if (!gid) return;
    try {
      const token = getToken();
      await fetch(`${API_BASE}/games/${gid}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ move_uci: uci }),
      });
    } catch { /* ignore */ }
  }

  function finish() {
    const chess = chessRef.current;
    setStatus('over');
    if (chess.isCheckmate()) {
      // Mat olan taraf SIRASI GELEN taraftir; sporcu mat edildiyse kaybetti.
      const studentWon = chess.turn() === botColor;
      setResultText(studentWon ? '🎉 Kazandın! Mat!' : '😔 Bot kazandı.');
      onGameEnd(studentWon ? 'win' : 'loss');
    } else {
      setResultText('🤝 Berabere.');
      onGameEnd('draw');
    }
  }

  function resignToBot() {
    setStatus('over');
    setResultText('🏳️ Maçı terk ettin — Bot kazandı.');
    onGameEnd('loss');
  }

  function offerDrawToBot() {
    if (!canOfferDraw(drawOffersUsed)) return;
    setDrawOffersUsed((n) => n + 1);
    if (botAcceptsDraw(chessRef.current.fen(), botColor)) {
      setStatus('over');
      setResultText('🤝 Bot beraberliği kabul etti.');
      onGameEnd('draw');
    } else {
      setDrawNote('Bot beraberliği reddetti.');
    }
  }

  /** Sporcunun hamlesini uygular. promo verilmezse terfi YAPILMAZ —
   *  terfi karari applyStudentMove'a gelmeden once verilir. */
  function applyStudentMove(from: Square, to: Square, promo?: PromotionPiece): boolean {
    const chess = chessRef.current;
    let move;
    try {
      move = chess.move({ from, to, promotion: promo });
    } catch {
      return false;
    }
    if (!move) return false;
    setFen(chess.fen());
    playMoveSound(); // madde 2: sporcunun hamlesinde nötr tık sesi.
    if (tc) {
      // Hamleyi yapan SPORCU — kendi rengine gore artis eklenir.
      if (studentColor === 'w') setWhiteTime((t) => t + tc.increment);
      else setBlackTime((t) => t + tc.increment);
    }

    void (async () => {
      // Terfi harfi UCI'ye MUTLAKA girer; yoksa sunucu baska hamle kaydeder.
      await persistMove(toUci(from, to, promo));
      if (chess.isGameOver()) { finish(); return; }

      setThinking(true);
      const botUci = await engineRef.current!.bestMove(chess.fen(), depth);
      if (botUci && botUci !== '(none)') {
        try {
          // Motor ata da terfi edebilir; UCI'deki harf neyse o uygulanir.
          chess.move({
            from: botUci.slice(0, 2) as Square,
            to: botUci.slice(2, 4) as Square,
            promotion: promotionFromUci(botUci),
          });
          setFen(chess.fen());
          playMoveSound(); // madde 2: botun hamlesinde de aynı ses.
          if (tc) {
            if (botColor === 'w') setWhiteTime((t) => t + tc.increment);
            else setBlackTime((t) => t + tc.increment);
          }
          await persistMove(botUci);
        } catch { /* ignore */ }
      }
      setThinking(false);
      if (chess.isGameOver()) finish();
    })();

    return true;
  }

  function handleDrop(from: Square, to: Square): boolean {
    if (thinking || status !== 'playing') return false;
    // Terfi ise once tas sorulur (madde 2). Tahta hamleyi kabul etmis
    // gorunmemeli, yoksa pencere acikken tas ortada kalir.
    if (isPromotionMove(chessRef.current.get(from), to)) {
      setPending({ from, to });
      return false;
    }
    return applyStudentMove(from, to);
  }

  if (status === 'loading') {
    return (
      <div className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-5 w-40 mx-auto" />
        <div className="t-skel aspect-square max-w-sm mx-auto rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* Madde 3: uc kart tahtanin USTUNDE — kare/dikdortgen/kare. */}
      <MatchHeader
        whiteName={studentColor === 'w' ? studentName : 'Bot'}
        blackName={studentColor === 'w' ? 'Bot' : studentName}
        whiteMs={tc ? whiteTime * 1000 : null}
        blackMs={tc ? blackTime * 1000 : null}
        whiteToMove={chessRef.current.turn() === 'w'}
        running={status === 'playing'}
      />

      <div className="h-7 flex items-center justify-center mb-2">
        {thinking && (
          <p className="t-muted text-center text-sm animate-pulse">
            🤖 Bot düşünüyor...
          </p>
        )}
      </div>

      <ChessBoard
        fen={fen}
        interactive={status === 'playing' && !thinking}
        onPieceDrop={handleDrop}
        boardOrientation={studentColor === 'w' ? 'white' : 'black'}
      />

      {/* Madde 1: tum hamleler tahtanin ALTINDA. Bu bilesende chess.load()
          cagrilmadigi icin chess.js gecmisi bozulmaz, dogrudan okunur. */}
      <MoveList san={chessRef.current.history()} startFen={startFen} />

      {pending && (
        <PromotionPicker
          onPick={(piece) => {
            const p = pending;
            setPending(null);
            applyStudentMove(p.from, p.to, piece);
          }}
          onCancel={() => setPending(null)}
        />
      )}


      {status === 'over' ? (
        <div className="mt-4 t-ok p-4 text-center text-lg font-bold">
          {resultText}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              disabled={!canOfferDraw(drawOffersUsed)}
              onClick={offerDrawToBot}
              className="t-btn-ghost px-4 py-2 text-sm disabled:opacity-40"
            >
              Beraberlik Teklif Et ({offersLeft(drawOffersUsed)})
            </button>
            <button
              type="button"
              onClick={() => { if (confirm('Maçı terk etmek istiyor musun? Maçı kaybedeceksin.')) resignToBot(); }}
              className="t-btn px-4 py-2 text-sm"
              style={{ background: 'var(--t-err-bg, #ef4444)', color: '#fff' }}
            >
              Terk Et
            </button>
          </div>
          {drawNote && <p className="text-center text-sm t-muted">{drawNote}</p>}
        </div>
      )}
    </div>
  );
}

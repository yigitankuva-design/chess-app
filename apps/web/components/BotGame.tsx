'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { PlayerInfo } from '@/components/play/MatchLayout';
import { PracticeMatchLayout } from '@/components/play/PracticeMatchLayout';
import type { PracticeAction, PracticeOutcome } from '@/components/play/PracticeMatchLayout';
import { MatchAnalysisSummary } from '@/components/play/MatchAnalysisSummary';
import { MoveList } from '@/components/play/MoveList';
import { PromotionPicker } from '@/components/play/PromotionPicker';
import { isPromotionMove, promotionFromUci, toUci } from '@/lib/play/promotion';
import { playMoveSound } from '@/lib/sounds/pieceSounds';
import { botAcceptsDraw } from '@/lib/play/botDraw';
import { canOfferDraw, offersLeft } from '@/lib/play/drawOffers';
import type { PromotionPiece } from '@/lib/play/promotion';
import { ChessBoard } from './ChessBoard';
import { useBoardNotation } from '@/lib/board-notation-context';
import { StockfishEngine } from '@/lib/chess/stockfish';
import { useMoveQualityEval } from '@/lib/chess/useMoveQualityEval';
import { computeGameSummary } from '@/lib/chess/gameSummary';
import { getToken, getAthleteName } from '@/lib/auth-storage';
import { getSavedAvatar } from '@/lib/avatars';
import {
  botGameKey, loadBotGame, saveBotGame, clearBotGame,
} from '@/lib/play/botGameSession';
import { fensFromSan } from '@/lib/play/moveNavigation';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';
import { HistoryBanner } from '@/components/play/HistoryBanner';
import { resolvePremove } from '@/lib/play/premove';
import type { Premove } from '@/lib/play/premove';
import { shouldBlunder, pickBlunderMove } from '@/lib/play/blunder';

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
  /** 0-1 arası: botun kasıtlı zayıf hamle yapma ihtimali. Verilmezse/0 ise eski davranış. */
  blunderChance?: number;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
  /** Verilirse maç bitince "Yeniden Oyna" butonu görünür ve aktif olur. */
  onRematch?: () => void;
  /** Verilirse Beraberlik Teklif Et YERİNE bu iki eylem gösterilir (Pratik Yap
   *  konum havuzu akışı — bota karşı serbest pratik, beraberlik teklifi anlamsız). */
  practiceActions?: {
    onPlaySame: () => void;
    onPlayDifferent: () => void;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function BotGame({
  skillLevel, depth, timeControl, studentColor = 'w', startFen, blunderChance = 0,
  onGameEnd, onRematch, practiceActions,
}: Props) {
  const { hideNotation } = useBoardNotation();
  // Oturum anahtarı render'lar arasında sabittir; prop'lardan türetilir.
  const sessionKeyStr = botGameKey(skillLevel, studentColor, startFen);
  /** Kayıttan okunan hamleler — ilk render'da tahtayı kurmak için kullanılır.
   *  useRef DEĞİL useState DEĞİL: yalnız ilk kurulumda okunur, sonra
   *  chessRef gerçeğin kaynağıdır. */
  const restoredRef = useRef(loadBotGame(sessionKeyStr));

  const chessRef = useRef((() => {
    // Kayıtlı hamleler tekrar oynatılır: hem pozisyon hem chess.js geçmişi
    // (notasyon kartı için gerekli) geri gelir.
    const board = new Chess(startFen);
    for (const uci of restoredRef.current?.moves ?? []) {
      try {
        board.move({
          from: uci.slice(0, 2) as Square,
          to: uci.slice(2, 4) as Square,
          promotion: promotionFromUci(uci) ?? 'q',
        });
      } catch {
        break; // bozuk kayıt — oynatılabildiği yere kadar
      }
    }
    return board;
  })());
  /** Backend'e yazılmış UCI hamleleri — sessionStorage kaydının içeriği. */
  const movesRef = useRef<string[]>([...(restoredRef.current?.moves ?? [])]);
  const botColor = studentColor === 'w' ? 'b' : 'w';
  const engineRef = useRef<StockfishEngine | null>(null);
  const gameIdRef = useRef<number | null>(null);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [pending, setPending] = useState<{ from: Square; to: Square } | null>(null);
  const [premove, setPremove] = useState<Premove | null>(null);
  /** Bot cevabı async akışta okunur; state closure'ı eski kalabildiği için
   *  ref ile ikizlenir. */
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
  /** Madde 6: bota karsi da terk ve beraberlik hakki. Hak sayisi insan
   *  maclariyla AYNI kuraldan gelir (drawOffers.ts) — iki yerde iki sayi olmaz. */
  const [drawOffersUsed, setDrawOffersUsed] = useState(restoredRef.current?.drawOffersUsed ?? 0);
  const [drawNote, setDrawNote] = useState('');
  /** Madde 2026-09-03 (2): beraberlik kararı artık motor sorgusu gerektiriyor —
   *  sorgu sürerken buton kilitlenir, sporcu iki kez tıklayıp hakkını
   *  boşa harcamasın diye. */
  const [drawChecking, setDrawChecking] = useState(false);
  /** Madde 2026-09-03 (3): "Tahtanın Yönünü Değiştir" — sporcunun rengine göre
   *  hesaplanan varsayılan yöne EK bir ters çevirme. */
  const [flipped, setFlipped] = useState(false);
  /** Madde 2026-09-03 (3): "İpucu Göster" — motorun önerdiği kare çifti,
   *  ChessBoard'un ZATEN VAR OLAN highlightSquares prop'uyla işaretlenir. */
  const [hint, setHint] = useState<{ from: Square; to: Square } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  /** Madde 2026-09-03 (2): "Analiz Et" tıklanınca true olur — motor TÜM
   *  maçı arka planda değerlendirmeye SADECE o zaman başlar. */
  const [showAnalysis, setShowAnalysis] = useState(false);
  // Sporcunun adi girişte saklaniyor; yoksa nötr bir etiket kullanilir.
  const [studentName] = useState(() => getAthleteName() || 'Sen');
  const [studentAvatar] = useState(() => getSavedAvatar());
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState<'loading' | 'playing' | 'over'>('loading');
  const [resultText, setResultText] = useState<string>('');
  /** Pratik modunda (practiceActions) geri bildirim kartı için — win/draw/loss,
   *  onGameEnd'e giden değerle AYNI. Gerçek maçlarda kullanılmaz. */
  const [outcome, setOutcome] = useState<PracticeOutcome | null>(null);

  // Notasyon ve gezinme AYNI kaynaktan beslenir: chess.js geçmişi.
  // `fen` state'i her hamlede değiştiği için bağımlılık olarak yeterlidir.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sanHistory = useMemo(() => chessRef.current.history(), [fen]);
  const fens = useMemo(() => fensFromSan(startFen, sanHistory), [startFen, sanHistory]);
  const nav = useMoveHistoryNav(fens);

  /** Madde 2026-09-03 (2): "Analiz Et" özet kartı — SADECE `showAnalysis`
   *  true olunca (tıklanınca) motor tüm maçı arka planda değerlendirir.
   *  `useMoveQualityEval` "Maçlarım" analizinde kullanılan AYNI hook —
   *  ikinci bir motor entegrasyonu YAZILMADI. */
  const evalMoves = useMemo(
    () => fens.slice(1).map((fenAfter, i) => ({ ply: i + 1, fenAfter })),
    [fens],
  );
  const { evalByPly, progress: analysisProgress } = useMoveQualityEval(fens[0], evalMoves, showAnalysis);
  const gameSummary = useMemo(
    () => (showAnalysis ? computeGameSummary(evalByPly, fens, studentColor) : null),
    [showAnalysis, evalByPly, fens, studentColor],
  );

  const tc = timeControl ?? null;
  const [whiteTime, setWhiteTime] = useState(restoredRef.current?.whiteTime ?? (tc ? tc.base : 0));
  const [blackTime, setBlackTime] = useState(restoredRef.current?.blackTime ?? (tc ? tc.base : 0));

  // ── Engine + backend game setup ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const eng = new StockfishEngine();
      await eng.init();
      eng.setSkill(skillLevel);
      engineRef.current = eng;

      // Kayıtlı oyun varsa YENİ OYUN AÇILMAZ — sayfa yenilemesi maçı
      // sıfırlıyordu (madde 3).
      if (restoredRef.current?.gameId != null) {
        gameIdRef.current = restoredRef.current.gameId;
      } else {
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
      }

      if (!cancelled) setStatus('playing');

      // Kayıttan devam ediliyorsa açılış hamlesi zaten oynanmıştır.
      if (!cancelled && movesRef.current.length === 0 && chessRef.current.turn() === botColor) {
        setThinking(true);
        try {
          const uci = await pickBotMove(chessRef.current.fen());
          if (uci) {
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
      clearBotGame(sessionKeyStr);
      setResultText('⏰ Süren bitti — Bot kazandı.');
      setOutcome('loss');
      onGameEnd('loss');
    } else if (botTime <= 0) {
      setStatus('over');
      clearBotGame(sessionKeyStr);
      setResultText('⏰ Botun süresi bitti — Kazandın! 🎉');
      setOutcome('win');
      onGameEnd('win');
    }
  }, [whiteTime, blackTime, status, tc, onGameEnd, studentColor, sessionKeyStr]);

  /** Botun bu hamlede oynayacağı UCI hamleyi getirir — blunder mekanizması dahil. */
  async function pickBotMove(fen: string): Promise<string | undefined> {
    const eng = engineRef.current!;
    if (blunderChance > 0) {
      const candidates = await eng.bestMoveCandidates(fen, depth, 4);
      if (candidates.length === 0) return undefined;
      return shouldBlunder(blunderChance) ? pickBlunderMove(candidates) : candidates[0];
    }
    const mv = await eng.bestMove(fen, depth);
    return mv && mv !== '(none)' ? mv : undefined;
  }

  /** Oyunun o anki durumunu sekmeye yazar. Her hamleden sonra çağrılır. */
  function saveSession() {
    saveBotGame(sessionKeyStr, {
      gameId: gameIdRef.current,
      moves: movesRef.current,
      whiteTime,
      blackTime,
      drawOffersUsed,
    });
  }

  async function persistMove(uci: string) {
    movesRef.current = [...movesRef.current, uci];
    saveSession();
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
    clearBotGame(sessionKeyStr);
    if (chess.isCheckmate()) {
      // Mat olan taraf SIRASI GELEN taraftir; sporcu mat edildiyse kaybetti.
      const studentWon = chess.turn() === botColor;
      setResultText(studentWon ? '🎉 Kazandın! Mat!' : '😔 Bot kazandı.');
      setOutcome(studentWon ? 'win' : 'loss');
      onGameEnd(studentWon ? 'win' : 'loss');
    } else {
      setResultText('🤝 Berabere.');
      setOutcome('draw');
      onGameEnd('draw');
    }
  }

  function resignToBot() {
    setStatus('over');
    clearBotGame(sessionKeyStr);
    setResultText('🏳️ Maçı terk ettin — Bot kazandı.');
    setOutcome('loss');
    onGameEnd('loss');
  }

  /** Madde 2026-09-03 (2): bot artık malzeme farkına değil, motorun konuma
   *  verdiği puana bakar — sporcunun pozisyonu ±3 puandan fazla UZAKSA
   *  (hangi yönde olursa olsun) reddeder. Mat bulunduysa (kesin sonuç)
   *  HER ZAMAN reddedilir. */
  async function offerDrawToBot() {
    if (!canOfferDraw(drawOffersUsed) || drawChecking) return;
    setDrawOffersUsed((n) => n + 1);
    setDrawChecking(true);
    try {
      const eng = engineRef.current;
      const fenNow = chessRef.current.fen();
      const sideToMove: 'w' | 'b' = fenNow.split(/\s+/)[1] === 'b' ? 'b' : 'w';
      const sign = sideToMove === studentColor ? 1 : -1;
      const { scoreCp, mate } = eng
        ? await eng.analyze(fenNow, depth)
        : { scoreCp: null, mate: null };
      const accepted = mate === null && scoreCp !== null && botAcceptsDraw((scoreCp * sign) / 100);
      if (accepted) {
        setStatus('over');
        clearBotGame(sessionKeyStr);
        setResultText('🤝 Bot beraberliği kabul etti.');
        setOutcome('draw');
        onGameEnd('draw');
      } else {
        setDrawNote('Bot beraberliği reddetti.');
      }
    } finally {
      setDrawChecking(false);
    }
  }

  /** Madde 2026-09-03 (3): "İpucu Göster" — sadece sporcunun sırasındayken.
   *  Sayı sınırı yok, her tıklamada güncel pozisyon için yeniden hesaplanır. */
  async function showHint() {
    if (hintLoading || status !== 'playing' || chessRef.current.turn() !== studentColor) return;
    const eng = engineRef.current;
    if (!eng) return;
    setHintLoading(true);
    try {
      const { bestMove } = await eng.analyze(chessRef.current.fen(), depth);
      if (bestMove) {
        setHint({ from: bestMove.slice(0, 2) as Square, to: bestMove.slice(2, 4) as Square });
      }
    } finally {
      setHintLoading(false);
    }
  }

  /** Madde 2026-09-03 (2): "Analiz Et" özet kartındaki CTA — mevcut
   *  "Maçlarım" hamle-hamle analiz ekranına YÖNLENDİRİR (ikinci bir
   *  hamle-gezinme ekranı YAZILMADI). `next/navigation`'ın `useRouter`'ı
   *  KASITLI kullanılmadı — BotGame testlerinin BÜYÜK ÇOĞUNLUĞU App Router
   *  context'i olmadan render ediyor (invariant hatası verir); düz `window.location`
   *  ile yönlendirme hem router bağımlılığı istemez hem de bu ekrandan
   *  çıkış zaten tam sayfa geçişi kadar nadir bir eylemdir. Kayıt hiç
   *  oluşmadıysa (çevrimdışı) sessizce hiçbir şey yapmaz. */
  function learnFromMistakes() {
    if (gameIdRef.current != null && typeof window !== 'undefined') {
      window.location.href = `/analiz/maclarim?gameId=${gameIdRef.current}`;
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
    clearPremove(); // yeni hamle yapıldı, eski ön-hamle geçersiz.
    setHint(null); // madde 2026-09-03 (3): pozisyon değişti, eski ipucu geçersiz.
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
      const botUci = await pickBotMove(chess.fen());
      if (botUci) {
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
      if (chess.isGameOver()) { finish(); return; }

      // Madde 5: sıra sporcuya geldi — ön-hamle varsa şimdi oynanır.
      // Geçersizse SESSİZCE iptal edilir (uyarı yok, sıra sporcuda kalır).
      const pm = resolvePremove(chess.fen(), premoveRef.current);
      clearPremove();
      if (pm) applyStudentMove(pm.from, pm.to);
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

  const studentTimeSec = studentColor === 'w' ? whiteTime : blackTime;
  const botTimeSec = botColor === 'w' ? whiteTime : blackTime;
  const top: PlayerInfo = {
    avatarId: 'robot',
    name: 'Bot',
    ms: tc ? botTimeSec * 1000 : null,
    active: status === 'playing' && chessRef.current.turn() === botColor,
  };
  const bottom: PlayerInfo = {
    avatarId: studentAvatar,
    name: studentName,
    ms: tc ? studentTimeSec * 1000 : null,
    active: status === 'playing' && chessRef.current.turn() === studentColor,
  };

  // Madde 5: `thinking` tek basina yeterli degil — persistMove await'i
  // sirasinda thinking henuz true olmadan kisa bir pencere var; o an tur
  // kontrolu olmadan interactive=true kalirsa ChessBoard ÖN-HAMLE dalina
  // hic girmez, sporcu rakip sirasindayken tasini secemez.
  const boardInteractive = status === 'playing' && !thinking && nav.isLive
    && chessRef.current.turn() === studentColor;

  // Madde 2026-09-03 (2/3): "Tahtanın Yönünü Değiştir" — sporcunun rengine
  // göre varsayılan yönün ÜSTÜNE bir ters çevirme.
  const baseOrientation: 'white' | 'black' = studentColor === 'w' ? 'white' : 'black';
  const orientation: 'white' | 'black' = flipped
    ? (baseOrientation === 'white' ? 'black' : 'white')
    : baseOrientation;

  const board = (
    <>
      <ChessBoard
        fen={nav.viewFen}
        interactive={boardInteractive}
        onPieceDrop={handleDrop}
        boardOrientation={orientation}
        highlightSquares={hint ? [hint.from, hint.to] : []}
        onWheelStep={nav.step}
        historyView={!nav.isLive}
        onLeaveHistory={nav.goLive}
        onPremove={choosePremove}
        premoveColor={studentColor}
        premoveSquares={premove}
        hideNotation={hideNotation}
      />
      <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
    </>
  );
  const moveList = (
    <MoveList
      san={sanHistory}
      startFen={startFen}
      onSelectPly={nav.goTo}
      activePly={nav.isLive ? undefined : nav.viewIndex}
    />
  );
  const extra = (
    <>
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
      {drawNote && status !== 'over' && <p className="text-center text-sm t-muted">{drawNote}</p>}
    </>
  );

  // Pratik Yap akışları (Kazanç Konumu / Oyunsonu / Açılış) — 5 dairesel
  // eylem kartı + renkli geri bildirim (madde 2026-09-03 (3): Konumu Yeniden
  // Tekrar Et / İpucu Göster / Terk Et / Tahtanın Yönünü Değiştir / Farklı
  // Bir Konumu Pratik Yap — Beraberlik Teklif Et bu ekrandan KALKTI).
  if (practiceActions) {
    const actions: PracticeAction[] = [
      {
        icon: '🔁', label: 'Konumu Yeniden Tekrar Et',
        onClick: practiceActions.onPlaySame, enabled: status === 'over',
      },
      {
        icon: '💡', label: 'İpucu Göster',
        onClick: showHint,
        enabled: status === 'playing' && !hintLoading && chessRef.current.turn() === studentColor,
      },
      {
        icon: '🏳️', label: 'Terk Et',
        onClick: () => {
          if (confirm('Pratiği terk etmek istiyor musun?')) resignToBot();
        },
        enabled: status === 'playing',
      },
      {
        icon: '🔄', label: 'Tahtanın Yönünü Değiştir',
        onClick: () => setFlipped((f) => !f), enabled: true,
      },
      {
        icon: '🎲', label: 'Farklı Bir Konumu Pratik Yap',
        onClick: practiceActions.onPlayDifferent, enabled: status === 'over',
      },
    ];
    return (
      <PracticeMatchLayout
        top={top}
        bottom={bottom}
        board={board}
        moveList={moveList}
        outcome={outcome}
        actions={actions}
        extra={extra}
      />
    );
  }

  // Gerçek maç (Bota Karşı Maç Yap) — madde 2026-09-03 (2): 5 dairesel eylem
  // kartı (Beraberlik Teklif Et / Terk Et / Analiz Et / Tahtanın Yönünü
  // Değiştir / Yeniden Oyna). AYNI dairesel bileşen (PracticeMatchLayout)
  // kullanılır — arkadaş/turnuva maçları (LiveGame → MatchLayout) DOKUNULMAZ.
  const matchActions: PracticeAction[] = [
    {
      icon: '🤝', label: `Beraberlik Teklif Et (${offersLeft(drawOffersUsed)})`,
      onClick: offerDrawToBot,
      enabled: status === 'playing' && canOfferDraw(drawOffersUsed) && !drawChecking,
    },
    {
      icon: '🏳️', label: 'Terk Et',
      onClick: () => {
        if (confirm('Maçı terk etmek istiyor musun? Maçı kaybedeceksin.')) resignToBot();
      },
      enabled: status === 'playing',
    },
    {
      icon: '🔍', label: 'Analiz Et',
      onClick: () => setShowAnalysis(true),
      enabled: status === 'over',
    },
    {
      icon: '🔄', label: 'Tahtanın Yönünü Değiştir',
      onClick: () => setFlipped((f) => !f), enabled: true,
    },
    ...(onRematch ? [{
      icon: '🔁', label: 'Yeniden Oyna',
      onClick: onRematch, enabled: status === 'over',
    }] : []),
  ];

  return (
    <PracticeMatchLayout
      top={top}
      bottom={bottom}
      board={board}
      moveList={moveList}
      outcome={status === 'over' ? outcome : null}
      resultText={resultText}
      actions={matchActions}
      // Madde 2026-09-04 (2): "Analiz Et" tıklanınca geri bildirim kartının
      // (kazandın/kaybettin) YERİNE analiz özeti gelir — extra'da AYRI bir
      // yerde (notasyonun altında) değil.
      feedbackOverride={showAnalysis ? (
        <MatchAnalysisSummary
          summary={gameSummary}
          progress={analysisProgress}
          onLearnFromMistakes={learnFromMistakes}
        />
      ) : undefined}
      extra={extra}
    />
  );
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { playerState, tryStudentMove, opponentKeyMove } from '@/lib/chess/movePlayer';
import { fensFromSan } from '@/lib/play/moveNavigation';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';
import { HistoryBanner } from '@/components/play/HistoryBanner';
import { resolvePremove } from '@/lib/play/premove';
import type { Premove } from '@/lib/play/premove';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

/** Rakibin cevabı gözle takip edilebilsin diye kısa gecikme (MovePieceSolver ile AYNI). */
const OPPONENT_DELAY_MS = 450;

interface Props {
  question: TeoriPratigiQuestion;
  disabled: boolean;
  onSolved: () => void;
  onWrong: (msg: string) => void;
  /** Madde 2026-09-04 (6): oynanan hamleler değiştikçe çağrılır — üst bileşen
   *  (TeoriPratigiPractice) bunu HAMLELER (notasyon) bölümünde gösterir. */
  onMovesChange?: (moves: string[]) => void;
}

/**
 * b) Teori Pratiği'nin tahta bileşeni — `MovePieceSolver.tsx`'in mantığını
 * temel alır (KOPYALANMADI, o bileşen derslerde kullanılıyor ve iyi test
 * edilmiş — riske atmamak için AYRI bir bileşen, bkz. plan). İki fark:
 *
 * 1. Sporcunun rengi `question.student_color`'dan gelir, FEN'in kendi
 *    sırasından BAĞIMSIZ — notasyon her zaman doğal sırayla kaydedilir
 *    (genelde beyazdan), ama sporcu SİYAH oynayacaksa (`studentParity===1`)
 *    rakibin İLK hamlesi (index 0) bileşen açılır açılmaz otomatik oynanır.
 * 2. Tamamlanma kontrolü `movePlayer.ts`'in parity tabanlı
 *    `isSequenceComplete`'i YERİNE basit bir uzunluk karşılaştırmasıdır
 *    (`playedMoves.length >= question.moves.length`) — b)'de notasyon HER
 *    ZAMAN admin tarafından TAM kaydedildiği için (motor devreye hiç
 *    girmez), hangi tarafın son hamleyi oynadığından bağımsız olarak "kayıtlı
 *    hamle bitti mi" tek doğru ölçüttür.
 * 3. Madde (devam): PREMOVE — rakip (bot) 450ms'lik cevap penceresinde
 *    sporcu hamlesini önceden seçebilir; sıra kendine geçince GEÇERLİYSE
 *    otomatik oynanır, DEĞİLSE sessizce iptal edilir. `LiveGame.tsx`'teki
 *    AYNI desen (`resolvePremove`, `lib/play/premove.ts`) — kopyalanmadı,
 *    aynı yardımcı yeniden kullanıldı.
 */
export function TeoriPratigiSolver({ question, disabled, onSolved, onWrong, onMovesChange }: Props) {
  const fenTurn = playerState(question.fen, []).turn;
  const studentParity: 0 | 1 = fenTurn === question.student_color ? 0 : 1;

  const [playedMoves, setPlayedMoves] = useState<string[]>(() => {
    if (studentParity !== 1) return [];
    const first = opponentKeyMove(question.moves, [], 1);
    return first ? [first] : [];
  });

  useEffect(() => {
    onMovesChange?.(playedMoves);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playedMoves]);
  const [premove, setPremove] = useState<Premove | null>(null);
  /** setTimeout içindeki playOpponentReply eski closure'ı görebilir; ref ile ikizlenir. */
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

  const state = playerState(question.fen, playedMoves, studentParity);
  const fens = useMemo(
    () => fensFromSan(question.fen, playedMoves),
    [question.fen, playedMoves],
  );
  const nav = useMoveHistoryNav(fens);

  /**
   * `handleMove` ve `playOpponentReply` (ön-hamle çözümü) İKİSİ de sporcunun
   * bir hamlesini işler — ama `playOpponentReply` bir `setTimeout` içinden
   * çağrıldığı için, kendi çağrıldığı ANDAKİ (ESKİ) `playedMoves` state'ini
   * closure'da DONMUŞ görür. Bu yüzden "baz alınacak playedMoves" PARAMETRE
   * olarak verilir — state'e (o anki render'ın closure'ına) GÜVENİLMEZ.
   */
  function applyStudentMove(baseMoves: string[], from: Square, to: Square): boolean {
    const result = tryStudentMove(question.fen, question.moves, baseMoves, from, to, studentParity);

    if (result.kind === 'illegal') return false; // taş yerine döner, ceza yok
    if (result.kind === 'wrong') {
      onWrong(question.fail_msg ?? 'Bu hamle teorinin dışında.');
      return false;
    }

    setPlayedMoves(result.playedMoves);
    clearPremove(); // yeni hamle yapıldı, eski ön-hamle geçersiz.
    if (result.playedMoves.length >= question.moves.length) {
      onSolved();
      return true;
    }
    setTimeout(() => playOpponentReply(result.playedMoves), OPPONENT_DELAY_MS);
    return true;
  }

  function playOpponentReply(afterStudent: string[]) {
    const keyMove = opponentKeyMove(question.moves, afterStudent, studentParity);
    if (!keyMove) { onSolved(); return; } // kayıtlı hamle bitti — soru tamamlandı
    const next = [...afterStudent, keyMove];
    setPlayedMoves(next);
    if (next.length >= question.moves.length) { onSolved(); return; }
    // Madde (devam): sıra sporcuya geçti — ön-hamle varsa oynanır (geçerliyse),
    // değilse sessizce temizlenir (LiveGame'deki "sessizce iptal" kuralıyla AYNI).
    const nextFen = playerState(question.fen, next, studentParity).fen;
    const pm = resolvePremove(nextFen, premoveRef.current);
    clearPremove();
    if (pm) applyStudentMove(next, pm.from, pm.to);
  }

  function handleMove(from: Square, to: Square): boolean {
    if (disabled) return false;
    return applyStudentMove(playedMoves, from, to);
  }

  return (
    <div className="space-y-2">
      <ChessBoard
        fen={nav.isLive ? state.fen : nav.viewFen}
        interactive={!disabled && nav.isLive && state.isStudentTurn}
        onPieceDrop={handleMove}
        boardOrientation={question.student_color === 'w' ? 'white' : 'black'}
        onWheelStep={nav.step}
        historyView={!nav.isLive}
        onLeaveHistory={nav.goLive}
        onPremove={choosePremove}
        premoveColor={question.student_color}
        premoveSquares={premove}
      />
      <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
    </div>
  );
}

'use client';
import { useMemo, useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { playerState, tryStudentMove, opponentKeyMove } from '@/lib/chess/movePlayer';
import { fensFromSan } from '@/lib/play/moveNavigation';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';
import { HistoryBanner } from '@/components/play/HistoryBanner';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

/** Rakibin cevabı gözle takip edilebilsin diye kısa gecikme (MovePieceSolver ile AYNI). */
const OPPONENT_DELAY_MS = 450;

interface Props {
  question: TeoriPratigiQuestion;
  disabled: boolean;
  onSolved: () => void;
  onWrong: (msg: string) => void;
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
 */
export function TeoriPratigiSolver({ question, disabled, onSolved, onWrong }: Props) {
  const fenTurn = playerState(question.fen, []).turn;
  const studentParity: 0 | 1 = fenTurn === question.student_color ? 0 : 1;

  const [playedMoves, setPlayedMoves] = useState<string[]>(() => {
    if (studentParity !== 1) return [];
    const first = opponentKeyMove(question.moves, [], 1);
    return first ? [first] : [];
  });

  const state = playerState(question.fen, playedMoves, studentParity);
  const fens = useMemo(
    () => fensFromSan(question.fen, playedMoves),
    [question.fen, playedMoves],
  );
  const nav = useMoveHistoryNav(fens);

  function playOpponentReply(afterStudent: string[]) {
    const keyMove = opponentKeyMove(question.moves, afterStudent, studentParity);
    if (!keyMove) { onSolved(); return; } // kayıtlı hamle bitti — soru tamamlandı
    const next = [...afterStudent, keyMove];
    setPlayedMoves(next);
    if (next.length >= question.moves.length) onSolved();
  }

  function handleMove(from: Square, to: Square): boolean {
    if (disabled) return false;

    const result = tryStudentMove(question.fen, question.moves, playedMoves, from, to, studentParity);

    if (result.kind === 'illegal') return false; // taş yerine döner, ceza yok
    if (result.kind === 'wrong') {
      onWrong(question.fail_msg ?? 'Bu hamle teorinin dışında.');
      return false;
    }

    setPlayedMoves(result.playedMoves);
    if (result.playedMoves.length >= question.moves.length) {
      onSolved();
      return true;
    }
    setTimeout(() => playOpponentReply(result.playedMoves), OPPONENT_DELAY_MS);
    return true;
  }

  return (
    <div className="space-y-2">
      <ChessBoard
        fen={nav.isLive ? state.fen : nav.viewFen}
        interactive={!disabled && nav.isLive}
        onPieceDrop={handleMove}
        boardOrientation={question.student_color === 'w' ? 'white' : 'black'}
        onWheelStep={nav.step}
        historyView={!nav.isLive}
        onLeaveHistory={nav.goLive}
      />
      <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
    </div>
  );
}

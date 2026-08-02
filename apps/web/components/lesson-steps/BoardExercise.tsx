'use client';
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { ChoiceQuestionVisual } from './ChoiceQuestionVisual';
import { ChoiceQuestionAnswers } from './ChoiceQuestionAnswers';
import { MovePieceSolver } from './MovePieceSolver';
import { MoveList } from '@/components/play/MoveList';
import { evaluateClick } from '@/lib/play/multiSquareCheck';
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';

// ─── Exercise config types ────────────────────────────────────────────────────

export interface ClickSquareEx {
  type: 'click_square';
  instruction: string;
  fen: string;
  target_squares: string[];
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  /** 3 haneli soru kodu — admin panelinde atanır, öğrenciye üstte gösterilir. */
  code?: string;
  /** 1=Kolay, 3=Orta, 5=Zor — pratik havuzundan zorluk dağılımıyla seçim için. */
  difficulty?: number;
  /** Sporcu tıklama modu (madde 2). Yoksa 'any' — doğru karelerden birine
   *  tıklamak yeter. 'all' — TÜM doğru karelere tıklanmalı; 1 yanlış = yanlış. */
  click_mode?: 'any' | 'all';
}

/** Eski format: "şu taşı şu karelerden birine taşı" (tek hamle). */
export interface MovePieceLegacyEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  piece_square: string;
  target_squares: string[];
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
  difficulty?: number;
}

/** Yeni format (P4): SAN hamle dizisi — sporcu çizgiyi oynar. */
export interface MovePieceSequenceEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  moves: string[];
  success_msg?: string;
  fail_msg?: string;
  code?: string;
  difficulty?: number;
}

/**
 * İki format tek `type` değerini paylaşıyor; TypeScript bunları `in` operatörüyle
 * ayırır: `'moves' in exercise` pozitif dalda MovePieceSequenceEx'e, negatif dalda
 * MovePieceLegacyEx'e daraltır. Böylece eski format kodu tip güvenli kalır.
 */
export type MovePieceEx = MovePieceLegacyEx | MovePieceSequenceEx;

export interface IdentifyPieceEx {
  type: 'identify_piece';
  instruction: string;
  fen: string;
  highlight_square: string;
  options: string[];
  correct_index: number;
  success_msg?: string;
  code?: string;
  difficulty?: number;
}

export interface SentenceQuestionEx {
  type: 'sentence_question';
  instruction: string;
  answer_kind: 'sentence' | 'image';
  options: string[];
  correct_index: number;
  success_msg?: string;
  fail_msg?: string;
  code?: string;
  difficulty?: number;
}

export interface ImageQuestionEx {
  type: 'image_question';
  /** İsteğe bağlı alt başlık/açıklama — '' olabilir. */
  instruction: string;
  /** Eski tekil format. Yeni sorularda bunun yerine `prompt_images` doldurulur. */
  prompt_image?: string;
  answer_kind: 'sentence' | 'image';
  options: string[];
  correct_index: number;
  success_msg?: string;
  fail_msg?: string;
  code?: string;
  difficulty?: number;
  image_x?: number;
  image_y?: number;
  image_w?: number;
  image_h?: number;
  image_tone?: number;
  image_show_board?: boolean;
  /** Sadece image_question için — YENİ çoklu görsel formatı. Varsa
   *  image_x/y/w/h/tone/prompt_image (eski tekil format) yok sayılır. */
  prompt_images?: { uri: string; x: number; y: number; w: number; h: number; tone: number }[];
}

export type BoardTypeConfig = ClickSquareEx | MovePieceEx | IdentifyPieceEx;
export type ChoiceTypeConfig = SentenceQuestionEx | ImageQuestionEx;
export type BoardExerciseConfig = BoardTypeConfig | ChoiceTypeConfig;

/** Tahta tabanlı bir soru mu (click_square/move_piece/identify_piece)? */
export function isBoardExercise(ex: BoardExerciseConfig): ex is BoardTypeConfig {
  return ex.type === 'click_square' || ex.type === 'move_piece' || ex.type === 'identify_piece';
}

interface Props {
  exercises: BoardExerciseConfig[];
  done: boolean;
  onCorrect: () => void;
  /** Oturum bitince (son soru cevaplanınca) bir kez çağrılır — puanlama için. */
  onFinish?: (result: { correct: number; total: number }) => void;
  /** true ise yanlış cevaptan sonra soru TEKRAR ÇÖZÜLEMEZ; sporcu
   *  "Sonraki Soruya Geç" ile ilerler (madde 1 — Süresiz Pratik). */
  noRetry?: boolean;
  /** Sayfa yenilenince kalınan soruya dönmek için başlangıç sırası (madde 4/9). */
  initialIndex?: number;
  /** Soru değişince çağrılır — üst sayfa sırayı saklayabilsin. */
  onIndexChange?: (index: number) => void;
  /** Sayfa yenilemesinde currentIdx'teki sorunun ÖNCEKİ sonucu. 'wrong' ise
   *  soru kilitli ve geribildirimli başlar — TEKRAR ÇÖZÜLEMEZ (madde 6). */
  initialAnswer?: 'correct' | 'wrong' | null;
  /** Sayfa yenilemesinde restore edilecek doğru-sayısı — succeed() tekrar
   *  +1 yapıp ilerlemeyi ikinci kez saymasın diye. */
  initialDoneCount?: number;
  /** Her cevaplamada (doğru/yanlış) çağrılır — üst sayfa kalıcı hale getirsin. */
  onAnswered?: (index: number, doneCount: number, answer: 'correct' | 'wrong') => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Doğru kare kontrolü: SADECE admin'de kaydedilen hedef kareler geçerlidir.
 *
 * ÖNEMLİ: Burada eskiden "liste h1/a2/b1 içeriyorsa hedefleri yok say, herhangi
 * bir koyu kareyi doğru kabul et" şeklinde bir düzeltme hack'i vardı. Bu hack,
 * öğretmenin yazdığı cevabı bozuyordu (örn. "açık renkli kareye dokun" sorusunda
 * cevabı tam tersine çeviriyordu). Kaldırıldı — cevap artık adminde ne yazıldıysa o.
 */
export function isTargetSquare(sq: string, targets: string[]): boolean {
  return targets.includes(sq);
}

// ─── Progress dots ────────────────────────────────────────────────────────────
function ProgressDots({ total, current, doneCount }: { total: number; current: number; doneCount: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < doneCount
              ? '#16a34a'        // completed
              : i === current
              ? 'var(--t-accent)' // current
              : 'var(--t-border)', // future
            transition: 'background 0.2s',
          }}
        />
      ))}
      <span className="text-xs ml-1" style={{ color: 'var(--t-muted)' }}>
        {doneCount}/{total}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BoardExercise({
  exercises, done, onCorrect, onFinish, noRetry = false,
  initialIndex = 0, onIndexChange, initialAnswer = null, initialDoneCount,
  onAnswered,
}: Props) {
  // Madde 1: click_square/identify_piece sorularinin tahtasi ham
  // react-chessboard cizdigi icin uygulamanin ortak temasini/notasyonunu
  // hic uygulamiyordu — move_piece (MovePieceSolver -> ChessBoard.tsx)
  // dogru gorunuyordu. Ayni renk/etiket kaynagi burada da kullanilir.
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = getPieceSet(settings.board.pieces);
  const { ranks, files } = coordLabels('white');
  // Sinirlar icinde tutulur: kayitli sira soru sayisindan buyukse patlamaz.
  const [currentIdx, setCurrentIdx] = useState(
    initialIndex > 0 && initialIndex < exercises.length ? initialIndex : 0,
  );
  const [doneCount, setDoneCount] = useState(done ? exercises.length : (initialDoneCount ?? 0));
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>(
    done ? 'success' : initialAnswer === 'correct' ? 'success' : initialAnswer === 'wrong' ? 'fail' : 'idle',
  );
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(!!initialAnswer && initialIndex < exercises.length - 1);
  const [clickedSquare, setClickedSquare] = useState<string | null>(null);
  /** all modunda (madde 2) o ana kadar doğru tıklanan kareler. */
  const [multiClicked, setMultiClicked] = useState<string[]>([]);
  const [allAttempted, setAllAttempted] = useState(false);
  /** Madde 1: Suresiz Pratik'te yanlis cevaptan sonra tekrar deneme YOK;
   *  soru kilitlenir, sporcu "Sonraki Soruya Geç" ile ilerler. */
  const [failLocked, setFailLocked] = useState(initialAnswer === 'wrong');
  /** İlk render'da initialAnswer'dan gelen durumu KORUR — aşağıdaki
   *  index-değişince-sıfırla efekti bu durumu hemen ezmesin diye (madde 6). */
  const skipFirstReset = useRef(!!initialAnswer);
  /** Madde 6: dogru cevaplanan Tasi Oynat (eski format) sorusunun oynanan
   *  hamlesi — geribildirim karti altindaki notasyon karti icin. */
  const [playedMove, setPlayedMove] = useState<{ from: string; to: string } | null>(null);

  const exercise = exercises[currentIdx] ?? exercises[0];
  const total = exercises.length;
  const isLastQuestion = currentIdx === total - 1;

  // Reset per-exercise state when index changes
  useEffect(() => {
    if (done) return;
    if (skipFirstReset.current) {
      // İlk mount'ta initialAnswer'dan gelen durumu koru — sıfırlama.
      skipFirstReset.current = false;
      return;
    }
    setStatus('idle');
    setFeedback('');
    setSelected(null);
    setShowNext(false);
    setClickedSquare(null);
    setFailLocked(false);
    setPlayedMove(null);
    onIndexChange?.(currentIdx);
    // onIndexChange kasten bagimlilikta DEGIL: her renderda yeni fonksiyon
    // gelirse efekt bosuna tekrar calisir ve durum sifirlanir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, done]);

  const succeed = () => {
    setStatus('success');
    setSelected(null);
    const next = doneCount + 1;
    setDoneCount(next);
    onAnswered?.(currentIdx, next, 'correct');
    // Bitiş tespiti currentIdx tabanlı (doneCount tabanlı DEĞİL) — çünkü yanlış
    // cevapta da ilerleme olan click_square'de doneCount artık currentIdx'ten
    // geride kalabilir. Mevcut tipler için (her soru doğru cevaplanmak
    // zorunda) bu ikisi zaten eşdeğerdi, bu yüzden davranış değişmiyor.
    if (!isLastQuestion) {
      setShowNext(true);
    } else {
      // Oturum bitti — doğru sayısı `next` (bu soru dahil).
      onFinish?.({ correct: next, total });
      if (next >= total) {
        if (!done) onCorrect();
      } else {
        setAllAttempted(true);
      }
    }
  };

  const fail = (msg: string) => {
    setStatus('fail');
    setFeedback(msg);
    setSelected(null);
    if (noRetry) {
      setFailLocked(true);
      onAnswered?.(currentIdx, doneCount, 'wrong');
      if (!isLastQuestion) {
        setShowNext(true);
      } else {
        // Son soru yanlis: dogru sayisi ARTMAZ, oturum burada biter.
        onFinish?.({ correct: doneCount, total });
        setAllAttempted(true);
      }
    } else {
      // Retry İZİN VERİLEN modlarda (noRetry=false) geçici uyarı — 1.8sn
      // sonra kendiliğinden kapanır, sporcu aynı soruyu tekrar dener.
      setTimeout(() => setStatus('idle'), 1800);
    }
  };

  // Kareye Tıkla'da yanlış cevapta tekrar deneme yok: geri bildirim gösterilir,
  // sonra sporcu sonraki soruya geçer. doneCount ARTIRILMAZ — yanlış cevap
  // ilerleme noktalarında doğru gibi görünmemeli.
  const failNoRetry = (msg: string) => {
    setStatus('fail');
    setFeedback(msg);
    setSelected(null);
    onAnswered?.(currentIdx, doneCount, 'wrong');
    if (!isLastQuestion) {
      setShowNext(true);
    } else {
      // Oturum bitti — bu soru YANLIŞ olduğu için doneCount artmadı.
      onFinish?.({ correct: doneCount, total });
      setAllAttempted(true);
    }
  };

  const goNext = () => {
    setCurrentIdx((i) => Math.min(i + 1, total - 1));
    setShowNext(false);
    setMultiClicked([]); // yeni soru: çoklu-kare sayacı sıfırlanır (madde 2)
  };

  // ── Tahta kareleri (sadece tahta tipleri için) ─────────────────────────────
  const styles: Record<string, CSSProperties> = {};
  if (isBoardExercise(exercise)) {
    if (status !== 'success' || showNext) {
      // Yeni format (moves) sorularda ipucu karesi yok — tahtayı MovePieceSolver çiziyor.
      if (exercise.type !== 'identify_piece' && !('moves' in exercise)) {
        (exercise.hint_squares ?? []).forEach((sq) => {
          styles[sq] = { backgroundColor: 'rgba(255,200,0,0.50)' };
        });
      }
      if (exercise.type === 'identify_piece') {
        styles[exercise.highlight_square] = { backgroundColor: 'rgba(255,200,0,0.65)' };
      }
      if (selected) {
        styles[selected] = { backgroundColor: 'rgba(80,160,255,0.65)', cursor: 'pointer' };
      }
    }
    // 'moves' alanı varsa bu YENİ format (P4) bir soru — target_squares yok, okunursa çöker.
    if (status === 'success' && exercise.type === 'move_piece' && !('moves' in exercise)) {
      exercise.target_squares.forEach((sq) => {
        styles[sq] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      });
    }
    if (exercise.type === 'click_square' && clickedSquare) {
      if (status === 'success') {
        styles[clickedSquare] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      } else if (status === 'fail') {
        styles[clickedSquare] = { backgroundColor: 'rgba(239,68,68,0.45)' };
      }
    }
  }

  // ── Tahta tıklama ────────────────────────────────────────────────────────
  const onSquareClick = ({ square }: { square: string; piece: { pieceType: string } | null }) => {
    if (!isBoardExercise(exercise)) return;
    // Yanlis cevaptan sonra (noRetry) tahta da KILITLI kalir.
    if (status === 'success' || failLocked) return;
    // Kareye Tıkla'da yanlış cevaptan sonra soru kilitlenir (tekrar deneme yok).
    // Diğer tipler (ör. Taşı Oynat) fail penceresinde hemen tekrar denenebilmeye devam eder.
    if (exercise.type === 'click_square' && status === 'fail') return;

    if (exercise.type === 'click_square') {
      setClickedSquare(square);
      // 'all' modu (madde 2): TÜM doğru kareler tıklanmalı; 1 yanlış = yanlış.
      if ((exercise.click_mode ?? 'any') === 'all') {
        const r = evaluateClick(square, exercise.target_squares, multiClicked);
        if (r === 'wrong') { failNoRetry(exercise.fail_msg ?? 'Yanlış kare!'); return; }
        if (r === 'complete') { setMultiClicked([]); succeed(); return; }
        setMultiClicked((p) => (p.includes(square) ? p : [...p, square])); // partial
        return;
      }
      // 'any' modu (varsayılan, eski davranış): tek doğru kare yeter.
      if (isTargetSquare(square, exercise.target_squares)) {
        succeed();
      } else {
        failNoRetry(exercise.fail_msg ?? 'Yanlış kare!');
      }
      return;
    }

    // Yeni format (moves) soruların tahtası burada render EDİLMİYOR — MovePieceSolver
    // kendi tahtasını çiziyor. Açık daraltma TypeScript'in bunu bilmesi için gerekli.
    if (exercise.type === 'move_piece' && !('moves' in exercise)) {
      if (!selected) {
        if (square === exercise.piece_square) {
          setSelected(square);
        }
        return;
      }
      if (square === exercise.piece_square) {
        setSelected(null);
        return;
      }
      if (exercise.target_squares.includes(square)) {
        setPlayedMove({ from: exercise.piece_square, to: square });
        succeed();
      } else {
        fail(exercise.fail_msg ?? 'Yanlış kare! Altın renkli kareye taşı.');
      }
    }
  };

  // ── Seçenek tıklama (sentence_question / image_question) ──────────────────
  const onChoiceAnswer = (i: number) => {
    if (status === 'success' || failLocked || isBoardExercise(exercise)) return;
    if (i === exercise.correct_index) {
      succeed();
    } else {
      fail(exercise.fail_msg ?? 'Yanlış! Tekrar dene.');
    }
  };

  // ── If all done and no more exercises ──────────────────────────────────────
  if (done && !showNext) {
    return (
      <div className="mt-2 pt-3 space-y-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold"
          style={{ background: '#dcfce7', color: '#15803d' }}>
          ✓ Tüm egzersizler tamamlandı!
        </div>
      </div>
    );
  }

  // Kareye Tıkla'da tekrar deneme olmadığı için dizi bitebilir ama hepsi doğru
  // olmayabilir — bu durumda onCorrect çağrılmaz (puanlama P6'ya bırakıldı),
  // sadece yerel bir "bitti" ekranı gösterilir.
  if (allAttempted) {
    return (
      <div className="mt-2 pt-3 space-y-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-muted)' }}>
          Bu bölümdeki tüm sorular cevaplandı.
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 mt-2 pt-3" style={{ borderTop: '1px solid var(--t-border)' }}>

      {/* Progress */}
      <div className="flex items-center justify-between">
        <ProgressDots total={total} current={currentIdx} doneCount={doneCount} />
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-muted)' }}>
          Soru {currentIdx + 1}/{total}
        </span>
      </div>

      <div className="practice-grid">
        <div className="pg-board">
          <div className="flex items-stretch gap-1.5">
            {exercise.code && (
              <span
                className="pg-code flex-shrink-0 flex items-center justify-center text-[10px] font-mono font-bold select-none"
                style={{ color: 'var(--t-muted)' }}
              >
                KOD - {exercise.code}
              </span>
            )}
            <div className="flex-1 min-w-0">
              {exercise.type === 'move_piece' && 'moves' in exercise ? (
                /*
                  key ZORUNLU: MovePieceSolver oynanan hamleleri kendi state'inde tutuyor.
                  key olmadan React soru değişince aynı örneği yeniden kullanır ve önceki
                  sorunun hamleleri taşınır — sonraki sorunun DOĞRU hamlesi "yanlış" sayılır
                  (canlı doğrulamada bu hata gerçekten yaşandı).
                */
                <MovePieceSolver
                  key={currentIdx}
                  exercise={exercise}
                  disabled={status !== 'idle'}
                  onSolved={() => succeed()}
                  onWrong={(msg) => failNoRetry(msg)}
                />
              ) : isBoardExercise(exercise) ? (
                /* Board — kenar rakam/harf etiketleriyle, uygulamanın ortak
                   tahta temasıyla (madde 1: eskiden ham react-chessboard
                   kullanılıyordu, tema ve notasyon uygulanmıyordu). */
                <div
                  data-testid="board-exercise-coord-frame"
                  className="w-full mx-auto p-3 rounded-2xl"
                  style={{ maxWidth: 340, backgroundColor: BOARD_CARD_BG }}
                >
                  <div className="flex">
                    <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
                      {ranks.map((r) => (
                        <span key={r} className="flex items-center justify-center font-semibold select-none"
                          style={{ fontSize: 12, color: BOARD_LABEL_COLOR }}>{r}</span>
                      ))}
                    </div>
                    <div className="aspect-square flex-1" style={BOARD_STYLE}>
                      <Chessboard
                        options={{
                          position: exercise.fen,
                          allowDragging: false,
                          squareStyles: styles,
                          onSquareClick,
                          pieces: pieceSet,
                          lightSquareStyle: { backgroundColor: boardColors.light },
                          darkSquareStyle: { backgroundColor: boardColors.dark },
                          showNotation: false,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex" style={{ paddingLeft: 18 }}>
                    {files.map((f) => (
                      <span key={f} className="flex-1 text-center font-semibold select-none"
                        style={{ fontSize: 12, color: BOARD_LABEL_COLOR }}>{f}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <ChoiceQuestionVisual exercise={exercise} />
              )}
            </div>
          </div>
        </div>

        <div className="pg-content space-y-3">
          {isBoardExercise(exercise) ? (
            <>
              {/* Talimat — tahtanın yanında (yatay) / altında (dikey) kart olarak */}
              <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
                style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
                <span className="text-xl leading-none flex-shrink-0">🎯</span>
                <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
              </div>

              {/* Multiple-choice for identify_piece */}
              {exercise.type === 'identify_piece' && status !== 'success' && (
                <div className="grid grid-cols-2 gap-2">
                  {exercise.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (i === exercise.correct_index) succeed();
                        else fail('Yanlış! Tekrar bak ve dene.');
                      }}
                      className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all"
                      style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Helper hint for move_piece (eski format — yeni format kendi
                  tahtasını MovePieceSolver ile çizer, ipucu metni kullanmaz) */}
              {exercise.type === 'move_piece' && !('moves' in exercise) && status === 'idle' && (
                <p className="text-xs" style={{ color: 'var(--t-muted)' }}>
                  {selected ? '✔ Taş seçildi — şimdi hedef kareye tıkla!' : 'Önce taşa tıkla, sonra gideceği kareye tıkla.'}
                </p>
              )}
            </>
          ) : (
            <ChoiceQuestionAnswers exercise={exercise} disabled={status === 'success'} onAnswer={onChoiceAnswer} />
          )}
        </div>
      </div>

      {/* Yeniden denemenin HALA mumkun oldugu yanlis cevap (showNext=false):
          eski gecici uyari — 1.8sn sonra kendiliginden kapanir, sporcu ayni
          soruyu tekrar dener. Madde 6'nin iki-kart tasarimi bunun icin
          DEGIL — o sadece "sonraki soruya gec" ani icin. */}
      {status === 'fail' && !showNext && (
        <div className="bea-shake flex items-center gap-3 py-3 px-4 rounded-2xl text-sm font-bold"
          style={{
            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
            color: '#fff',
            boxShadow: '0 6px 18px -6px rgba(239,68,68,0.5)',
          }}>
          <span className="text-2xl flex-shrink-0">🤔</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Madde 6: seceneklerin altinda Geribildirim karti — dogru: yesil
          tik, yanlis: kirmizi çarpı. SONRAKI SORUYA GECILEBILECEGI an
          (showNext) yaninda "Sonraki Soruya Geç" karti da belirir; son
          soruda (showNext=false) tek basina, tam genislikte kalir — eski
          davranista oldugu gibi geri bildirim HER ZAMAN gorunur. */}
      {(status === 'success' || status === 'fail') && (status === 'success' || showNext) && (
        <>
          <div className={showNext && doneCount < total ? 'grid grid-cols-2 gap-2' : ''}>
            <div
              className="t-card-i flex flex-col items-center justify-center gap-1.5 py-4 px-2 text-center"
              style={{
                borderColor: status === 'success' ? '#16a34a' : '#dc2626',
                background: status === 'success'
                  ? 'color-mix(in srgb, #16a34a 12%, transparent)'
                  : 'color-mix(in srgb, #dc2626 12%, transparent)',
              }}
            >
              <span
                aria-hidden="true"
                style={{ fontSize: '1.75rem', lineHeight: 1, color: status === 'success' ? '#16a34a' : '#dc2626' }}
              >
                {status === 'success' ? '✓' : '✕'}
              </span>
              <span className="text-xs font-semibold" style={{ color: status === 'success' ? '#16a34a' : '#dc2626' }}>
                {status === 'success' ? (exercise.success_msg ?? 'Aferin! Doğru yaptın! 👏') : (feedback || 'Yanlış!')}
              </span>
            </div>
            {showNext && doneCount < total && (
              <button
                onClick={goNext}
                className="t-card-i flex flex-col items-center justify-center gap-1.5 py-4 px-2 text-center transition-all"
                style={{ background: 'var(--t-accent)', color: '#fff', border: 'none' }}
              >
                <span className="text-xl leading-none" aria-hidden="true">➡️</span>
                <span className="text-sm font-bold">Sonraki Soruya Geç</span>
              </button>
            )}
          </div>

          {/* Madde 6: satranç taşı hareketiyle ilgili sorularda, doğru
              cevapta geri bildirim kartının altında sporcunun hamlesini
              gösteren notasyon kartı. */}
          {status === 'success' && (() => {
            if (!isBoardExercise(exercise) || exercise.type !== 'move_piece') return null;
            let san: string[] | null = null;
            if ('moves' in exercise) {
              san = exercise.moves;
            } else if (playedMove) {
              try {
                // SKIPVALIDATION SART: Zafer Hoca'nin ogretim pozisyonlari
                // KASTEN sahsiz olabilir (bkz. ChessBoard.tsx). Validasyonlu
                // constructor "missing king" firlatir, notasyon kartı
                // SESSIZCE hic gorunmezdi (olculdu — test bunu yakaladi).
                const chess = new Chess(exercise.fen, { skipValidation: true });
                const mv = chess.move({ from: playedMove.from, to: playedMove.to, promotion: 'q' });
                san = mv ? [mv.san] : null;
              } catch { san = null; }
            }
            if (!san || san.length === 0) return null;
            return <MoveList san={san} startFen={exercise.fen} />;
          })()}
        </>
      )}
    </div>
  );
}

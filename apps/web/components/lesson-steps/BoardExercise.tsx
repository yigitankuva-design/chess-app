'use client';
import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { playPieceSound } from '@/lib/sounds/pieceSounds';
import { ChoiceQuestionBody } from './ChoiceQuestionBody';
import { MovePieceSolver } from './MovePieceSolver';

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
}

export interface ImageQuestionEx {
  type: 'image_question';
  /** İsteğe bağlı alt başlık/açıklama — '' olabilir. */
  instruction: string;
  prompt_image: string;
  answer_kind: 'sentence' | 'image';
  options: string[];
  correct_index: number;
  success_msg?: string;
  fail_msg?: string;
  code?: string;
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
  initialIndex = 0, onIndexChange,
}: Props) {
  // Sinirlar icinde tutulur: kayitli sira soru sayisindan buyukse patlamaz.
  const [currentIdx, setCurrentIdx] = useState(
    initialIndex > 0 && initialIndex < exercises.length ? initialIndex : 0,
  );
  const [doneCount, setDoneCount] = useState(done ? exercises.length : 0);
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>(done ? 'success' : 'idle');
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);
  const [clickedSquare, setClickedSquare] = useState<string | null>(null);
  const [allAttempted, setAllAttempted] = useState(false);
  /** Madde 1: Suresiz Pratik'te yanlis cevaptan sonra tekrar deneme YOK;
   *  soru kilitlenir, sporcu "Sonraki Soruya Geç" ile ilerler. */
  const [failLocked, setFailLocked] = useState(false);

  const exercise = exercises[currentIdx] ?? exercises[0];
  const total = exercises.length;
  const isLastQuestion = currentIdx === total - 1;

  // Reset per-exercise state when index changes
  useEffect(() => {
    if (done) return;
    setStatus('idle');
    setFeedback('');
    setSelected(null);
    setShowNext(false);
    setClickedSquare(null);
    setFailLocked(false);
    onIndexChange?.(currentIdx);
    // onIndexChange kasten bagimlilikta DEGIL: her renderda yeni fonksiyon
    // gelirse efekt bosuna tekrar calisir ve durum sifirlanir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, done]);

  const succeed = (piece?: string | null) => {
    if (piece) playPieceSound(piece);
    setStatus('success');
    setSelected(null);
    const next = doneCount + 1;
    setDoneCount(next);
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
      if (!isLastQuestion) {
        setShowNext(true);
      } else {
        // Son soru yanlis: dogru sayisi ARTMAZ, oturum burada biter.
        onFinish?.({ correct: doneCount, total });
        setAllAttempted(true);
      }
    }
    setTimeout(() => setStatus('idle'), 1800);
  };

  // Kareye Tıkla'da yanlış cevapta tekrar deneme yok: geri bildirim gösterilir,
  // sonra sporcu sonraki soruya geçer. doneCount ARTIRILMAZ — yanlış cevap
  // ilerleme noktalarında doğru gibi görünmemeli.
  const failNoRetry = (msg: string) => {
    setStatus('fail');
    setFeedback(msg);
    setSelected(null);
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
  const onSquareClick = ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (!isBoardExercise(exercise)) return;
    // Yanlis cevaptan sonra (noRetry) tahta da KILITLI kalir.
    if (status === 'success' || failLocked) return;
    // Kareye Tıkla'da yanlış cevaptan sonra soru kilitlenir (tekrar deneme yok).
    // Diğer tipler (ör. Taşı Oynat) fail penceresinde hemen tekrar denenebilmeye devam eder.
    if (exercise.type === 'click_square' && status === 'fail') return;

    if (exercise.type === 'click_square') {
      if (piece) playPieceSound(piece.pieceType);
      setClickedSquare(square);
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
          if (piece) playPieceSound(piece.pieceType);
        }
        return;
      }
      if (square === exercise.piece_square) {
        setSelected(null);
        return;
      }
      if (exercise.target_squares.includes(square)) {
        succeed(piece?.pieceType);
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
        <span className="flex items-center gap-1.5">
          {exercise.code && (
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--t-surface-2)', color: 'var(--t-muted)' }}>
              #{exercise.code}
            </span>
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--t-surface-2)', color: 'var(--t-muted)' }}>
            Soru {currentIdx + 1}/{total}
          </span>
        </span>
      </div>

      {exercise.type === 'move_piece' && 'moves' in exercise ? (
        <>
          {/*
            key ZORUNLU: MovePieceSolver oynanan hamleleri kendi state'inde tutuyor.
            key olmadan React soru değişince aynı örneği yeniden kullanır ve önceki
            sorunun hamleleri taşınır — sonraki sorunun DOĞRU hamlesi "yanlış" sayılır
            (canlı doğrulamada bu hata gerçekten yaşandı).
          */}
          <MovePieceSolver
            key={currentIdx}
            exercise={exercise}
            disabled={status !== 'idle'}
            onSolved={() => succeed()}
            onWrong={(msg) => failNoRetry(msg)}
          />
          {/* Talimat — tahtanın altında kart olarak (diğer tiplerle aynı stil) */}
          <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
            style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
            <span className="text-xl leading-none flex-shrink-0">🎯</span>
            <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
          </div>
        </>
      ) : isBoardExercise(exercise) ? (
        <>
          {/* Board */}
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ maxWidth: 340, margin: '0 auto' }}>
            <Chessboard
              options={{
                position: exercise.fen,
                allowDragging: false,
                squareStyles: styles,
                onSquareClick,
              }}
            />
          </div>

          {/* Instruction — tahtanın altında kart olarak */}
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

          {/* Helper hint for move_piece */}
          {exercise.type === 'move_piece' && status === 'idle' && (
            <p className="text-xs" style={{ color: 'var(--t-muted)' }}>
              {selected ? '✔ Taş seçildi — şimdi hedef kareye tıkla!' : 'Önce taşa tıkla, sonra gideceği kareye tıkla.'}
            </p>
          )}
        </>
      ) : (
        <ChoiceQuestionBody exercise={exercise} disabled={status === 'success'} onAnswer={onChoiceAnswer} />
      )}

      {/* Feedback — dikkat çekici ve ilgi çekici */}
      {status === 'success' && (
        <div className="bea-pop relative flex items-center gap-3 py-3.5 px-4 rounded-2xl text-base font-extrabold overflow-visible"
          style={{
            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            color: '#fff',
            boxShadow: '0 8px 24px -6px rgba(34,197,94,0.6)',
          }}>
          <span className="text-2xl bea-bounce flex-shrink-0">🎉</span>
          <span>{exercise.success_msg ?? 'Aferin! Doğru yaptın! 👏'}</span>
          {/* yukarı süzülen emoji patlaması */}
          <div className="bea-burst pointer-events-none absolute inset-0">
            {['⭐', '✨', '🎊', '⭐', '✨'].map((e, i) => (
              <span key={i} style={{ left: `${12 + i * 19}%`, top: '40%', fontSize: 18, animationDelay: `${i * 0.06}s` }}>{e}</span>
            ))}
          </div>
        </div>
      )}
      {status === 'fail' && (
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

      {/* Next exercise button */}
      {showNext && doneCount < total && (
        <button
          onClick={goNext}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--t-accent)', color: '#fff' }}>
          {failLocked ? 'Sonraki Soruya Geç →' : 'Sonraki Soru →'}
        </button>
      )}
    </div>
  );
}

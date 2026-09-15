'use client';
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { PromotionPicker } from '@/components/play/PromotionPicker';
import { isPromotionMove, toUci } from '@/lib/play/promotion';
import type { PromotionPiece } from '@/lib/play/promotion';
import {
  createAdayHamleSession, submitAdayHamleAnswer, finishAdayHamleSession,
} from '@/lib/adayHamleApi';
import type { AdayHamleCandidateMove, AdayHamlePosition } from '@/lib/adayHamleApi';
import type { CustomTabSection } from '@/lib/customTabsApi';

interface Props {
  sectionId: number;
  positions: CustomTabSection['practice_positions'];
}

/** Bir hamleden sonra tahtanın pozisyonun başına dönmesi için beklenen süre. */
const RESET_DELAY_MS = 3000;
const DURATIONS = [5, 10, 15] as const;

type Phase = 'sure-sec' | 'pratik' | 'kontrol-et';

interface Guess {
  uci: string;
  san: string;
}

interface HistoryItem {
  fen: string;
  candidateMoves: AdayHamleCandidateMove[];
  guesses: Guess[];
  results: boolean[];
}

const CARD_NEUTRAL = { background: 'var(--t-surface-2)', border: '1px solid var(--t-border)', color: 'var(--t-text-1)' };
const CARD_GREEN = { background: 'rgba(34,197,94,0.18)', border: '1px solid #22c55e', color: '#16a34a' };
const CARD_RED = { background: 'rgba(244,63,94,0.18)', border: '1px solid #f43f5e', color: '#e11d48' };

/**
 * Aday Hamle Pratiği — sporcu tarafı (madde 2026-09-16). Motor burada HİÇ
 * çalışmaz; her pozisyon için sporcunun 3 tahmini, admin'in "Analiz Et" ile
 * bir kez kaydettiği cevap anahtarıyla backend'de karşılaştırılır.
 *
 * Akış (route DEĞİŞMEZ, tamamı CustomTabPanel'in içinde yerinde çizilir):
 * süre seç → [pozisyon: 1. hamle (kartta görünür, renksiz) → 3sn sonra
 * başa dön → 2. hamle → 3. hamle → "Kaydet" → yeşil/kırmızı geri bildirim
 * → "Sonraki Pozisyon"] × N → süre dolunca/havuz bitince "Kontrol Et".
 */
export function AdayHamlePractice({ sectionId, positions }: Props) {
  const pool = positions.filter((p) => p.candidate_moves && p.candidate_moves.length > 0);
  const poolById = new Map(pool.map((p) => [p.id, p]));

  const [phase, setPhase] = useState<Phase>('sure-sec');
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<AdayHamlePosition | null>(null);
  const [displayFen, setDisplayFen] = useState('');
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [awaitingReset, setAwaitingReset] = useState(false);
  const [feedback, setFeedback] = useState<boolean[] | null>(null);
  const [pendingAdvance, setPendingAdvance] = useState<{ finished: boolean; next: AdayHamlePosition | null } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  // Süre sayacı — TEK bir setInterval (pratik/[mode]/page.tsx'teki zincirleme
  // setTimeout+efekt deseninin AKSİNE): efekt yalnızca 'pratik' fazına
  // girilince BİR KEZ kurulur, saniyede bir kendi kendine tetiklenir —
  // pozisyonlar arası SIFIRLANMAZ (dependency olarak sadece `phase`).
  useEffect(() => {
    if (phase !== 'pratik') return;
    const id = setInterval(() => {
      setSecondsLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          setTimeUp(true);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Süre dolunca: yarım kalan (Kaydet'e basılmamış) tahmin sayılmadan oturum biter.
  useEffect(() => {
    if (!timeUp) return;
    (async () => {
      if (sessionId) await finishAdayHamleSession(sessionId);
      setPhase('kontrol-et');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  if (pool.length === 0) {
    return <p className="t-muted text-sm">Henüz pratik yapılacak pozisyon yok.</p>;
  }

  async function handleStart() {
    setErr(null);
    setBusy(true);
    const created = await createAdayHamleSession(sectionId, durationMinutes);
    setBusy(false);
    if (!created) { setErr('Pratik başlatılamadı.'); return; }
    setSessionId(created.id);
    setCurrentPosition(created.position);
    setDisplayFen(created.position.fen);
    setSecondsLeft(durationMinutes * 60);
    setGuesses([]);
    setFeedback(null);
    setPendingAdvance(null);
    setHistory([]);
    setPhase('pratik');
  }

  function applyGuess(from: Square, to: Square, promotion: PromotionPiece | undefined): boolean {
    if (!currentPosition || awaitingReset || guesses.length >= 3 || feedback) return false;
    // HER tahmin, önceki tahminlerden BAĞIMSIZ olarak pozisyonun ORİJİNAL
    // FEN'inden başlar — bir öncekinin üstüne inşa edilmez.
    const board = new Chess(currentPosition.fen);
    let move;
    try {
      move = board.move({ from, to, promotion });
    } catch {
      return false;
    }
    if (!move) return false;
    const uci = toUci(from, to, promotion);
    setGuesses((prev) => [...prev, { uci, san: move.san }]);
    setDisplayFen(board.fen());
    setAwaitingReset(true);
    setTimeout(() => {
      setDisplayFen(currentPosition.fen);
      setAwaitingReset(false);
    }, RESET_DELAY_MS);
    return true;
  }

  function handleDrop(from: Square, to: Square): boolean {
    if (!currentPosition || awaitingReset || guesses.length >= 3 || feedback) return false;
    const board = new Chess(currentPosition.fen);
    if (isPromotionMove(board.get(from), to)) {
      setPendingPromotion({ from, to });
      return false;
    }
    return applyGuess(from, to, undefined);
  }

  async function handleKaydet() {
    if (!sessionId || !currentPosition || guesses.length !== 3) return;
    setBusy(true);
    const res = await submitAdayHamleAnswer(sessionId, guesses.map((g) => g.uci));
    setBusy(false);
    if (!res) { setErr('Kaydedilemedi — tekrar dene.'); return; }
    setErr(null);
    setFeedback(res.results);
    setPendingAdvance({ finished: res.finished, next: res.next_position });
    const candidateMoves = poolById.get(currentPosition.id)?.candidate_moves ?? [];
    setHistory((prev) => [...prev, {
      fen: currentPosition.fen, candidateMoves, guesses, results: res.results,
    }]);
  }

  function handleNext() {
    if (!pendingAdvance) return;
    if (pendingAdvance.finished || !pendingAdvance.next) {
      setPhase('kontrol-et');
      return;
    }
    const next = pendingAdvance.next;
    setCurrentPosition(next);
    setDisplayFen(next.fen);
    setGuesses([]);
    setFeedback(null);
    setPendingAdvance(null);
  }

  if (phase === 'sure-sec') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest t-muted mb-2">
            Pratik Yapma Sürenizi Belirleyiniz
          </p>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button key={d} type="button" onClick={() => setDurationMinutes(d)}
                aria-pressed={durationMinutes === d}
                className="flex-1 rounded-lg px-3 py-2 text-sm font-bold"
                style={durationMinutes === d
                  ? { background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }
                  : { background: 'var(--t-surface-2)', color: 'var(--t-text-2)', border: '1px solid var(--t-border)' }}>
                {d} dk
              </button>
            ))}
          </div>
        </div>
        {err && <p className="text-sm" style={{ color: '#f43f5e' }}>{err}</p>}
        <button type="button" onClick={handleStart} disabled={busy}
          className="w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40"
          style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
          {busy ? 'Başlatılıyor…' : 'BAŞLA'}
        </button>
      </div>
    );
  }

  if (phase === 'pratik' && currentPosition) {
    const mm = String(Math.floor(Math.max(secondsLeft, 0) / 60)).padStart(2, '0');
    const ss = String(Math.max(secondsLeft, 0) % 60).padStart(2, '0');
    const canGuess = !awaitingReset && guesses.length < 3 && !feedback;
    const showKaydet = guesses.length === 3 && !awaitingReset && !feedback;

    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <span className="font-extrabold text-sm px-3 py-1.5 rounded-xl"
            style={{
              background: 'color-mix(in srgb, var(--t-accent) 12%, transparent)',
              border: '1px solid var(--t-accent)',
              color: secondsLeft <= 30 ? '#f87171' : 'var(--t-accent)',
            }}>
            {mm}:{ss}
          </span>
        </div>

        <ChessBoard fen={displayFen} interactive={canGuess} onPieceDrop={handleDrop} />

        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} data-testid={`aday-hamle-kart-${i + 1}`}
              className="rounded-lg px-2 py-3 text-center text-sm font-bold"
              style={feedback ? (feedback[i] ? CARD_GREEN : CARD_RED) : CARD_NEUTRAL}>
              {guesses[i]?.san ?? ''}
            </div>
          ))}
        </div>

        {err && <p className="text-sm" style={{ color: '#f43f5e' }}>{err}</p>}

        {showKaydet && (
          <button type="button" onClick={handleKaydet} disabled={busy}
            className="w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        )}

        {feedback && (
          <button type="button" onClick={handleNext}
            className="w-full rounded-xl px-4 py-3 text-sm font-bold"
            style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
            Sonraki Pozisyon
          </button>
        )}

        {pendingPromotion && (
          <PromotionPicker
            color={new Chess(currentPosition.fen).turn()}
            onPick={(piece) => {
              const p = pendingPromotion;
              setPendingPromotion(null);
              if (p) applyGuess(p.from, p.to, piece);
            }}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
      </div>
    );
  }

  // 'kontrol-et'
  if (history.length === 0) {
    return <p className="t-muted text-sm">Bu oturumda hiç pozisyon tamamlanmadı.</p>;
  }
  const item = history[reviewIndex];
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest t-muted">
        Kontrol Et — {reviewIndex + 1}/{history.length}
      </p>
      <ChessBoard fen={item.fen} interactive={false} onPieceDrop={() => false} />
      <div className="grid grid-cols-3 gap-2">
        {item.guesses.map((g, i) => (
          <div key={i} className="rounded-lg px-2 py-3 text-center text-sm font-bold"
            style={item.results[i] ? CARD_GREEN : CARD_RED}>
            {g.san}
          </div>
        ))}
      </div>
      <p className="text-xs t-muted">
        Doğru cevap: {item.candidateMoves.map((c) => c.move_san).join(' · ')}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
          disabled={reviewIndex === 0}
          className="flex-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-40"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)', border: '1px solid var(--t-border)' }}>
          ← Geri
        </button>
        <button type="button" onClick={() => setReviewIndex((i) => Math.min(history.length - 1, i + 1))}
          disabled={reviewIndex === history.length - 1}
          className="flex-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-40"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-2)', border: '1px solid var(--t-border)' }}>
          İleri →
        </button>
      </div>
    </div>
  );
}

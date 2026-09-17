'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chess } from 'chess.js';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { AnalizPageHeader } from '@/components/analiz/AnalizPageHeader';
import { MovePieceSolver } from '@/components/lesson-steps/MovePieceSolver';
import type { MovePieceSequenceEx } from '@/components/lesson-steps/BoardExercise';
import { useServerGameAnalysis } from '@/lib/chess/useServerGameAnalysis';
import type { MistakeMoveInfo } from '@/lib/chess/gameSummary';

const SEVERITY_LABEL: Record<MistakeMoveInfo['severity'], string> = {
  inaccuracy: 'Kusurlu hamle',
  mistake: 'Hata',
  blunder: 'Vahim hata',
};

/** `bestMove` (motorun UCI çıktısı) MovePieceSolver'ın beklediği SAN'a
 *  çevrilir — chess.js hamleyi FEN üzerinde OYNAYARAK üretir, bu yüzden
 *  aynı zamanda hamlenin GEÇERLİ olduğunu da doğrular. */
function uciToSan(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion });
    return move ? move.san : null;
  } catch {
    return null;
  }
}

/**
 * Madde 2026-09-14 (3c): "Hatalarını Gözden Geçir" — BotGame'in "Analiz
 * Et" özet kartından `?gameId=` ile gelinir. O maçta kusurlu/hata/vahim-
 * hata olarak işaretlenen HER hamleyi (bkz. GameAnalysis.mistake_moves_json,
 * apps/api/chess_api/routers/games.py::get_game_analysis), uygulamada
 * ZATEN VAR OLAN "doğru hamleyi bul" pratik bileşeniyle (MovePieceSolver,
 * Pratik Yap'ta kullanılıyor) tek-hamlelik bir egzersize çevirir — sporcu
 * o pozisyonda gerçekten doğru hamleyi bulmaya çalışır (Zafer'in onayı:
 * "interaktif — doğru hamleyi bul"). Puzzle/SRS bankasına (routers/
 * puzzles.py) KARIŞMAZ — bu egzersizler o maça özel, kalıcı kaydedilmez.
 * Madde 2026-09-15 (sunucu analiz motoru): bu sayfaya DOĞRUDAN bağlantıyla
 * gelinebildiği için (BotGame'in her zaman önce tetiklediği varsayılamaz)
 * `useServerGameAnalysis` KENDİSİ tetikleyip (POST) sonucu poll eder (GET).
 */
export default function HatalarimPage() {
  return (
    <Suspense fallback={<main id="main-content" className="px-4 pt-5 max-w-lg mx-auto"><p className="text-sm t-muted">Yükleniyor…</p></main>}>
      <HatalarimPageInner />
    </Suspense>
  );
}

function HatalarimPageInner() {
  useTabGuard('analiz');
  const router = useRouter();
  const params = useSearchParams();
  const gameId = Number(params.get('gameId'));

  const analysis = useServerGameAnalysis(gameId || null, !!gameId);
  const [index, setIndex] = useState(0);
  const [wrongMsg, setWrongMsg] = useState<string | null>(null);
  // Madde 2026-09-18: "en iyi hamleyi göster" ipucu — her yeni soruda kapalı
  // başlar, soru bir İPUCU sonrası da AKTİF kalır (sporcu hâlâ kendisi
  // oynayabilir) — "Çözümü Göster"ten farkı budur.
  const [showBestMove, setShowBestMove] = useState(false);

  // undefined = yükleniyor, null = analiz bulunamadı/hazır değil.
  const mistakes: MistakeMoveInfo[] | null | undefined =
    analysis.status === 'done' ? (analysis.summary?.mistakeMoves ?? [])
      : analysis.status === 'error' ? null
        : undefined;

  const current = mistakes?.[index] ?? null;
  const exercise: MovePieceSequenceEx | null = useMemo(() => {
    if (!current) return null;
    const san = uciToSan(current.fenBefore, current.bestMove);
    if (!san) return null;
    return {
      type: 'move_piece',
      instruction: `${SEVERITY_LABEL[current.severity]} — doğru hamleyi bul!`,
      fen: current.fenBefore,
      moves: [san],
    };
  }, [current]);

  useEffect(() => { setShowBestMove(false); }, [current?.ply]);

  function goToNext() {
    setWrongMsg(null);
    setShowBestMove(false);
    setIndex((i) => i + 1);
  }

  if (!gameId) {
    return <main id="main-content" className="px-4 pt-5 max-w-lg mx-auto"><p className="text-sm t-muted">Geçersiz bağlantı.</p></main>;
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <AnalizPageHeader title="Hatalarını Gözden Geçir" />

      {mistakes === undefined ? (
        <p className="text-sm t-muted text-center">Yükleniyor…</p>
      ) : mistakes === null ? (
        <div className="space-y-3 text-center">
          <p className="text-sm t-muted">
            Bu maçın analizi henüz hazır değil. Önce maçın &quot;Analiz Et&quot; ekranını aç.
          </p>
          <button type="button" onClick={() => router.push('/analiz/maclarim')}
            className="text-sm t-muted underline">← Maçlarım&apos;a dön</button>
        </div>
      ) : mistakes.length === 0 ? (
        <div className="space-y-3 text-center">
          <p className="text-base font-bold t-premium">Bu maçta hiç hata yapmadın!</p>
          <button type="button" onClick={() => router.push('/analiz/maclarim')}
            className="text-sm t-muted underline">← Maçlarım&apos;a dön</button>
        </div>
      ) : !current || !exercise ? (
        <div className="space-y-3 text-center">
          <p className="text-base font-bold t-premium">Tüm hatalarını gözden geçirdin!</p>
          <button type="button" onClick={() => router.push('/analiz/maclarim')}
            className="rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
            Maçlarım&apos;a dön
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#f87171' }}>{exercise.instruction}</p>
            <span className="text-xs t-muted shrink-0">{index + 1}/{mistakes.length}</span>
          </div>
          <MovePieceSolver
            key={current.ply}
            exercise={exercise}
            disabled={false}
            onSolved={() => { setWrongMsg(null); setIndex((i) => i + 1); }}
            onWrong={(msg) => setWrongMsg(msg)}
          />
          {wrongMsg && <p className="text-sm text-center" style={{ color: '#f43f5e' }}>{wrongMsg}</p>}

          {(() => {
            const mover = current.fenBefore.split(' ')[1] === 'b' ? 'Siyah' : 'Beyaz';
            const moveNumber = Math.ceil(current.ply / 2);
            const playedLabel = `${moveNumber}${current.ply % 2 === 0 ? '...' : '.'} ${current.playedSan} oynandı`;
            return (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border-2 px-3 py-2 text-center text-sm font-semibold"
                    style={{ borderColor: 'var(--t-border)' }}>
                    Hamle {mover === 'Beyaz' ? 'Beyazda' : 'Siyahta'}
                  </div>
                  <div className="rounded-lg border-2 px-3 py-2 text-center text-sm font-semibold"
                    style={{ borderColor: 'var(--t-border)', color: '#ef4444' }}>
                    {playedLabel}
                  </div>
                </div>

                <button type="button" onClick={() => setShowBestMove(true)}
                  className="w-full rounded-lg border-2 px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>
                  {showBestMove ? `En iyi hamle: ${exercise.moves[0]}` : `${mover}ın en iyi hamlesini göster`}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => {
                    // Sporcunun çözümü OKUYABİLMESİ için kısa bir gecikmeyle
                    // sonraki soruya geçilir — "en iyi hamleyi göster"
                    // ipucundan farkı, bu soruyu doğrudan TAMAMLAR.
                    setShowBestMove(true);
                    setTimeout(goToNext, 1200);
                  }}
                    className="rounded-lg px-3 py-2 text-sm font-bold"
                    style={{ background: '#22c55e', color: '#0a0a0a' }}>
                    Çözümü Göster
                  </button>
                  <button type="button" onClick={goToNext}
                    className="rounded-lg px-3 py-2 text-sm font-bold"
                    style={{ background: '#22c55e', color: '#0a0a0a' }}>
                    Bu Soruyu Geç
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </main>
  );
}

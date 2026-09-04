'use client';
import { useState } from 'react';
import { TeoriPratigiSolver } from './TeoriPratigiSolver';
import { MoveList } from '@/components/play/MoveList';
import { pickRandomPosition, pickDifferentPosition } from '@/lib/play/positionPool';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import { TEORI_PRATIGI_INSTRUCTION } from '@/lib/admin/teoriPratigiSteps';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

interface Props {
  questions: TeoriPratigiQuestion[];
}

/**
 * b) Açılış Teorisini Hatırla (eski adıyla Teori Pratiği) — havuzdan
 * rastgele bir soruyla başlar; tahtanın üstünde açılış/varyant adı
 * gösterilir. Doğru ya da yanlış bitince (teoriden çıkınca) tahta
 * kilitlenir, TEK satırda 3 parça görünür: "Teoriyi Tekrar Et" (AYNI soru
 * sıfırdan) / ✓-✕ durumu / "Farklı Teoriye Geç" (havuzdan BAŞKA bir soru) —
 * madde 2026-09-06 (ikinci tur/G).
 */
export function TeoriPratigiPractice({ questions }: Props) {
  const [current, setCurrent] = useState<TeoriPratigiQuestion | null>(
    questions.length > 0 ? pickRandomPosition(questions) : null,
  );
  const [attemptKey, setAttemptKey] = useState(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>('idle');
  const [feedback, setFeedback] = useState('');
  /** Madde 2026-09-04 (6): HAMLELER (notasyon) bölümü için — bu ekranda
   *  önceden YOKTU, BotGame'in kullandığı AYNI MoveList bileşenine verilir. */
  const [moves, setMoves] = useState<string[]>([]);

  if (questions.length === 0) {
    return <p className="px-4 text-sm t-muted">Bu bölümde henüz soru yok.</p>;
  }
  if (!current) return null;

  // Kod, hoca'nın admin panelinde gördüğü numarayla AYNI mantıkla üretilir.
  const kodlar = assignExerciseCodes(questions.map((q) => ({ code: q.code ?? undefined })));
  const kod = kodlar[questions.findIndex((q) => q.id === current.id)];

  function retrySame() {
    setStatus('idle'); setFeedback(''); setMoves([]);
    setAttemptKey((k) => k + 1);
  }

  function tryDifferent() {
    setCurrent((c) => pickDifferentPosition(questions, c?.id ?? null));
    setStatus('idle'); setFeedback(''); setMoves([]);
    setAttemptKey((k) => k + 1);
  }

  return (
    <div className="px-4 pt-3 pb-8 max-w-lg mx-auto space-y-3">
      {/* Madde 2026-09-04 (6): taş ikonu kaldırıldı, satır ortalandı. */}
      <p className="font-semibold text-sm text-center">
        {current.opening_name}
        {kod && <span className="t-muted font-mono"> · {kod}</span>}
      </p>

      {/* Madde 2026-09-04 (6): talimat ikonu kaldırıldı, metin ortalandı. */}
      <div className="flex items-start justify-center gap-3 py-3 px-4 rounded-xl"
        style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
        {/* Madde 2026-09-06 (üçüncü tur/3): admin artık talimat yazmıyor —
            current.instruction'daki (varsa eski/DB'deki) değer YOK SAYILIR. */}
        <p className="text-sm font-semibold text-center">{TEORI_PRATIGI_INSTRUCTION}</p>
      </div>

      <TeoriPratigiSolver
        key={attemptKey}
        question={current}
        disabled={status !== 'idle'}
        onSolved={() => setStatus('success')}
        onWrong={(msg) => { setStatus('fail'); setFeedback(msg); }}
        onMovesChange={setMoves}
      />

      {/* Madde 2026-09-04 (6): HAMLELER bölümü — bu ekranda önceden YOKTU. */}
      <MoveList san={moves} startFen={current.fen} />

      {status === 'fail' && (
        <div className="flex items-center gap-3 py-3 px-4 rounded-2xl text-sm font-bold"
          style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', color: '#fff' }}>
          <span className="text-2xl flex-shrink-0">🤔</span>
          <span>{feedback}</span>
        </div>
      )}

      {status !== 'idle' && (
        /* Madde 2026-09-06 (ikinci tur/G): eskiden İKİ ayrı parça (büyük
           ✓/✕ kartı + altında 2 buton satırı) idi — Zafer'in görseline göre
           TEK satırda 3 parça birleştirildi: sol/sağ butonlar + ortada
           durum kartı, üçü de aynı yükseklikte. */
        <div className="grid grid-cols-3 gap-2 items-stretch">
          <button type="button" onClick={retrySame}
            className="t-card-i py-3 px-2 text-sm font-bold text-center">
            Teoriyi Tekrar Et
          </button>
          <div className="t-card-i flex items-center justify-center py-3 px-2"
            style={{
              borderColor: status === 'success' ? '#16a34a' : '#dc2626',
              background: status === 'success'
                ? 'color-mix(in srgb, #16a34a 12%, transparent)'
                : 'color-mix(in srgb, #dc2626 12%, transparent)',
            }}>
            <span role="img" aria-label={status === 'success' ? 'Doğru' : 'Yanlış'}
              style={{ fontSize: '2rem', lineHeight: 1, color: status === 'success' ? '#16a34a' : '#dc2626' }}>
              {status === 'success' ? '✓' : '✕'}
            </span>
          </div>
          <button type="button" onClick={tryDifferent}
            className="t-card-i py-3 px-2 text-sm font-bold text-center">
            Farklı Teoriye Geç
          </button>
        </div>
      )}
    </div>
  );
}

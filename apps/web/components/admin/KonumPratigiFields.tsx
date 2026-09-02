'use client';
import { useState } from 'react';
import { compressImageToDataUri } from '@/lib/imageCompress';
import { PoolPicker } from './PoolPicker';
import { StepList } from './StepList';
import { konumPratigiSteps } from '@/lib/admin/konumPratigiSteps';
import { firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import { parseFenInput, withTurn } from '@/lib/chess/fenInput';
import { SavedPositionBoard } from './SavedPositionBoard';
import type { KonumPratigiQuestion } from '@/lib/customTabsApi';

interface Props {
  onSubmit: (q: KonumPratigiQuestion) => Promise<void>;
}

/**
 * a) Konum Pratiği — soru ekleme formu. Zafer'in belirttiği 6 adım:
 * Talimatı Gir, FEN Ekle (ZORUNLU, sadece yapıştırma — "Konum Diz" DEĞİL),
 * Seçenek Sayısını Belirle (2/3/4), Cevap Tipini Belirle (Cümle/Görüntü),
 * Cevapları Gir, Soruyu Ekle. Alan şekli lesson-steps'teki `sentence_question`
 * ile AYNI (bkz. components/lesson-steps/BoardExercise.tsx) — sporcu tarafı
 * bu soruları dönüşümsüz o bileşenle çizer.
 */
export function KonumPratigiFields({ onSubmit }: Props) {
  const [instruction, setInstruction] = useState('');
  const [fenText, setFenText] = useState('');
  const [fenTurnOverride, setFenTurnOverride] = useState<'w' | 'b' | null>(null);
  const [optionCount, setOptionCount] = useState<2 | 3 | 4>(2);
  const [optionCountChosen, setOptionCountChosen] = useState(false);
  const [answerKind, setAnswerKind] = useState<'sentence' | 'image'>('sentence');
  const [answerKindChosen, setAnswerKindChosen] = useState(false);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [openPoolFor, setOpenPoolFor] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = parseFenInput(fenText);
  const fenTouched = fenText.trim().length > 0;
  const fenTurn = parsed.ok ? (fenTurnOverride ?? parsed.turn) : 'w';
  const finalFen = parsed.ok ? withTurn(parsed.fen, fenTurn) : '';

  const steps = konumPratigiSteps({
    instruction, fenValid: parsed.ok, optionCountChosen, answerKindChosen, options,
  });
  const missing = firstIncomplete(steps);
  const gateOpen = allDone(steps);

  function setCount(n: 2 | 3 | 4) {
    setOptionCount(n);
    setOptions((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
    setCorrectIndex((prev) => (prev >= n ? 0 : prev));
  }

  async function onOptionImageFile(i: number, file: File | undefined) {
    if (!file) return;
    setImgErr(null);
    try {
      const uri = await compressImageToDataUri(file);
      setOptions((prev) => prev.map((o, j) => (j === i ? uri : o)));
    } catch {
      setImgErr('Görsel çok büyük, daha küçük bir görsel seçin');
    }
  }

  function reset() {
    setInstruction(''); setFenText(''); setFenTurnOverride(null);
    setOptionCount(2); setOptionCountChosen(false);
    setAnswerKind('sentence'); setAnswerKindChosen(false);
    setOptions(['', '']); setCorrectIndex(0);
  }

  async function submit() {
    setErr(null);
    if (!gateOpen) return;
    setSaving(true);
    try {
      await onSubmit({
        id: crypto.randomUUID(),
        instruction: instruction.trim(),
        fen: finalFen,
        answer_kind: answerKind,
        options,
        correct_index: correctIndex,
      });
      reset();
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <StepList steps={steps} missingNo={missing?.no ?? null} ariaLabel="Konum Pratiği soru adımları" />

      <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
        placeholder="Talimat (örn. Bu konum hangi açılıştır?)" className="neon-input text-sm" />

      <div className="space-y-2">
        <p className="text-xs n-muted">
          Başka bir satranç uygulamasından kopyaladığın FEN&apos;i buraya yapıştır.
        </p>
        <textarea
          value={fenText}
          onChange={(e) => { setFenText(e.target.value); setFenTurnOverride(null); }}
          placeholder="FEN yapıştır (örn. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1)"
          rows={2}
          className="neon-input text-sm font-mono"
        />
        {fenTouched && !parsed.ok && (
          <p className="text-sm text-rose-300">Bu FEN geçerli değil — kontrol eder misin?</p>
        )}
        {parsed.ok && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs n-muted">Hamle sırası:</span>
              {(['w', 'b'] as const).map((t) => (
                <button key={t} type="button"
                  aria-label={t === 'w' ? 'Beyaz' : 'Siyah'}
                  aria-pressed={fenTurn === t}
                  onClick={() => setFenTurnOverride(t)}
                  className={`px-3 py-1 rounded-lg text-xs border ${
                    fenTurn === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70'
                  }`}>
                  {t === 'w' ? 'Beyaz' : 'Siyah'}
                </button>
              ))}
            </div>
            <SavedPositionBoard fen={finalFen} marked={[]} />
          </>
        )}
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Seçenek sayısı</p>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((n) => (
            <button key={n} type="button" onClick={() => { setCount(n); setOptionCountChosen(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                optionCount === n ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{n} seçenek</button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Cevap tipi</p>
        <div className="flex gap-2">
          {([['sentence', 'Cümle'], ['image', 'Görüntü']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setAnswerKind(k); setAnswerKindChosen(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                answerKind === k ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs n-muted mb-1">Cevaplar — doğru olanı soldaki yuvarlakla işaretle</p>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="konum-pratigi-correct" checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)} aria-label={`${i + 1}. şık doğru`}
              className="h-4 w-4 accent-cyan-400" />
            {answerKind === 'sentence' ? (
              <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`${i + 1}. şık`} className="neon-input flex-1" />
            ) : (
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="file" accept="image/*" className="hidden" id={`konum-pratigi-option-image-${i}`}
                    onChange={(e) => onOptionImageFile(i, e.target.files?.[0])} />
                  <label htmlFor={`konum-pratigi-option-image-${i}`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
                    {o ? 'Değiştir' : 'Bilgisayardan Seç'}
                  </label>
                  <button type="button"
                    onClick={() => setOpenPoolFor((p) => (p === i ? null : i))}
                    className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-400/20">
                    Havuzdan Seç
                  </button>
                  {o && <img src={o} alt={`${i + 1}. şık önizleme`} style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />}
                </div>
                {openPoolFor === i && (
                  <PoolPicker
                    onSelect={(uri) => setOptions((prev) => prev.map((x, j) => (j === i ? uri : x)))}
                    onClose={() => setOpenPoolFor(null)}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {imgErr && <p className="text-rose-400 text-sm">{imgErr}</p>}
      {err && <p className="text-rose-400 text-sm">{err}</p>}

      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving || !gateOpen}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50 text-sm transition-colors">
          {saving ? 'Kaydediliyor...' : 'Soruyu ekle'}
        </button>
        {!gateOpen && missing && (
          <span className="text-xs n-muted">Eksik: {missing.no}. {missing.label}</span>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { compressImageToDataUri } from '@/lib/imageCompress';
import { PoolPicker } from './PoolPicker';
import { StepList } from './StepList';
import { konumPratigiSteps, KONUM_PRATIGI_INSTRUCTION } from '@/lib/admin/konumPratigiSteps';
import { firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import { parseFenInput, withTurn } from '@/lib/chess/fenInput';
import { SavedPositionBoard } from './SavedPositionBoard';
import type { KonumPratigiQuestion } from '@/lib/customTabsApi';

interface Props {
  onSubmit: (q: KonumPratigiQuestion) => Promise<void>;
  /** Verilirse DÜZENLEME modu: alanlar bu soruyla dolu başlar, "Soruyu Ekle"
   *  yerine "Soruyu Kaydet" yazar, id/code KORUNUR (yeniden üretilmez). */
  initial?: KonumPratigiQuestion;
  /** Yalnızca düzenleme modunda gösterilen "Vazgeç" butonu. */
  onCancel?: () => void;
}

/**
 * a) Açılışı Tahmin Et (eski Konum Pratiği) — soru ekleme/düzenleme formu.
 * Madde 2026-09-06 (üçüncü tur/2): 5 adım — FEN Ekle (ZORUNLU, sadece
 * yapıştırma — "Konum Diz" DEĞİL), Seçenek Sayısını Belirle (2/3/4), Cevap
 * Tipini Belirle (Cümle/Görüntü), Cevapları Gir, Soruyu Ekle. Eski "Talimatı
 * Gir" adımı KALKTI — sabit talimat KONUM_PRATIGI_INSTRUCTION kullanılır.
 * Alan şekli lesson-steps'teki `sentence_question` ile AYNI (bkz.
 * components/lesson-steps/BoardExercise.tsx) — sporcu tarafı bu soruları
 * dönüşümsüz o bileşenle çizer.
 */
export function KonumPratigiFields({ onSubmit, initial, onCancel }: Props) {
  const editing = !!initial;
  const [fenText, setFenText] = useState(initial?.fen ?? '');
  const [fenTurnOverride, setFenTurnOverride] = useState<'w' | 'b' | null>(null);
  const [optionCount, setOptionCount] = useState<2 | 3 | 4>((initial?.options.length ?? 2) as 2 | 3 | 4);
  // "Belirle" adımları BİLFİİL tıklama ister; düzenlemede tamam sayılır (KURAL #3).
  const [optionCountChosen, setOptionCountChosen] = useState(editing);
  const [answerKind, setAnswerKind] = useState<'sentence' | 'image'>(initial?.answer_kind ?? 'sentence');
  const [answerKindChosen, setAnswerKindChosen] = useState(editing);
  const [options, setOptions] = useState<string[]>(initial?.options ?? ['', '']);
  const [correctIndex, setCorrectIndex] = useState(initial?.correct_index ?? 0);
  const [openPoolFor, setOpenPoolFor] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = parseFenInput(fenText);
  const fenTouched = fenText.trim().length > 0;
  const fenTurn = parsed.ok ? (fenTurnOverride ?? parsed.turn) : 'w';
  const finalFen = parsed.ok ? withTurn(parsed.fen, fenTurn) : '';

  const steps = konumPratigiSteps({
    fenValid: parsed.ok, optionCountChosen, answerKindChosen, options,
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
    setFenText(''); setFenTurnOverride(null);
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
        // Düzenlemede id/code KORUNUR — sporcunun bildiği numara sabittir.
        id: initial?.id ?? crypto.randomUUID(),
        code: initial?.code,
        instruction: KONUM_PRATIGI_INSTRUCTION,
        fen: finalFen,
        answer_kind: answerKind,
        options,
        correct_index: correctIndex,
      });
      if (!editing) reset();
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <StepList steps={steps} missingNo={missing?.no ?? null} ariaLabel="Açılışı Tahmin Et soru adımları" />

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
          {saving ? 'Kaydediliyor...' : editing ? 'Soruyu kaydet' : 'Soruyu ekle'}
        </button>
        {!gateOpen && missing && (
          <span className="text-xs n-muted">Eksik: {missing.no}. {missing.label}</span>
        )}
        {editing && onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
            Vazgeç
          </button>
        )}
      </div>
    </div>
  );
}

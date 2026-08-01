'use client';
import { useState, useEffect } from 'react';
import type { BoardExercise, QuestionFamily } from './ExerciseForm';
import { compressImageToDataUri } from '@/lib/imageCompress';
import { DIFFICULTY_LABELS, nearestDifficultyValue } from '@/lib/difficultyLabels';
import { PoolPicker } from './PoolPicker';
import { choiceSteps, firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import { StepList } from './StepList';
import { POOL_CATEGORIES, addPoolImage } from '@/lib/admin/poolApi';
import { ImagePlacer } from './ImagePlacer';
import { type ImagePlacement, DEFAULT_PLACEMENT, clampPlacement } from '@/lib/chess/imagePlacement';

/** Bolum taslagi: Zafer hoca baska bolume gecip dondugunde yazdiklarini
 *  kaybetmesin diye ExerciseForm'da saklanan alanlar. YALNIZCA yeni soru
 *  eklerken kullanilir; duzenleme modunda devre disi. */
export interface ChoiceDraft {
  instruction: string;
  promptImage: string;
  optionCount: 2 | 3 | 4;
  answerKind: 'sentence' | 'image';
  options: string[];
  correctIndex: number;
  successMsg: string;
  failMsg: string;
  difficulty: number;
  optionCountChosen: boolean;
  answerKindChosen: boolean;
  difficultyChosen: boolean;
  imagePlacement: ImagePlacement;
  imageShowBoard: boolean;
}

interface Props {
  kind: Extract<QuestionFamily, 'sentence_question' | 'image_question'>;
  onSubmit: (ex: BoardExercise) => Promise<void>;
  initial?: BoardExercise;
  onCancel?: () => void;
  /** Yeni soru modunda onceki taslak (varsa) — alan baslangic degerleri. */
  draft?: ChoiceDraft;
  /** Her degisimde taslagi yukari yazar. Duzenlemede verilmez. */
  onDraftChange?: (d: ChoiceDraft) => void;
}

export function ChoiceExerciseFields({ kind, onSubmit, initial, onCancel, draft, onDraftChange }: Props) {
  const [instruction, setInstruction] = useState(draft?.instruction ?? initial?.instruction ?? '');
  const [promptImage, setPromptImage] = useState(draft?.promptImage ?? initial?.prompt_image ?? '');
  const [optionCount, setOptionCount] = useState<2 | 3 | 4>(
    draft?.optionCount ?? ((initial?.options?.length ?? 2) as 2 | 3 | 4),
  );
  const [answerKind, setAnswerKind] = useState<'sentence' | 'image'>(
    draft?.answerKind ?? initial?.answer_kind ?? 'sentence',
  );
  const [options, setOptions] = useState<string[]>(
    draft?.options ?? (initial?.options && initial.options.length > 0 ? initial.options : ['', '']),
  );
  const [correctIndex, setCorrectIndex] = useState(draft?.correctIndex ?? initial?.correct_index ?? 0);
  const [successMsg, setSuccessMsg] = useState(draft?.successMsg ?? initial?.success_msg ?? '');
  const [failMsg, setFailMsg] = useState(draft?.failMsg ?? initial?.fail_msg ?? '');
  const [difficulty, setDifficulty] = useState(draft?.difficulty ?? initial?.difficulty ?? 1);
  const [placement, setPlacement] = useState<ImagePlacement>(
    draft?.imagePlacement ?? clampPlacement({
      x: initial?.image_x, y: initial?.image_y, w: initial?.image_w,
      h: initial?.image_h, tone: initial?.image_tone,
    }),
  );
  const [showBoard, setShowBoard] = useState(
    draft?.imageShowBoard ?? initial?.image_show_board ?? true,
  );
  /** "Belirle" adimlari BILFIIL tiklama ister; duzenlemede tamam sayilir (KURAL #3). */
  const [optionCountChosen, setOptionCountChosen] = useState(draft?.optionCountChosen ?? !!initial);
  const [answerKindChosen, setAnswerKindChosen] = useState(draft?.answerKindChosen ?? !!initial);
  const [difficultyChosen, setDifficultyChosen] = useState(draft?.difficultyChosen ?? !!initial);
  const [err, setErr] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * Hangi görsel slotu için havuz paneli açık? 'prompt' = soru görseli,
   * sayı = o indeksli şık, null = kapalı. Aynı anda YALNIZCA BİR panel açık
   * olabilir — birden fazla şık için ayrı ayrı panel açılırsa ekran karışır.
   */
  const [openPoolFor, setOpenPoolFor] = useState<'prompt' | number | null>(null);
  /** "Havuza da eklensin mi?" satırı — yalnızca soru görseli için, opsiyonel. */
  const [poolAddCategory, setPoolAddCategory] = useState('');
  const [poolAddMsg, setPoolAddMsg] = useState<string | null>(null);
  const editing = !!initial;
  const steps = choiceSteps(
    { instruction, promptImage, optionCountChosen, answerKindChosen,
      options, answerKind, difficultyChosen },
    kind,
  );
  const missing = firstIncomplete(steps);
  const gateOpen = allDone(steps);

  // Taslak her degisimde yukari yazilir — bolum degisince form sifirdan
  // kurulsa da (key), yazilanlar ExerciseForm'da yasamaya devam eder.
  useEffect(() => {
    onDraftChange?.({
      instruction, promptImage, optionCount, answerKind,
      options, correctIndex, successMsg, failMsg, difficulty,
      optionCountChosen, answerKindChosen, difficultyChosen,
      imagePlacement: placement, imageShowBoard: showBoard,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruction, promptImage, optionCount, answerKind, options,
      correctIndex, successMsg, failMsg, difficulty,
      optionCountChosen, answerKindChosen, difficultyChosen,
      placement, showBoard]);

  function setCount(n: 2 | 3 | 4) {
    setOptionCount(n);
    setOptions((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
    setCorrectIndex((prev) => (prev >= n ? 0 : prev));
  }

  async function onPromptImageFile(file: File | undefined) {
    if (!file) return;
    setImgErr(null);
    try {
      setPromptImage(await compressImageToDataUri(file));
      setPoolAddMsg(null);
    } catch {
      setImgErr('Görsel çok büyük, daha küçük bir görsel seçin');
    }
  }

  async function saveToPool() {
    setPoolAddMsg(null);
    const ok = await addPoolImage(poolAddCategory, promptImage);
    setPoolAddMsg(ok ? 'Havuza eklendi ✓' : 'Havuza eklenemedi');
  }

  async function handlePromptImagePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    await onPromptImageFile(file);
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

  function validate(): string | null {
    if (kind === 'sentence_question' && !instruction.trim()) return 'Soru metni gerekli';
    if (kind === 'image_question' && !promptImage) return 'Soru görseli gerekli';
    if (kind === 'image_question' && !instruction.trim()) return 'Talimat gerekli';
    if (answerKind === 'sentence') {
      if (options.some((o) => !o.trim())) return 'Tüm cevap seçenekleri doldurulmalı';
    } else {
      if (options.some((o) => !o)) return 'Tüm cevap seçenekleri için görsel yüklenmeli';
    }
    return null;
  }

  async function submit() {
    setErr(null);
    const v = validate();
    if (v) { setErr(v); return; }
    setSaving(true);
    const base: BoardExercise = {
      type: kind,
      instruction: instruction.trim(),
      answer_kind: answerKind,
      options,
      correct_index: correctIndex,
      difficulty,
    };
    if (kind === 'image_question') {
      base.prompt_image = promptImage;
      base.image_x = placement.x;
      base.image_y = placement.y;
      base.image_w = placement.w;
      base.image_h = placement.h;
      base.image_tone = placement.tone;
      base.image_show_board = showBoard;
    }
    if (initial?.code) base.code = initial.code;
    if (successMsg.trim()) base.success_msg = successMsg.trim();
    if (failMsg.trim()) base.fail_msg = failMsg.trim();
    try {
      await onSubmit(base);
      if (!editing) {
        setInstruction(''); setPromptImage(''); setOptionCount(2); setAnswerKind('sentence');
        setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg(''); setDifficulty(1);
        setOptionCountChosen(false); setAnswerKindChosen(false); setDifficultyChosen(false);
        setPlacement(DEFAULT_PLACEMENT); setShowBoard(true);
      }
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <StepList
        steps={steps}
        missingNo={missing?.no ?? null}
        ariaLabel={kind === 'sentence_question' ? 'Cümle Ekle adımları' : 'Görüntü Ekle adımları'}
      />
      {kind === 'sentence_question' ? (
        <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
          placeholder="Soru cümlesi (örn. Atın hareket şekli nasıldır?)" className="neon-input" />
      ) : (
        <div className="space-y-2">
          <span className="text-xs n-muted block">Soru görseli</span>
          <input type="file" accept="image/*" className="hidden" id="prompt-image-input"
            onChange={(e) => onPromptImageFile(e.target.files?.[0])} />
          <label htmlFor="prompt-image-input"
            className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
            Bilgisayardan Seç
          </label>
          <button type="button"
            onClick={() => setOpenPoolFor((p) => (p === 'prompt' ? null : 'prompt'))}
            className="ml-2 px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-400/20">
            Havuzdan Seç
          </button>
          <div
            role="button"
            tabIndex={0}
            onPaste={handlePromptImagePaste}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs
              border border-dashed border-white/25 text-white/50 cursor-text
              focus:border-cyan-400 focus:text-cyan-200 outline-none ml-2"
          >
            📋 Buraya tıkla, sonra Ctrl+V ile yapıştır
          </div>
          {openPoolFor === 'prompt' && (
            <PoolPicker
              onSelect={(uri) => { setPromptImage(uri); setPoolAddMsg(null); }}
              onClose={() => setOpenPoolFor(null)}
            />
          )}
          {promptImage && (
            <div className="flex items-start gap-2">
              <img src={promptImage} alt="Soru görseli önizleme" style={{ maxWidth: 200, maxHeight: 150, objectFit: 'contain' }} />
              {/* Madde 1: görsel eklendikten sonra tek başına SİLİNEBİLSİN —
                  "Değiştir" zaten dosya seçtirir, bu sadece kaldırır. */}
              <button type="button" onClick={() => setPromptImage('')}
                className="px-2 py-1 rounded-lg text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40 hover:bg-rose-400/20">
                Görseli Sil
              </button>
            </div>
          )}
          {promptImage && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="n-muted">Havuza da eklensin mi?</span>
              <select
                aria-label="Havuz kategorisi"
                value={poolAddCategory}
                onChange={(e) => { setPoolAddCategory(e.target.value); setPoolAddMsg(null); }}
                className="neon-input py-1 text-xs"
              >
                <option value="">Kategori seç</option>
                {POOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={saveToPool} disabled={!poolAddCategory}
                className="px-3 py-1 rounded-lg text-xs bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40">
                Havuza Ekle
              </button>
              {poolAddMsg && <span className="n-muted">{poolAddMsg}</span>}
            </div>
          )}
          {promptImage && (
            <div className="space-y-2">
              <ImagePlacer uri={promptImage} placement={placement} onChange={setPlacement} />
              <label className="flex items-center gap-2 text-xs n-muted">
                <input type="checkbox" checked={showBoard}
                  onChange={(e) => setShowBoard(e.target.checked)}
                  className="h-4 w-4 accent-cyan-400" />
                Sporcu tahtayı da görsün
              </label>
            </div>
          )}
          <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
            placeholder="Talimat" className="neon-input" />
        </div>
      )}

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
            <input type="radio" name="choice-correct" checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)} aria-label={`${i + 1}. şık doğru`}
              className="h-4 w-4 accent-cyan-400" />
            {answerKind === 'sentence' ? (
              <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`${i + 1}. şık`} className="neon-input flex-1" />
            ) : (
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="file" accept="image/*" className="hidden" id={`option-image-${i}`}
                    onChange={(e) => onOptionImageFile(i, e.target.files?.[0])} />
                  <label htmlFor={`option-image-${i}`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
                    {o ? 'Değiştir' : 'Bilgisayardan Seç'}
                  </label>
                  <button type="button"
                    onClick={() => setOpenPoolFor((p) => (p === i ? null : i))}
                    className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-400/20">
                    Havuzdan Seç
                  </button>
                  {o && <img src={o} alt={`${i + 1}. şık önizleme`} style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />}
                  {o && (
                    <button type="button"
                      onClick={() => setOptions((prev) => prev.map((x, j) => (j === i ? '' : x)))}
                      aria-label={`${i + 1}. şık görselini sil`}
                      className="px-2 py-1 rounded-lg text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40 hover:bg-rose-400/20">
                      Sil
                    </button>
                  )}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={successMsg} onChange={(e) => setSuccessMsg(e.target.value)}
          placeholder="Doğru mesajı (opsiyonel)" className="neon-input" />
        <input value={failMsg} onChange={(e) => setFailMsg(e.target.value)}
          placeholder="Yanlış mesajı (opsiyonel)" className="neon-input" />
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Sorunun Zorluk Düzeyini Belirle</p>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_LABELS.map(([val, label]) => (
            <button key={val} type="button" onClick={() => { setDifficulty(val); setDifficultyChosen(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                nearestDifficultyValue(difficulty) === val ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{label}</button>
          ))}
        </div>
      </div>

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
            İptal
          </button>
        )}
      </div>
    </div>
  );
}

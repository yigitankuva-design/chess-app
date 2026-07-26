'use client';
import { useState, useRef } from 'react';
import { BoardEditor, EMPTY_FEN, fenToMap } from '@/components/BoardEditor';
import { ChoiceExerciseFields } from './ChoiceExerciseFields';
import type { ChoiceDraft } from './ChoiceExerciseFields';
import { MovePieceFields } from './MovePieceFields';
import { DIFFICULTY_LABELS, nearestDifficultyValue } from '@/lib/difficultyLabels';
import { movePieceSteps, firstIncompleteStep, allStepsDone, hasPieces } from '@/lib/admin/movePieceSteps';
import { clickSquareSteps, firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import { StepList } from './StepList';
import type { MovePieceStepState } from '@/lib/admin/movePieceSteps';

export type ExerciseType = 'click_square' | 'move_piece' | 'identify_piece';
export type QuestionFamily = 'sentence_question' | 'image_question' | 'konum';

export interface BoardExercise {
  type: ExerciseType | 'sentence_question' | 'image_question';
  instruction: string;
  /** Sadece tahta tipleri (Konum Ekle) için zorunlu. */
  fen?: string;
  target_squares?: string[];
  piece_square?: string;
  highlight_square?: string;
  options?: string[];
  correct_index?: number;
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
  difficulty?: number;
  /** 3 haneli kalıcı soru kodu (örn. "007") — admin panelinde atanır, değişmez. */
  code?: string;
  /** Sadece image_question için — data-URI. */
  prompt_image?: string;
  /** Sadece sentence_question/image_question için — cevapların tipi. */
  answer_kind?: 'sentence' | 'image';
  /** Sadece move_piece için — SAN hamle dizisi (Konumu Kaydet sonrası kaydedilir). */
  moves?: string[];
}

interface Props {
  onSubmit: (ex: BoardExercise) => Promise<void>;
  initial?: BoardExercise;
  onCancel?: () => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const FAMILY_OPTIONS: [QuestionFamily, string][] = [
  ['sentence_question', 'Cümle ekle'],
  ['image_question', 'Görüntü ekle'],
  ['konum', 'Konum ekle'],
];

function familyOf(ex?: BoardExercise): QuestionFamily {
  if (ex?.type === 'sentence_question') return 'sentence_question';
  if (ex?.type === 'image_question') return 'image_question';
  return 'konum';
}

function SquarePicker({ values, onToggle }: { values: string[]; onToggle: (sq: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-8 gap-0.5" style={{ maxWidth: 280 }}>
        {[8, 7, 6, 5, 4, 3, 2, 1].map((rank) =>
          FILES.map((f) => {
            const sq = `${f}${rank}`;
            const on = values.includes(sq);
            return (
              <button key={sq} type="button" onClick={() => onToggle(sq)}
                className={`text-[15px] py-1.5 rounded transition-colors ${
                  on ? 'bg-cyan-400/40 text-cyan-100 border border-cyan-400' : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}>{sq}</button>
            );
          }),
        )}
      </div>
      <p className="text-xs n-muted">Seçili: {values.length ? values.join(', ') : '—'}</p>
    </div>
  );
}

export function ExerciseForm({ onSubmit, initial, onCancel }: Props) {
  const [family, setFamily] = useState<QuestionFamily>(() => familyOf(initial));
  const editing = !!initial;
  /** Bolum basina taslak. SADECE yeni soru modunda; form kapaninca ucar (YAGNI).
   *  Konum'a taslak BILINCLI yok: tahta durumu yarim kopyalanirsa adim kilidi
   *  tutarsizlasir (spec 3.1). */
  const choiceDrafts = useRef<Partial<Record<'sentence_question' | 'image_question', ChoiceDraft>>>({});

  return (
    <div className="neon-card neon-green p-5 space-y-4">
      <h3 className="font-bold n-text">
        {editing ? 'Soruyu düzenle' : 'Yeni soru'}
        {editing && initial?.code && <span className="ml-2 text-xs font-mono n-muted">Kod: {initial.code}</span>}
      </h3>

      <div className="flex justify-center gap-3 flex-wrap">
        {FAMILY_OPTIONS.map(([f, label]) => (
          <button
            key={f}
            type="button"
            disabled={editing}
            onClick={() => setFamily(f)}
            className={`w-36 py-4 px-3 rounded-xl border text-center transition-colors ${
              family === f ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
            } ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span className="block font-semibold text-sm">{label}</span>
          </button>
        ))}
      </div>

      {family === 'konum' ? (
        <BoardExerciseFields key="konum" onSubmit={onSubmit} initial={initial} onCancel={onCancel} />
      ) : (
        <ChoiceExerciseFields
          key={family}
          kind={family}
          onSubmit={onSubmit}
          initial={initial}
          onCancel={onCancel}
          draft={editing ? undefined : choiceDrafts.current[family]}
          onDraftChange={editing ? undefined : (d) => { choiceDrafts.current[family] = d; }}
        />
      )}
    </div>
  );
}

function BoardExerciseFields({ onSubmit, initial, onCancel }: Props) {
  const [type, setType] = useState<ExerciseType>(
    initial && (initial.type === 'click_square' || initial.type === 'move_piece' || initial.type === 'identify_piece')
      ? initial.type
      : 'click_square',
  );
  const [fen, setFen] = useState(initial?.fen ?? EMPTY_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>(
    initial?.fen ? ((initial.fen.split(' ')[1] as 'w' | 'b') ?? 'w') : 'w',
  );
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');
  const [targets, setTargets] = useState<string[]>(initial?.target_squares ?? []);
  const [highlight, setHighlight] = useState(initial?.highlight_square ?? '');
  const [options, setOptions] = useState<string[]>(
    initial?.options && initial.options.length > 0 ? initial.options : ['', ''],
  );
  const [correctIndex, setCorrectIndex] = useState(initial?.correct_index ?? 0);
  const [successMsg, setSuccessMsg] = useState(initial?.success_msg ?? '');
  const [failMsg, setFailMsg] = useState(initial?.fail_msg ?? '');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 1);
  // Kareye Tıkla: null = konum henüz kaydedilmedi (diz fazı). Düzenlemede kayıtlı.
  const [savedFen, setSavedFen] = useState<string | null>(
    initial?.type === 'click_square' ? (initial.fen ?? null) : null,
  );
  /** Hamle sırasına BİLFİİL tıklandı mı? Varsayılan Beyaz — tıklama şart (tuzak). */
  const [turnChosen, setTurnChosen] = useState(!!initial);
  // Taşı Oynat: null = henüz "Konumu Kaydet"e basılmadı (setup fazı).
  const [moveFen, setMoveFen] = useState<string | null>(
    initial?.moves?.length ? (initial.fen ?? null) : null,
  );
  const [moves, setMoves] = useState<string[]>(initial?.moves ?? []);
  /** Adım 5 — mevcut soruyu düzenlerken kayıtlı notasyon zaten onaylı sayılır (KURAL #3). */
  const [notationSaved, setNotationSaved] = useState(!!initial?.moves?.length);
  /**
   * Adım 6 — zorluk etiketine BİLFİİL tıklandı mı? `difficulty` varsayılanı 1 olduğu
   * için sayıya bakmak yetmez. Mevcut soruyu düzenlerken kayıtlı bir değer zaten var,
   * hocayı tekrar tıklamaya zorlamak regresyon olur (KURAL #3) — bu yüzden true başlar.
   */
  const [difficultyChosen, setDifficultyChosen] = useState(!!initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = !!initial;

  function toggleTarget(sq: string) {
    setTargets((prev) => (prev.includes(sq) ? prev.filter((x) => x !== sq) : [...prev, sq]));
  }

  function validate(): string | null {
    if (!instruction.trim()) return 'Talimat gerekli';
    const map = fenToMap(fen);
    if (type === 'click_square') {
      if (!savedFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (targets.length === 0) return 'En az bir doğru kare seç';
    }
    if (type === 'move_piece') {
      if (!moveFen) return 'Önce taşları yerleştirip "Konumu Kaydet"e bas';
      if (moves.length === 0) return 'En az bir hamle kaydedilmeli';
    }
    if (type === 'identify_piece') {
      if (!highlight) return 'Vurgulanacak kareyi seç';
      if (!map[highlight]) return 'Vurgulanan karede taş yok';
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return 'En az 2 şık gerekli';
      if (correctIndex >= opts.length) return 'Doğru şık geçersiz';
    }
    return null;
  }

  async function submit() {
    setErr(null);
    const v = validate();
    if (v) { setErr(v); return; }
    setSaving(true);
    const base: BoardExercise = { type, instruction: instruction.trim(), fen, difficulty };
    if (initial?.code) base.code = initial.code;
    if (successMsg.trim()) base.success_msg = successMsg.trim();
    if (failMsg.trim()) base.fail_msg = failMsg.trim();
    if (type === 'click_square') { base.fen = savedFen!; base.target_squares = targets; }
    if (type === 'move_piece') { base.fen = moveFen!; base.moves = moves; }
    if (type === 'identify_piece') {
      base.highlight_square = highlight;
      base.options = options.map((o) => o.trim()).filter(Boolean);
      base.correct_index = correctIndex;
    }
    try {
      await onSubmit(base);
      if (!editing) {
        setInstruction(''); setTargets([]); setHighlight('');
        setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg(''); setDifficulty(1);
        setMoveFen(null); setMoves([]); setNotationSaved(false); setDifficultyChosen(false);
        setSavedFen(null); setTurnChosen(false);
      }
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  const squares = Object.keys(fenToMap(fen)).sort();

  const stepState: MovePieceStepState = {
    instruction, setupFen: fen, turnChosen, moveFen, moves, notationSaved, difficultyChosen,
  };
  const steps = movePieceSteps(stepState);
  const clickSteps = clickSquareSteps({
    instruction, setupFen: fen, turnChosen, savedFen, targets, difficultyChosen,
  });
  const missing = type === 'click_square'
    ? firstIncomplete(clickSteps)
    : firstIncompleteStep(stepState);
  /** Kilit iki Konum tipine de uygulanır (kullanıcının 3e maddesi). */
  const gateOpen = type === 'move_piece'
    ? allStepsDone(stepState)
    : type === 'click_square'
      ? allDone(clickSteps)
      : true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([
          ['click_square', 'Kareye tıkla'],
          ['move_piece', 'Taşı oynat'],
        ] as [ExerciseType, string][]).map(([t, label]) => (
          <button key={t} type="button" disabled={editing}
            onClick={() => { setType(t); setTargets([]); setSavedFen(null); setErr(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              type === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
            } ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}>{label}</button>
        ))}
        {/* Tasi Tani YENI soruda yok; eski soru duzenlenirken rozetle gosterilir.
            Tip birligi ve validate/submit dallari YASIYOR — eski sorular calisir. */}
        {editing && type === 'identify_piece' && (
          <span className="px-2.5 py-1 rounded-lg text-xs border border-amber-400/50 text-amber-200 bg-amber-400/10">
            🏷 Bu soru &quot;Taşı tanı&quot; tipinde — yeni eklenemez
          </span>
        )}
      </div>

      {type === 'move_piece' && (
        <StepList steps={steps} missingNo={missing?.no ?? null} ariaLabel="Taşı Oynat adımları" />
      )}
      {type === 'click_square' && (
        <StepList steps={clickSteps} missingNo={missing?.no ?? null} ariaLabel="Kareye Tıkla adımları" />
      )}

      <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
        placeholder="Talimat (örn. Piyonu e4'e taşı)" className="neon-input" />

      {/* Taşı oynat kendi tahtasını MovePieceFields içinde render ediyor —
          bu satır koşullanmazsa ekranda İKİ tahta olur. */}
      {type !== 'move_piece' && (type !== 'click_square' || savedFen === null) && (
        <BoardEditor fen={fen} turn={turn} onChange={setFen}
          onTurnChange={(t) => { setTurn(t); setTurnChosen(true); }} />
      )}

      {/* Bos tahta da kaydedilebilir — kare ismi sorulari icin (disabled YOK). */}
      {type === 'click_square' && savedFen === null && (
        <button type="button"
          onClick={() => setSavedFen(fen)}
          className="px-4 py-2 rounded-lg text-sm bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 transition-colors">
          Konumu Kaydet
        </button>
      )}

      {type === 'click_square' && savedFen !== null && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#34d399' }}>Konum kaydedildi ✓</span>
            {/* Konum degisirse eski kareler gecersiz olabilir — kareler BILINCLI sifirlanir. */}
            <button type="button"
              onClick={() => { setSavedFen(null); setTargets([]); }}
              className="px-3 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
              Konumu Değiştir
            </button>
          </div>
          <p className="text-xs n-muted mb-1">Doğru kare(ler) — birden çok seçebilirsin</p>
          <SquarePicker values={targets} onToggle={toggleTarget} />
        </div>
      )}

      {type === 'move_piece' && (
        <MovePieceFields
          setupFen={fen}
          onSetupFenChange={setFen}
          setupTurn={turn}
          onSetupTurnChange={(t) => { setTurn(t); setTurnChosen(true); }}
          fen={moveFen}
          moves={moves}
          onChange={(f, m) => { setMoveFen(f); setMoves(m); }}
          notationSaved={notationSaved}
          onNotationSavedChange={setNotationSaved}
        />
      )}

      {type === 'identify_piece' && (
        <div className="space-y-2">
          <div>
            <p className="text-xs n-muted mb-1">Vurgulanacak kare (taşın olduğu)</p>
            <select value={highlight} onChange={(e) => setHighlight(e.target.value)}
              className="neon-input py-1.5 text-xs max-w-[10rem]">
              <option value="">seç</option>
              {squares.map((s) => <option key={s} value={s}>{s} ({fenToMap(fen)[s]})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="ex-correct" checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)} aria-label={`${i + 1}. şık doğru`}
                  className="h-4 w-4 accent-cyan-400" />
                <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`${i + 1}. şık`} className="neon-input flex-1" />
              </div>
            ))}
            <button type="button" onClick={() => setOptions([...options, ''])}
              className="px-3 py-1 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
              + Şık ekle
            </button>
          </div>
        </div>
      )}

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
            <button key={val} type="button"
              onClick={() => { setDifficulty(val); setDifficultyChosen(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                nearestDifficultyValue(difficulty) === val ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={submit} disabled={saving || !gateOpen}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm transition-colors">
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

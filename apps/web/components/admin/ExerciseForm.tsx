'use client';
import { useState } from 'react';
import { BoardEditor, EMPTY_FEN, fenToMap } from '@/components/BoardEditor';
import { ChoiceExerciseFields } from './ChoiceExerciseFields';
import { MovePieceFields } from './MovePieceFields';

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
                className={`text-[10px] py-1 rounded transition-colors ${
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
        <BoardExerciseFields onSubmit={onSubmit} initial={initial} onCancel={onCancel} />
      ) : (
        <ChoiceExerciseFields kind={family} onSubmit={onSubmit} initial={initial} onCancel={onCancel} />
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
  // Taşı Oynat: null = henüz "Konumu Kaydet"e basılmadı (setup fazı).
  const [moveFen, setMoveFen] = useState<string | null>(
    initial?.moves?.length ? (initial.fen ?? null) : null,
  );
  const [moves, setMoves] = useState<string[]>(initial?.moves ?? []);
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
    if (type === 'click_square') base.target_squares = targets;
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
        setMoveFen(null); setMoves([]);
      }
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  const squares = Object.keys(fenToMap(fen)).sort();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ['click_square', 'Kareye tıkla'],
          ['move_piece', 'Taşı oynat'],
          ['identify_piece', 'Taşı tanı'],
        ] as [ExerciseType, string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => { setType(t); setTargets([]); setErr(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              type === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
            }`}>{label}</button>
        ))}
      </div>

      <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
        placeholder="Talimat (örn. Piyonu e4'e taşı)" className="neon-input" />

      {/* Taşı oynat kendi tahtasını MovePieceFields içinde render ediyor —
          bu satır koşullanmazsa ekranda İKİ tahta olur. */}
      {type !== 'move_piece' && (
        <BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />
      )}

      {type === 'click_square' && (
        <div>
          <p className="text-xs n-muted mb-1">Doğru kare(ler) — birden çok seçebilirsin</p>
          <SquarePicker values={targets} onToggle={toggleTarget} />
        </div>
      )}

      {type === 'move_piece' && (
        <MovePieceFields
          fen={moveFen}
          moves={moves}
          onChange={(f, m) => { setMoveFen(f); setMoves(m); }}
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
          {[1, 2, 3, 4, 5].map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)}
              className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                difficulty === d ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{d}</button>
          ))}
          <span className="text-xs n-muted self-center">1 en kolay · 5 en zor</span>
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50 text-sm transition-colors">
          {saving ? 'Kaydediliyor...' : editing ? 'Soruyu kaydet' : 'Soruyu ekle'}
        </button>
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

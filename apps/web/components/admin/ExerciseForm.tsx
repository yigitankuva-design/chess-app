'use client';
import { useState } from 'react';
import { BoardEditor, EMPTY_FEN, fenToMap } from '@/components/BoardEditor';

export type ExerciseType = 'click_square' | 'move_piece' | 'identify_piece';

export interface BoardExercise {
  type: ExerciseType;
  instruction: string;
  fen: string;
  target_squares?: string[];
  piece_square?: string;
  highlight_square?: string;
  options?: string[];
  correct_index?: number;
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
}

interface Props {
  onAdd: (ex: BoardExercise) => Promise<void>;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

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

export function ExerciseForm({ onAdd }: Props) {
  const [type, setType] = useState<ExerciseType>('click_square');
  const [fen, setFen] = useState(EMPTY_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [instruction, setInstruction] = useState('');
  const [targets, setTargets] = useState<string[]>([]);
  const [pieceSquare, setPieceSquare] = useState('');
  const [highlight, setHighlight] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [failMsg, setFailMsg] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      if (!pieceSquare) return 'Hangi taşın oynayacağını seç';
      if (!map[pieceSquare]) return 'Seçilen karede taş yok';
      if (targets.length === 0) return 'En az bir hedef kare seç';
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
    const base: BoardExercise = { type, instruction: instruction.trim(), fen };
    if (successMsg.trim()) base.success_msg = successMsg.trim();
    if (failMsg.trim()) base.fail_msg = failMsg.trim();
    if (type === 'click_square') base.target_squares = targets;
    if (type === 'move_piece') { base.piece_square = pieceSquare; base.target_squares = targets; }
    if (type === 'identify_piece') {
      base.highlight_square = highlight;
      base.options = options.map((o) => o.trim()).filter(Boolean);
      base.correct_index = correctIndex;
    }
    try {
      await onAdd(base);
      setInstruction(''); setTargets([]); setPieceSquare(''); setHighlight('');
      setOptions(['', '']); setCorrectIndex(0); setSuccessMsg(''); setFailMsg('');
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  const squares = Object.keys(fenToMap(fen)).sort();

  return (
    <div className="neon-card neon-green p-5 space-y-4">
      <h3 className="font-bold n-text">Yeni alıştırma</h3>

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

      <BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />

      {type === 'click_square' && (
        <div>
          <p className="text-xs n-muted mb-1">Doğru kare(ler) — birden çok seçebilirsin</p>
          <SquarePicker values={targets} onToggle={toggleTarget} />
        </div>
      )}

      {type === 'move_piece' && (
        <div className="space-y-2">
          <div>
            <p className="text-xs n-muted mb-1">Oynayacak taşın karesi</p>
            <select value={pieceSquare} onChange={(e) => setPieceSquare(e.target.value)}
              className="neon-input py-1.5 text-xs max-w-[10rem]">
              <option value="">seç</option>
              {squares.map((s) => <option key={s} value={s}>{s} ({fenToMap(fen)[s]})</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs n-muted mb-1">Hedef kare(ler)</p>
            <SquarePicker values={targets} onToggle={toggleTarget} />
          </div>
        </div>
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

      {err && <p className="text-rose-400 text-sm">{err}</p>}
      <button type="button" onClick={submit} disabled={saving}
        className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50 text-sm transition-colors">
        {saving ? 'Kaydediliyor...' : 'Alıştırmayı ekle'}
      </button>
    </div>
  );
}

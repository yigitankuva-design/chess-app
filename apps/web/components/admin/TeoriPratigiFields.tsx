'use client';
import { useState } from 'react';
import { BoardEditor, START_FEN } from '@/components/BoardEditor';
import { MoveRecorderBoard } from './MoveRecorderBoard';
import { StepList } from './StepList';
import { teoriPratigiSteps, TEORI_PRATIGI_INSTRUCTION } from '@/lib/admin/teoriPratigiSteps';
import { firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import { formatNotation } from '@/lib/admin/movePieceSteps';
import { parseFenInput } from '@/lib/chess/fenInput';
import type { TeoriPratigiQuestion } from '@/lib/customTabsApi';

interface Props {
  onSubmit: (q: TeoriPratigiQuestion) => Promise<void>;
  /** Verilirse DÜZENLEME modu: alanlar bu soruyla dolu başlar, "Soruyu Ekle"
   *  yerine "Soruyu Kaydet" yazar, id/code KORUNUR (yeniden üretilmez). */
  initial?: TeoriPratigiQuestion;
  /** Yalnızca düzenleme modunda gösterilen "Vazgeç" butonu. */
  onCancel?: () => void;
}

/**
 * b) Açılış Teorisini Hatırla (eski adıyla Teori Pratiği) — soru ekleme/
 * düzenleme formu. Madde 2026-09-06 (üçüncü tur/3): 7 adım — Konum Diz,
 * Konumu Kaydet, Cevap Hamlelerini Yap ve Notasyon Oluştur, Notasyonu
 * Kaydet, Açılış veya Varyantın Adını Gir, Hamle Sırasını Belirle
 * (sporcunun rengi), Soruyu Ekle. Eski "Talimatı Gir" adımı KALKTI — sabit
 * talimat TEORI_PRATIGI_INSTRUCTION kullanılır. Dizme/kayıt/notasyon
 * fazları `MovePieceFields.tsx`'teki "Taşı Oynat" akışıyla AYNI
 * (`BoardEditor` → "Konumu Kaydet" → `MoveRecorderBoard` → "Notasyonu
 * Kaydet"); üstüne açılış adı + sporcunun rengi eklenir. "Hamle Sırası"
 * BİLEREK dizme fazındaki FEN sırasından BAĞIMSIZ ayrı bir alan — aynı
 * notasyon bazen beyaz bazen siyah taraftan pratik edilebilsin diye
 * (bkz. lib/chess/movePlayer.ts'teki studentParity genellemesi).
 */
export function TeoriPratigiFields({ onSubmit, initial, onCancel }: Props) {
  const editing = !!initial;
  const [setupFen, setSetupFen] = useState(initial?.fen ?? START_FEN);
  const [setupTurn, setSetupTurn] = useState<'w' | 'b'>(() => {
    if (!initial) return 'w';
    const parsed = parseFenInput(initial.fen);
    return parsed.ok ? parsed.turn : 'w';
  });
  const [fen, setFen] = useState<string | null>(initial?.fen ?? null);
  const [moves, setMoves] = useState<string[]>(initial?.moves ?? []);
  // Düzenlemede notasyon zaten kayıtlı sayılır — admin "Notasyonu Düzenle" ile açabilir.
  const [notationSaved, setNotationSaved] = useState(editing);
  const [openingName, setOpeningName] = useState(initial?.opening_name ?? '');
  const [studentColor, setStudentColor] = useState<'w' | 'b'>(initial?.student_color ?? 'w');
  const [studentColorChosen, setStudentColorChosen] = useState(editing);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const steps = teoriPratigiSteps({
    setupFen, fen, moves, notationSaved, openingName, studentColorChosen,
  });
  const missing = firstIncomplete(steps);
  const gateOpen = allDone(steps);

  function reset() {
    setSetupFen(START_FEN); setSetupTurn('w');
    setFen(null); setMoves([]); setNotationSaved(false);
    setOpeningName(''); setStudentColor('w'); setStudentColorChosen(false);
  }

  async function submit() {
    setErr(null);
    if (!gateOpen || fen === null) return;
    setSaving(true);
    try {
      await onSubmit({
        // Düzenlemede id/code KORUNUR — sporcunun bildiği numara sabittir.
        id: initial?.id ?? crypto.randomUUID(),
        code: initial?.code,
        instruction: TEORI_PRATIGI_INSTRUCTION,
        fen,
        moves,
        opening_name: openingName.trim(),
        student_color: studentColor,
      });
      if (!editing) reset();
    } catch {
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <StepList steps={steps} missingNo={missing?.no ?? null} ariaLabel="Açılış Teorisini Hatırla soru adımları" />

      {fen === null ? (
        <div className="space-y-3">
          <p className="text-xs n-muted">
            Taşları tahtaya yerleştir, sonra aşağıdaki butona bas.
          </p>
          <BoardEditor fen={setupFen} turn={setupTurn} onChange={setSetupFen} onTurnChange={setSetupTurn} />
          <button type="button" onClick={() => setFen(setupFen)}
            className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
            Konumu Kaydet
          </button>
        </div>
      ) : notationSaved ? (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-cyan-400/10 border border-cyan-400/40">
            <p className="text-xs n-muted mb-1">Kaydedilen cevap notasyonu</p>
            <p className="font-mono text-sm text-cyan-200">{formatNotation(fen, moves)}</p>
          </div>
          <button type="button" onClick={() => setNotationSaved(false)}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
            Notasyonu Düzenle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs n-muted flex-1">
              Taşları sürükleyerek cevabı oluştur — hamleler tabloya otomatik yazılır.
            </p>
            <button type="button" onClick={() => { setFen(null); setMoves([]); }}
              className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
              Konumu Düzenle
            </button>
          </div>
          <MoveRecorderBoard fen={fen} moves={moves} onMovesChange={setMoves} />
          <button type="button" disabled={moves.length === 0}
            onClick={() => setNotationSaved(true)}
            className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm transition-colors">
            Notasyonu Kaydet
          </button>
        </div>
      )}

      <input value={openingName} onChange={(e) => setOpeningName(e.target.value)}
        placeholder="Açılış veya varyant adı (örn. İtalyan Açılışı)" className="neon-input text-sm" />

      <div>
        <p className="text-xs n-muted mb-1">Sporcu hangi renkle oynayacak?</p>
        <div className="flex gap-2">
          {(['w', 'b'] as const).map((c) => (
            <button key={c} type="button"
              onClick={() => { setStudentColor(c); setStudentColorChosen(true); }}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                studentColor === c ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{c === 'w' ? 'Beyaz' : 'Siyah'}</button>
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
            Vazgeç
          </button>
        )}
      </div>
    </div>
  );
}

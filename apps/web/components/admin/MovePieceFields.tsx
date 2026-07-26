'use client';
import { BoardEditor } from '@/components/BoardEditor';
import { MoveRecorderBoard } from './MoveRecorderBoard';
import { formatNotation } from '@/lib/admin/movePieceSteps';

interface Props {
  /** Adım 2 — dizme tahtası. Durum ÜST BİLEŞENDE tutulur (tek doğruluk kaynağı). */
  setupFen: string;
  onSetupFenChange: (fen: string) => void;
  setupTurn: 'w' | 'b';
  onSetupTurnChange: (t: 'w' | 'b') => void;
  /** Adım 3 — null = henüz "Konumu Kaydet"e basılmadı (setup fazı). */
  fen: string | null;
  moves: string[];
  onChange: (fen: string | null, moves: string[]) => void;
  /** Adım 5 — notasyon cevap olarak kilitlendi mi? */
  notationSaved: boolean;
  onNotationSavedChange: (v: boolean) => void;
}

/**
 * Taşı Oynat sorusunun iki fazlı akışı:
 *   setup     → taşları yerleştir, "Konumu Kaydet"
 *   recording → taşları sürükleyerek hamle dizisi kaydet
 *
 * Faz ayrı bir state'te tutulmaz; `fen === null` olması setup fazını belirler
 * (tek doğruluk kaynağı — faz ile fen'in birbirinden sapması imkansız).
 *
 * Bileşen tamamen KONTROLLÜdür: hiç iç state tutmaz. Dizme tahtasının durumu üst
 * bileşende yaşar, çünkü adım listesi ("Konum Diz" tamamlandı mı?) orada hesaplanır.
 */
export function MovePieceFields({
  setupFen, onSetupFenChange, setupTurn, onSetupTurnChange,
  fen, moves, onChange, notationSaved, onNotationSavedChange,
}: Props) {
  if (fen === null) {
    return (
      <div className="space-y-3">
        <p className="text-xs n-muted">
          Taşları tahtaya yerleştir, sonra aşağıdaki butona bas.
        </p>
        <BoardEditor
          fen={setupFen} turn={setupTurn}
          onChange={onSetupFenChange} onTurnChange={onSetupTurnChange}
        />
        <button type="button" onClick={() => onChange(setupFen, [])}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
          Konumu Kaydet
        </button>
      </div>
    );
  }

  // Adım 5 tamam: notasyon cevap olarak kilitlendi — tahta salt-okunur olur.
  if (notationSaved) {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-cyan-400/10 border border-cyan-400/40">
          <p className="text-xs n-muted mb-1">Kaydedilen cevap notasyonu</p>
          <p className="font-mono text-sm text-cyan-200">{formatNotation(fen, moves)}</p>
        </div>
        <button type="button" onClick={() => onNotationSavedChange(false)}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Notasyonu Düzenle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs n-muted flex-1">
          Taşları sürükleyerek cevabı oluştur — hamleler tabloya otomatik yazılır.
        </p>
        <button type="button" onClick={() => onChange(null, [])}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Konumu Düzenle
        </button>
      </div>
      <MoveRecorderBoard fen={fen} moves={moves} onMovesChange={(m) => onChange(fen, m)} />
      <button type="button" disabled={moves.length === 0}
        onClick={() => onNotationSavedChange(true)}
        className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm transition-colors">
        Notasyonu Kaydet
      </button>
    </div>
  );
}

'use client';
import { BoardEditor } from '@/components/BoardEditor';
import { MoveRecorderBoard } from './MoveRecorderBoard';

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
  setupFen, onSetupFenChange, setupTurn, onSetupTurnChange, fen, moves, onChange,
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
    </div>
  );
}

'use client';
import { useState } from 'react';
import { BoardEditor, EMPTY_FEN } from '@/components/BoardEditor';
import { MoveRecorderBoard } from './MoveRecorderBoard';

interface Props {
  /** null = henüz "Konumu Kaydet"e basılmadı (setup fazı). */
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
 */
export function MovePieceFields({ fen, moves, onChange }: Props) {
  const [setupFen, setSetupFen] = useState(fen ?? EMPTY_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>(
    ((fen ?? EMPTY_FEN).split(' ')[1] as 'w' | 'b') ?? 'w',
  );

  if (fen === null) {
    return (
      <div className="space-y-3">
        <p className="text-xs n-muted">
          1. Taşları tahtaya yerleştir, sonra aşağıdaki butona bas.
        </p>
        <BoardEditor fen={setupFen} turn={turn} onChange={setSetupFen} onTurnChange={setTurn} />
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
          2. Taşları sürükleyerek cevabı oluştur — hamleler tabloya otomatik yazılır.
        </p>
        <button type="button" onClick={() => { setSetupFen(fen); onChange(null, []); }}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Konumu Düzenle
        </button>
      </div>
      <MoveRecorderBoard fen={fen} moves={moves} onMovesChange={(m) => onChange(fen, m)} />
    </div>
  );
}

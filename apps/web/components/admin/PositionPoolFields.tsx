'use client';
import { useState } from 'react';
import { BoardEditor } from '@/components/BoardEditor';
import { SavedPositionBoard } from './SavedPositionBoard';
import { parseFenInput, withTurn } from '@/lib/chess/fenInput';
import { PositionPoolView } from './PositionPoolView';
import type { PoolPosition } from './PositionPoolView';

interface Props {
  /** Dizme aşamasındaki FEN (havuza eklenmeden önce). */
  fen: string;
  turn: 'w' | 'b';
  onFenChange: (fen: string) => void;
  onTurnChange: (t: 'w' | 'b') => void;
  /**
   * Konumu havuza ekler. FEN verilmezse elle dizilen konum (`fen` prop'u)
   * kaydedilir; verilirse doğrudan o FEN kaydedilir (yapıştırma dalı).
   */
  onSavePosition: (fen?: string) => void;
  pool: PoolPosition[];
  onDeletePosition: (id: string) => void;
  /** Havuzdaki bir konum düzenlenip yeniden kaydedildiğinde çağrılır. */
  onUpdatePosition: (id: string, next: PoolPosition) => void;
}

/** Hangi ekleme yöntemi açık; null = henüz seçilmedi (iki kart yan yana). */
type Mode = 'board' | 'fen' | null;

const CARD =
  'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors';

/**
 * Pratik alt sekmeleri için bot-pratiği konum havuzu girişi.
 *
 * İki ekleme yöntemi vardır: taşları elle dizmek veya başka bir uygulamadan
 * kopyalanan FEN'i yapıştırmak. İkisi de AYNI havuza aynı biçimde yazar —
 * sporcu tarafı için aralarında fark yoktur.
 *
 * "Taşı Oynat" (move_piece) akışının aksine hamle dizisi KAYDEDİLMEZ.
 */
export function PositionPoolFields({
  fen, turn, onFenChange, onTurnChange, onSavePosition, pool, onDeletePosition, onUpdatePosition,
}: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [fenText, setFenText] = useState('');
  /** Hoca sırayı elle değiştirdiyse burada durur; yoksa FEN'inki geçerlidir. */
  const [fenTurnOverride, setFenTurnOverride] = useState<'w' | 'b' | null>(null);

  const parsed = parseFenInput(fenText);
  const fenTouched = fenText.trim().length > 0;
  const fenTurn = parsed.ok ? (fenTurnOverride ?? parsed.turn) : 'w';
  const finalFen = parsed.ok ? withTurn(parsed.fen, fenTurn) : '';

  function saveFen() {
    if (!parsed.ok) return;
    onSavePosition(finalFen);
    setFenText('');
    setFenTurnOverride(null);
  }

  const turnBtn = (t: 'w' | 'b', label: string) => (
    <button type="button"
      aria-label={label}
      aria-pressed={fenTurn === t}
      onClick={() => setFenTurnOverride(t)}
      className={`px-3 py-1 rounded-lg text-xs border ${
        fenTurn === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70'
      }`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* İki yöntem kartı — hoca hangisini isterse ona basar. */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode(mode === 'board' ? null : 'board')}
          className={CARD}
          style={{
            borderColor: mode === 'board' ? 'rgb(34 211 238)' : 'rgba(255,255,255,0.15)',
            background: mode === 'board' ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
          }}>
          <span className="text-xl leading-none">🧩</span>
          <span className="text-sm font-semibold n-text">Konum Dizerek Ekle</span>
        </button>
        <button type="button" onClick={() => setMode(mode === 'fen' ? null : 'fen')}
          className={CARD}
          style={{
            borderColor: mode === 'fen' ? 'rgb(34 211 238)' : 'rgba(255,255,255,0.15)',
            background: mode === 'fen' ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
          }}>
          <span className="text-xl leading-none">📋</span>
          <span className="text-sm font-semibold n-text">FEN Ekle</span>
        </button>
      </div>

      {mode === 'board' && (
        <div className="space-y-3">
          <p className="text-xs n-muted text-center">
            Sporcunun bota karşı pratik yapacağı konumu diz, sırayı belirle, kaydet.
          </p>
          <BoardEditor fen={fen} turn={turn} onChange={onFenChange} onTurnChange={onTurnChange} />
          <button type="button" onClick={() => onSavePosition()}
            className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
            Konumu Kaydet
          </button>
        </div>
      )}

      {mode === 'fen' && (
        <div className="space-y-3">
          <p className="text-xs n-muted">
            Başka bir satranç uygulamasından kopyaladığın FEN&apos;i buraya yapıştır.
          </p>
          <textarea
            value={fenText}
            onChange={(e) => { setFenText(e.target.value); setFenTurnOverride(null); }}
            placeholder="FEN yapıştır (örn. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1)"
            rows={3}
            className="neon-input text-sm font-mono"
          />

          {fenTouched && !parsed.ok && (
            <p className="text-sm text-rose-300">Bu FEN geçerli değil — kontrol eder misin?</p>
          )}

          {parsed.ok && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs n-muted">Hamle sırası:</span>
                {turnBtn('w', 'Beyaz')}
                {turnBtn('b', 'Siyah')}
              </div>
              <SavedPositionBoard fen={finalFen} marked={[]} />
            </>
          )}

          <button type="button" onClick={saveFen} disabled={!parsed.ok}
            className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
            FEN Konumunu Kaydet
          </button>
        </div>
      )}

      <div className="pt-2 border-t border-white/10">
        <PositionPoolView
          pool={pool}
          onUpdatePosition={onUpdatePosition}
          onDeletePosition={onDeletePosition}
        />
      </div>
    </div>
  );
}

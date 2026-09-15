'use client';
import { useState } from 'react';
import { BoardEditor } from '@/components/BoardEditor';
import { CandidateMoveAnalysisPanel } from './CandidateMoveAnalysisPanel';
import { SavedPositionBoard } from './SavedPositionBoard';
import { parseFenInput, withTurn } from '@/lib/chess/fenInput';
import { CandidateMovePoolView, toStoredCandidate } from './CandidateMovePoolView';
import type { PoolPosition, CandidateMove } from './CandidateMovePoolView';

interface Props {
  /** Dizme aşamasındaki FEN (havuza eklenmeden önce). */
  fen: string;
  turn: 'w' | 'b';
  onFenChange: (fen: string) => void;
  onTurnChange: (t: 'w' | 'b') => void;
  /**
   * Konumu havuza ekler. FEN verilmezse elle dizilen konum (`fen` prop'u)
   * kaydedilir; verilirse doğrudan o FEN kaydedilir (yapıştırma dalı).
   * `candidateMoves` HER ZAMAN dolu gelir — "Kaydet" butonu aksi halde
   * devre dışıdır (bkz. aşağıdaki gate mantığı).
   */
  onSavePosition: (fen: string | undefined, candidateMoves: CandidateMove[]) => void;
  pool: PoolPosition[];
  onDeletePosition: (id: string) => void;
  onUpdatePosition: (id: string, next: PoolPosition) => void;
}

/** Hangi ekleme yöntemi açık; null = henüz seçilmedi (iki kart yan yana). */
type Mode = 'board' | 'fen' | null;

const CARD =
  'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors';

/**
 * Aday Hamle Pratiği'nin konum ekleme akışı — `PositionPoolFields`'in forku
 * (madde 2026-09-15). Fark: "Konumun Sahibi" alanı yok; bunun yerine HER İKİ
 * modda da (dizme VE FEN yapıştırma — PositionPoolFields'ta analiz sadece
 * dizme modunda vardı) `CandidateMoveAnalysisPanel` zorunlu bir adımdır.
 * "Kaydet" butonu, o anki pozisyon için TAZE bir analiz sonucu (3 aday
 * hamle) yokken devre dışı kalır — cevapsız pozisyon kaydedilemez, ve
 * pozisyon analiz SONRASI değiştirilirse eski sonuç otomatik geçersiz sayılır.
 */
export function CandidateMovePoolFields({
  fen, turn, onFenChange, onTurnChange, onSavePosition, pool, onDeletePosition, onUpdatePosition,
}: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [fenText, setFenText] = useState('');
  const [fenTurnOverride, setFenTurnOverride] = useState<'w' | 'b' | null>(null);

  // "board" modu: analiz `fen` prop'una (dizilen pozisyon) göre yapılır.
  const [boardCandidates, setBoardCandidates] = useState<CandidateMove[] | null>(null);
  const [boardCandidatesFen, setBoardCandidatesFen] = useState<string | null>(null);
  const boardHamlelerGuncel = boardCandidates !== null && boardCandidatesFen === fen;

  // "fen" modu: analiz yapıştırılan (ve sıra düzeltilmiş) `finalFen`'e göre.
  const [pasteCandidates, setPasteCandidates] = useState<CandidateMove[] | null>(null);
  const [pasteCandidatesFen, setPasteCandidatesFen] = useState<string | null>(null);

  const parsed = parseFenInput(fenText);
  const fenTouched = fenText.trim().length > 0;
  const fenTurn = parsed.ok ? (fenTurnOverride ?? parsed.turn) : 'w';
  const finalFen = parsed.ok ? withTurn(parsed.fen, fenTurn) : '';
  const pasteHamlelerGuncel = pasteCandidates !== null && pasteCandidatesFen === finalFen;

  function saveBoard() {
    if (!boardHamlelerGuncel || !boardCandidates) return;
    onSavePosition(undefined, boardCandidates);
    setBoardCandidates(null);
    setBoardCandidatesFen(null);
  }

  function saveFen() {
    if (!parsed.ok || !pasteHamlelerGuncel || !pasteCandidates) return;
    onSavePosition(finalFen, pasteCandidates);
    setFenText('');
    setFenTurnOverride(null);
    setPasteCandidates(null);
    setPasteCandidatesFen(null);
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
            Sporcunun pratik yapacağı konumu diz, sırayı belirle, analiz et ve cevap anahtarını kaydet.
          </p>
          <BoardEditor fen={fen} turn={turn} onChange={onFenChange} onTurnChange={onTurnChange} />
          <CandidateMoveAnalysisPanel
            fen={fen}
            onAnalyzed={(cands) => { setBoardCandidates(cands.map(toStoredCandidate)); setBoardCandidatesFen(fen); }}
          />
          <button type="button" onClick={saveBoard} disabled={!boardHamlelerGuncel}
            className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
            Konumu Kaydet
          </button>
          {!boardHamlelerGuncel && (
            <p className="text-xs n-muted">Kaydetmeden önce &quot;Analiz Et&quot; ile cevap anahtarını üret.</p>
          )}
        </div>
      )}

      {mode === 'fen' && (
        <div className="space-y-3">
          <p className="text-xs n-muted">
            Başka bir satranç uygulamasından kopyaladığın FEN&apos;i buraya yapıştır.
          </p>
          <textarea
            value={fenText}
            onChange={(e) => {
              setFenText(e.target.value); setFenTurnOverride(null);
              setPasteCandidates(null); setPasteCandidatesFen(null);
            }}
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
              <CandidateMoveAnalysisPanel
                fen={finalFen}
                onAnalyzed={(cands) => { setPasteCandidates(cands.map(toStoredCandidate)); setPasteCandidatesFen(finalFen); }}
              />
            </>
          )}

          <button type="button" onClick={saveFen} disabled={!parsed.ok || !pasteHamlelerGuncel}
            className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
            FEN Konumunu Kaydet
          </button>
          {parsed.ok && !pasteHamlelerGuncel && (
            <p className="text-xs n-muted">Kaydetmeden önce &quot;Analiz Et&quot; ile cevap anahtarını üret.</p>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-white/10">
        <CandidateMovePoolView
          pool={pool}
          onUpdatePosition={onUpdatePosition}
          onDeletePosition={onDeletePosition}
        />
      </div>
    </div>
  );
}

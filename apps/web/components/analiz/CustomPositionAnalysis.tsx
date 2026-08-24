'use client';
import { useState } from 'react';
import { BoardEditor, START_FEN } from '@/components/BoardEditor';
import { parseFenInput, withTurn } from '@/lib/chess/fenInput';
import { AnalysisBoard } from './AnalysisBoard';

type Mode = 'board' | 'fen' | null;

const CARD = 'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors';

/**
 * Analiz Et sekmesi — "Kendi Konumumu Analiz Et": admin'in "Konumu Analiz Et"
 * giriş desenini (bkz. components/admin/PositionPoolFields.tsx) sporcu
 * tarafına taşır — Konum Dizerek Ekle / FEN Ekle iki kartı, ama sonuç 3 aday
 * hamleli AnalysisBoard'tur. Analiz ELLE tetiklenir ("🔍 Analiz Et" butonu) —
 * tek statik pozisyon olduğu için otomatik yeniden hesaplayacak bir tetikleyici
 * (hamle ilerlemesi gibi) yok.
 */
export function CustomPositionAnalysis() {
  const [mode, setMode] = useState<Mode>(null);
  const [fen, setFen] = useState(START_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [fenText, setFenText] = useState('');
  const [fenTurnOverride, setFenTurnOverride] = useState<'w' | 'b' | null>(null);
  const [analyzedFen, setAnalyzedFen] = useState<string | null>(null);

  const parsed = parseFenInput(fenText);
  const fenTouched = fenText.trim().length > 0;
  const fenTurn = parsed.ok ? (fenTurnOverride ?? parsed.turn) : 'w';
  const finalFen = parsed.ok ? withTurn(parsed.fen, fenTurn) : '';

  const turnBtn = (t: 'w' | 'b', label: string) => (
    <button type="button"
      aria-label={label}
      aria-pressed={fenTurn === t}
      onClick={() => setFenTurnOverride(t)}
      className={`px-3 py-1 rounded-lg text-xs border ${
        fenTurn === t ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 t-muted'
      }`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" onClick={() => { setMode(mode === 'board' ? null : 'board'); setAnalyzedFen(null); }}
          className={CARD}
          style={{
            borderColor: mode === 'board' ? 'rgb(34 211 238)' : 'rgba(255,255,255,0.15)',
            background: mode === 'board' ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
          }}>
          <span className="text-xl leading-none">🧩</span>
          <span className="text-sm font-semibold">Konum Dizerek Ekle</span>
        </button>
        <button type="button" onClick={() => { setMode(mode === 'fen' ? null : 'fen'); setAnalyzedFen(null); }}
          className={CARD}
          style={{
            borderColor: mode === 'fen' ? 'rgb(34 211 238)' : 'rgba(255,255,255,0.15)',
            background: mode === 'fen' ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
          }}>
          <span className="text-xl leading-none">📋</span>
          <span className="text-sm font-semibold">FEN Ekle</span>
        </button>
      </div>

      {mode === 'board' && (
        <div className="space-y-3">
          <BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />
          <button type="button" onClick={() => setAnalyzedFen(withTurn(fen, turn))}
            className="px-4 py-2 rounded-lg bg-violet-400/15 text-violet-200 border border-violet-400/50 hover:bg-violet-400/25 text-sm transition-colors">
            🔍 Analiz Et
          </button>
        </div>
      )}

      {mode === 'fen' && (
        <div className="space-y-3">
          <p className="text-xs t-muted">
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
            <div className="flex items-center gap-2">
              <span className="text-xs t-muted">Hamle sırası:</span>
              {turnBtn('w', 'Beyaz')}
              {turnBtn('b', 'Siyah')}
            </div>
          )}

          <button type="button" disabled={!parsed.ok} onClick={() => setAnalyzedFen(finalFen)}
            className="px-4 py-2 rounded-lg bg-violet-400/15 text-violet-200 border border-violet-400/50 hover:bg-violet-400/25 disabled:opacity-40 text-sm transition-colors">
            🔍 Analiz Et
          </button>
        </div>
      )}

      {analyzedFen && (
        <div className="pt-2 border-t border-white/10">
          <AnalysisBoard fen={analyzedFen} />
        </div>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BoardEditor, START_FEN } from '@/components/BoardEditor';
import { parseFenInput, withTurn } from '@/lib/chess/fenInput';

type Mode = 'board' | 'fen' | null;

const CARD = 'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors';

/**
 * Analiz Et sekmesi — "Kendi Konumumu Analiz Et": admin'in "Konumu Analiz Et"
 * giriş desenini (bkz. components/admin/PositionPoolFields.tsx) sporcu
 * tarafına taşır — Konum Dizerek Ekle / FEN Ekle iki kartı. Madde 2026-09-03
 * (7): "Analiz Et" artık AYRI BİR SAYFAYA (/analiz/konum/sonuc) yönlendirir —
 * konum ekleme ve analiz sonucu AYNI sayfada değil.
 */
export function CustomPositionAnalysis() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [fen, setFen] = useState(START_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [fenText, setFenText] = useState('');
  const [fenTurnOverride, setFenTurnOverride] = useState<'w' | 'b' | null>(null);

  function goAnalyze(targetFen: string) {
    router.push(`/analiz/konum/sonuc?fen=${encodeURIComponent(targetFen)}`);
  }

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
        <button type="button" onClick={() => setMode(mode === 'board' ? null : 'board')}
          className={CARD}
          style={{
            borderColor: mode === 'board' ? 'rgb(34 211 238)' : 'rgba(255,255,255,0.15)',
            background: mode === 'board' ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
          }}>
          <span className="text-xl leading-none">🧩</span>
          <span className="text-sm font-semibold">Konum Diz</span>
        </button>
        <button type="button" onClick={() => setMode(mode === 'fen' ? null : 'fen')}
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
          <button type="button" onClick={() => goAnalyze(withTurn(fen, turn))}
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

          <button type="button" disabled={!parsed.ok} onClick={() => goAnalyze(finalFen)}
            className="px-4 py-2 rounded-lg bg-violet-400/15 text-violet-200 border border-violet-400/50 hover:bg-violet-400/25 disabled:opacity-40 text-sm transition-colors">
            🔍 Analiz Et
          </button>
        </div>
      )}
    </div>
  );
}

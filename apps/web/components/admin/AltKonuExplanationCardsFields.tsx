'use client';
import { useState } from 'react';
import { BoardEditor, START_FEN } from '@/components/BoardEditor';
import type { ExplanationCard } from '@/lib/customTabsApi';

interface Props {
  cards: ExplanationCard[];
  onAdd: (card: ExplanationCard) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/**
 * Madde 2026-08-25: Alt Konu'nun Hızlı Erişim sayfasında tahtanın solunda
 * numaralı dairesel kartlar olarak gösterilen açıklama kartları — konum
 * (fen) + cümle. Zafer hoca bu giriş alanını AYRI bir görsel referansla
 * yeniden tasarlayacak (aynı konuşmada belirtildi); bu, o redesign'a kadar
 * kartları gerçekten girebilmek için minimum işlevsel sürüm.
 */
export function AltKonuExplanationCardsFields({ cards, onAdd, onDelete }: Props) {
  const [fen, setFen] = useState(START_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [sentence, setSentence] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    const text = sentence.trim();
    if (!text) return;
    setBusy(true);
    await onAdd({ id: crypto.randomUUID(), fen, sentence: text });
    setBusy(false);
    setSentence('');
    setFen(START_FEN); setTurn('w');
  }

  return (
    <div className="space-y-3">
      {cards.length > 0 && (
        <ol className="space-y-2">
          {cards.map((c, i) => (
            <li key={c.id} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <span className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-bold"
                style={{ width: 22, height: 22, border: '1.5px solid rgba(255,255,255,0.3)' }}>
                {i + 1}
              </span>
              <p className="text-xs flex-1 n-text">{c.sentence}</p>
              <button type="button" onClick={() => onDelete(c.id)}
                aria-label={`${i + 1}. açıklama kartını sil`}
                className="px-2 py-0.5 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs flex-shrink-0">
                Sil
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <p className="text-xs font-bold n-muted uppercase tracking-widest">+ Açıklama Kartı Ekle</p>
        <BoardEditor fen={fen} turn={turn} onChange={setFen} onTurnChange={setTurn} />
        <textarea value={sentence} onChange={(e) => setSentence(e.target.value)}
          placeholder="Bu konumla ilgili açıklama cümlesi" rows={2} className="neon-input text-sm" />
        <button type="button" onClick={add} disabled={busy || !sentence.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
          Kart Ekle
        </button>
      </div>
    </div>
  );
}

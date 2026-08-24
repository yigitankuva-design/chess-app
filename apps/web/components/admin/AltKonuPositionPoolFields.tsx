'use client';
import { useState } from 'react';
import { BoardEditor, START_FEN } from '@/components/BoardEditor';
import { PositionAnalysisPanel } from './PositionAnalysisPanel';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import type { PositionPoolEntry, PositionPoolStep } from '@/lib/customTabsApi';

interface Props {
  pool: PositionPoolEntry[];
  onAddGroup: (steps: PositionPoolStep[]) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onReorder: (nextPool: PositionPoolEntry[]) => Promise<void>;
}

/**
 * Alt Konu'nun Konum Havuzu — madde: 2026-08-26 (görsel referans).
 *
 * Akış: "Buton Ekle" ile tahtanın soluna numaralı bir buton eklenir → konum
 * dizilir (boş da bırakılabilir) → cümle yazılır → hamle sırası seçilir →
 * "Konumu Analiz Et" ile kontrol edilir → "Konumu Kaydet" ile bu ADIM
 * kilitlenir. "Buton Ekle" tekrar tekrar kullanılıp yeni adımlar eklenir.
 * Tüm adımlar tamamlanınca "Havuza Ekle" ile HEPSİ TEK BİR kod numarasıyla
 * havuza eklenir (Hızlı Erişim'de o kod açılınca adımlar sırayla gezilir).
 */
export function AltKonuPositionPoolFields({ pool, onAddGroup, onDeleteGroup, onReorder }: Props) {
  const [draftSteps, setDraftSteps] = useState<PositionPoolStep[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const codes = assignExerciseCodes(pool.map((p) => ({ code: p.code ?? undefined })));
  const active = activeIdx !== null ? draftSteps[activeIdx] : undefined;

  function addButton() {
    const step: PositionPoolStep = { id: crypto.randomUUID(), fen: START_FEN, turn: 'w', sentence: '' };
    setDraftSteps((prev) => [...prev, step]);
    setActiveIdx(draftSteps.length);
    setErr(null);
  }

  function updateActive(patch: Partial<PositionPoolStep>) {
    if (activeIdx === null) return;
    setDraftSteps((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, ...patch } : s)));
  }

  function saveActiveStep() {
    if (!active) return;
    if (!active.sentence.trim()) { setErr('Açıklama cümlesi gerekli'); return; }
    setErr(null);
    setActiveIdx(null);
  }

  async function addToPool() {
    if (draftSteps.length === 0) { setErr('En az bir buton eklemelisin'); return; }
    if (draftSteps.some((s) => !s.sentence.trim())) {
      setErr('Tüm adımların açıklama cümlesi dolu olmalı');
      return;
    }
    setBusy(true); setErr(null);
    await onAddGroup(draftSteps);
    setBusy(false);
    setDraftSteps([]);
    setActiveIdx(null);
  }

  async function moveGroup(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= pool.length) return;
    const next = [...pool];
    [next[idx], next[target]] = [next[target], next[idx]];
    await onReorder(next);
  }

  return (
    <div className="space-y-4">
      {/* Kayıtlı gruplar — kod numarasına göre, sırası değiştirilebilir */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold n-muted uppercase tracking-widest">Konum Havuzu</p>
          <span className="text-xs n-muted px-2 py-0.5 rounded-full border border-white/15">{pool.length}</span>
        </div>
        {pool.length === 0 ? (
          <p className="text-xs n-muted">Henüz konum grubu eklenmedi.</p>
        ) : (
          <ul className="space-y-1.5">
            {pool.map((entry, i) => (
              <li key={entry.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full border border-white/20">
                  {entry.code ?? codes[i]}
                </span>
                <span className="text-xs n-muted flex-1">{entry.steps.length} adım</span>
                <button type="button" onClick={() => moveGroup(i, -1)} disabled={i === 0}
                  aria-label={`${entry.code ?? codes[i]} kodunu yukarı taşı`}
                  className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↑</button>
                <button type="button" onClick={() => moveGroup(i, 1)} disabled={i === pool.length - 1}
                  aria-label={`${entry.code ?? codes[i]} kodunu aşağı taşı`}
                  className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↓</button>
                <button type="button" onClick={() => onDeleteGroup(entry.id)}
                  aria-label={`${entry.code ?? codes[i]} kodunu sil`}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">Sil</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Yeni grup oluşturma alanı */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          <button type="button" onClick={addButton}
            className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors flex-shrink-0">
            Buton Ekle
          </button>
          {draftSteps.length > 0 && (
            // Madde 2026-08-27 (1): admin'deki taslak butonlar YATAY sıralanır
            // — Hızlı Erişim'deki (AltKonuWalkthrough) dikey sütun BUNDAN AYRI,
            // değişmedi.
            <div className="flex flex-row flex-wrap gap-1.5">
              {draftSteps.map((s, i) => {
                const isActive = activeIdx === i;
                return (
                  <button key={s.id} type="button"
                    aria-label={`${i + 1}. buton`}
                    aria-pressed={isActive}
                    onClick={() => setActiveIdx(i)}
                    className="flex items-center justify-center rounded-full font-bold text-sm flex-shrink-0"
                    style={{
                      width: 32, height: 32,
                      border: isActive ? '2px solid rgb(34 211 238)' : '2px solid rgba(255,255,255,0.4)',
                      background: isActive ? 'rgba(34,211,238,0.15)' : 'transparent',
                      color: isActive ? 'rgb(165 243 252)' : undefined,
                    }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {active && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <BoardEditor
              fen={active.fen} turn={active.turn}
              onChange={(fen) => updateActive({ fen })}
              onTurnChange={(turn) => updateActive({ turn })}
              paletteLayout="split"
            />
            <textarea value={active.sentence} onChange={(e) => updateActive({ sentence: e.target.value })}
              placeholder="Bu konumla ilgili açıklama cümlesi" rows={2} className="neon-input text-sm" />
          </div>
        )}

        {/* Madde 2026-08-27 (5): Analiz Et / Konumu Kaydet / Havuza Ekle AYNI
            yatay satırda — Kaydet sadece aktif adım varken, Havuza Ekle
            taslakta en az bir adım varken görünür. */}
        {(active || draftSteps.length > 0) && (
          <div className="flex flex-wrap items-start gap-2 pt-2 border-t border-white/10">
            {active && <PositionAnalysisPanel fen={active.fen} />}
            {active && (
              <button type="button" onClick={saveActiveStep}
                className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm transition-colors">
                Konumu Kaydet
              </button>
            )}
            {draftSteps.length > 0 && (
              <button type="button" onClick={addToPool} disabled={busy}
                className="px-4 py-2 rounded-lg bg-amber-400/15 text-amber-200 border border-amber-400/50 hover:bg-amber-400/25 disabled:opacity-40 text-sm transition-colors">
                Havuza Ekle ({draftSteps.length} adım, tek kod ile)
              </button>
            )}
          </div>
        )}
        {err && <p className="text-rose-400 text-xs">{err}</p>}
      </div>
    </div>
  );
}

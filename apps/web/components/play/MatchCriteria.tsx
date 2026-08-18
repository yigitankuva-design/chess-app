'use client';
import { useState } from 'react';
import { LEVELS, LEVEL_GROUPS, TIME_GROUPS } from '@/lib/play/levels';
import type { PlayLevel } from '@/lib/play/levels';
import { COLOR_CHOICES } from '@/lib/play/color';
import type { ColorChoice } from '@/lib/play/color';
import type { TimeControl } from '@/components/BotGame';

export interface MatchCriteriaValue {
  level: PlayLevel;
  timeControl: TimeControl;
  colorChoice: ColorChoice;
}

interface Props {
  onStart: (value: MatchCriteriaValue) => void;
  /** Başlatma butonunun metni ("Maça Başla" / "Teklif Gönder" / "Pratiğe Başla"). */
  startLabel: string;
  /**
   * Düzey (1-8) satırı gösterilsin mi? Bota karşı ANLAMLI, insana karşı
   * DEĞİL (madde 7) — arkadaşa karşı akışlarda false geçilir.
   * false iken düzey LEVELS[0]'da sabit kalır ve gönderilir; alan
   * MatchCriteriaValue'da durmaya devam eder (çağıranlar kırılmaz).
   */
  showLevel?: boolean;
  /**
   * Pratik Yap akışlarında (Kazanç Konumu, Oyunsonu, Açılış Pratiği) 10
   * düzey yerine 3 gruplu (Kolay/Orta/Zor) seçim gösterir. "Bota Karşı
   * Oyna" gerçek maçında geçilmez, orada tam 10 düzey kalır.
   */
  simplifiedLevels?: boolean;
}

/** Üç yatay sıra (madde 5): 1) Düzey  2) Tempo/Süre + Renk  3) Maça Başla.
 *  Adımlar SIRAYLA açılır: düzey seçilmeden tempo, tempo seçilmeden başlat. */
export function MatchCriteria({ onStart, startLabel, showLevel = true, simplifiedLevels = false }: Props) {
  /**
   * null = HENÜZ SEÇİLMEDİ. Varsayılan LEVELS[0] verilseydi 1. adım daha
   * başlarken tamamlanmış sayılır ve sıralı kilit işlevsiz kalırdı.
   */
  const [level, setLevel] = useState<PlayLevel | null>(null);
  const [tc, setTc] = useState<TimeControl | null>(null);
  const [colorChoice, setColorChoice] = useState<ColorChoice>('random');

  // Düzey gösterilmiyorsa o adım kendiliğinden tamam sayılır.
  const levelDone = !showLevel || level !== null;
  const effectiveLevel = level ?? LEVELS[0];

  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  });

  return (
    <div className="space-y-4">
      {/* ── 1. YATAY SIRA: Düzey ── */}
      {showLevel && simplifiedLevels && (
        <div className="t-card-i p-4 space-y-3">
          <p className="text-xs font-semibold t-muted uppercase tracking-wide">
            1. Düzey Seç
          </p>
          <div className="grid grid-cols-3 gap-2">
            {LEVEL_GROUPS.map((g) => {
              const active = level?.level === g.level.level;
              return (
                <button key={g.label} type="button" onClick={() => setLevel(g.level)}
                  className="py-3 rounded-xl text-sm font-bold transition-all"
                  style={{
                    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--t-accent) 15%, transparent)'
                      : 'var(--t-surface)',
                    color: active ? 'var(--t-accent)' : 'var(--t-text)',
                  }}>
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showLevel && !simplifiedLevels && (
        <div className="t-card-i p-4 space-y-3">
          <p className="text-xs font-semibold t-muted uppercase tracking-wide">
            1. Düzey Seç <span className="normal-case">(1 en kolay · 10 en zor)</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {LEVELS.map((l) => {
              const active = level?.level === l.level;
              return (
                <button key={l.level} type="button" onClick={() => setLevel(l)}
                  aria-label={`Düzey ${l.level}`}
                  className="flex items-center justify-center rounded-full font-bold transition-all"
                  style={{
                    width: 44, height: 44, fontSize: '1.05rem',
                    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--t-accent) 15%, transparent)'
                      : 'var(--t-surface)',
                    color: active ? 'var(--t-accent)' : 'var(--t-text)',
                  }}>
                  {l.level}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. YATAY SIRA: Tempo/Süre + Renk (düzey seçilmeden kilitli) ── */}
      <div className="t-card-i p-4 space-y-4"
        style={{ opacity: levelDone ? 1 : 0.45, pointerEvents: levelDone ? 'auto' : 'none' }}
        aria-disabled={!levelDone}>
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">
          {showLevel ? '2. ' : ''}Tempo ve Süre Seç
        </p>
        {TIME_GROUPS.map((g) => (
          <div key={g.cat} className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wide flex items-center gap-1.5">
              <span>{g.emoji}</span> {g.cat}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((item) => (
                <button key={item.label} type="button" onClick={() => setTc(item)}
                  className="py-3 rounded-xl text-sm font-bold transition-all"
                  style={pill(tc?.label === item.label)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <p className="text-xs font-semibold t-muted uppercase tracking-wide">Renk</p>
          <div className="grid grid-cols-3 gap-2">
            {COLOR_CHOICES.map((c) => (
              <button key={c.value} type="button" onClick={() => setColorChoice(c.value)}
                className="py-3 rounded-xl text-sm font-bold transition-all"
                style={pill(colorChoice === c.value)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. YATAY SIRA: Başlat ── */}
      <button
        type="button"
        disabled={!tc || !levelDone}
        onClick={() => {
          if (tc && levelDone) {
            onStart({ level: effectiveLevel, timeControl: tc, colorChoice });
          }
        }}
        className="w-full py-3.5 rounded-xl text-base font-bold transition-all shadow-sm disabled:opacity-40"
        style={{ background: 'var(--t-accent)', color: '#fff' }}
      >
        ▶️ {startLabel}{tc ? ` (${tc.label})` : ''}
      </button>
    </div>
  );
}

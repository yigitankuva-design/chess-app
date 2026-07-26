'use client';
import { useState } from 'react';
import { LEVELS, TIME_GROUPS } from '@/lib/play/levels';
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
  /** Başlatma butonunun metni ("Oyuna Başla" / "Teklif Gönder" / "Pratiğe Başla"). */
  startLabel: string;
}

/** Düzey (1-8) + Tempo + Renk seçimi. Bota Karşı, Arkadaşla ve Açılış
 *  Pratiği akışlarının üçünde de aynen kullanılır (DRY). */
export function MatchCriteria({ onStart, startLabel }: Props) {
  const [level, setLevel] = useState<PlayLevel>(LEVELS[0]);
  const [tc, setTc] = useState<TimeControl | null>(null);
  const [colorChoice, setColorChoice] = useState<ColorChoice>('random');

  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Düzey (1 en kolay · 8 en zor)</p>
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map((l) => (
            <button key={l.level} type="button" onClick={() => setLevel(l)}
              className="py-3 rounded-xl text-sm font-bold transition-all"
              style={pill(level.level === l.level)}>
              Düzey {l.level}
            </button>
          ))}
        </div>
      </div>

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

      <button
        type="button"
        disabled={!tc}
        onClick={() => { if (tc) onStart({ level, timeControl: tc, colorChoice }); }}
        className="w-full py-3.5 rounded-xl text-base font-bold transition-all shadow-sm disabled:opacity-40"
        style={{ background: 'var(--t-accent)', color: '#fff' }}
      >
        ▶️ {startLabel}{tc ? ` (${tc.label})` : ''}
      </button>
    </div>
  );
}

'use client';
import { useState } from 'react';
import type { PlayLevel } from '@/lib/play/levels';
import { COLOR_CHOICES } from '@/lib/play/color';
import type { ColorChoice } from '@/lib/play/color';
import type { TimeControl } from '@/components/BotGame';
import { useSettings } from '@/lib/settings/settings-context';

export interface MatchCriteriaValue {
  level: PlayLevel;
  timeControl: TimeControl;
  colorChoice: ColorChoice;
  /** Madde 6 (2026-08-20): "Oyun Modu" — yalnızca showRatedMode=true iken
   *  gerçek bir seçim; aksi halde her zaman false (bota karşı anlamsız). */
  rated: boolean;
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
  /**
   * Renk (Beyaz/Rastgele/Siyah) satırı gösterilsin mi? Pratik Yap
   * akışlarında (Kazanç Konumu, Oyunsonu) false geçilir (madde 5,
   * 2026-08-19) — renk seçimi kaldırılır ama colorChoice hâlâ varsayılan
   * 'random' ile MatchCriteriaValue'da döner (çağıranlar kırılmaz).
   */
  showColor?: boolean;
  /**
   * Madde 6 (2026-08-20): "Oyun Modu: Puanlı/Puansız" satırı gösterilsin mi?
   * Yalnızca Arkadaşınla Oyna/Turnuvaya Katıl akışlarında true — bota karşı
   * maçta Performans Puanı hiç değişmediği için (madde 5) anlamsız.
   */
  showRatedMode?: boolean;
}

/** AYRI kartlar (madde: 2026-08-20) — Düzey, Tempo ve Süre, Renk (ve varsa
 *  Oyun Modu) her biri KENDİ kartında, sırayla açılır: bir önceki adım
 *  tamamlanmadan sonraki kart kilitlidir (opacity+pointer-events). Numaralar
 *  hangi kartların gösterildiğine göre DİNAMİK hesaplanır (showLevel/
 *  showColor/showRatedMode false ise o kart hiç yer kaplamaz, sıra kayar). */
export function MatchCriteria({
  onStart, startLabel, showLevel = true, simplifiedLevels = false, showColor = true,
  showRatedMode = false,
}: Props) {
  const { settings } = useSettings();
  const levels = settings.play.levels;
  const timeGroups = settings.play.timeGroups;
  /** Madde 2026-08-18/19: Pratik Yap'ta 10 düzey yerine 3 gruplu (Kolay/Orta/
   *  Zor) seçim — admin'in düzenlediği listeden AYNI sabit indekslerle türetilir. */
  const levelGroups = [
    { label: 'Kolay', level: levels[0] },
    { label: 'Orta', level: levels[4] },
    { label: 'Zor', level: levels[9] },
  ];

  /**
   * null = HENÜZ SEÇİLMEDİ. Varsayılan levels[0] verilseydi 1. adım daha
   * başlarken tamamlanmış sayılır ve sıralı kilit işlevsiz kalırdı.
   */
  const [level, setLevel] = useState<PlayLevel | null>(null);
  const [tc, setTc] = useState<TimeControl | null>(null);
  const [colorChoice, setColorChoice] = useState<ColorChoice>('random');
  const [rated, setRated] = useState(true);

  // Düzey gösterilmiyorsa o adım kendiliğinden tamam sayılır.
  const levelDone = !showLevel || level !== null;
  const tempoDone = levelDone && tc !== null;
  const effectiveLevel = level ?? levels[0];

  let step = 1;
  const levelStep = showLevel ? step++ : null;
  const tempoStep = step++;
  const colorStep = showColor ? step++ : null;
  const ratedStep = showRatedMode ? step++ : null;

  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  });

  const cardStyle = (unlocked: boolean): React.CSSProperties => ({
    opacity: unlocked ? 1 : 0.45,
    pointerEvents: unlocked ? 'auto' : 'none',
  });

  return (
    <div className="space-y-4">
      {/* ── Kart: Düzey Seç ── */}
      {showLevel && simplifiedLevels && (
        <div className="t-card-i p-4 space-y-3">
          <p className="text-xs font-semibold t-muted uppercase tracking-wide">
            {levelStep}. Düzey Seç
          </p>
          <div className="grid grid-cols-3 gap-2">
            {levelGroups.map((g) => {
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
            {levelStep}. Düzey Seç <span className="normal-case">(1 en kolay · 10 en zor)</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {levels.map((l) => {
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

      {/* ── Kart: Tempo ve Süre Seç (düzey seçilmeden kilitli) ── */}
      <div className="t-card-i p-4 space-y-4" style={cardStyle(levelDone)} aria-disabled={!levelDone}>
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">
          {tempoStep}. Tempo ve Süre Seç
        </p>
        {timeGroups.map((g) => (
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
      </div>

      {/* ── Kart: Renk Seç (tempo seçilmeden kilitli) ── */}
      {showColor && (
        <div className="t-card-i p-4 space-y-3" style={cardStyle(tempoDone)} aria-disabled={!tempoDone}>
          <p className="text-xs font-semibold t-muted uppercase tracking-wide">
            {colorStep}. Renk Seç
          </p>
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
      )}

      {/* ── Kart: Oyun Modu (tempo seçilmeden kilitli) ── */}
      {showRatedMode && (
        <div className="t-card-i p-4 space-y-3" style={cardStyle(tempoDone)} aria-disabled={!tempoDone}>
          <p className="text-xs font-semibold t-muted uppercase tracking-wide">
            {ratedStep}. Oyun Modu
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRated(true)}
              className="py-3 rounded-xl text-sm font-bold transition-all"
              style={pill(rated)}>
              🏆 Puanlı
            </button>
            <button type="button" onClick={() => setRated(false)}
              className="py-3 rounded-xl text-sm font-bold transition-all"
              style={pill(!rated)}>
              Puansız
            </button>
          </div>
        </div>
      )}

      {/* ── Başlat ── */}
      <button
        type="button"
        disabled={!tc || !levelDone}
        onClick={() => {
          if (tc && levelDone) {
            onStart({ level: effectiveLevel, timeControl: tc, colorChoice, rated: showRatedMode ? rated : false });
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

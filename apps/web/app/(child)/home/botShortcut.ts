import { LEVELS, TIME_GROUPS } from '@/lib/play/levels';

/**
 * Ana sayfadaki "Bota Karşı Oyna" kısayolu, /play sayfasıyla AYNI zorluk ve
 * tempo listesini kullanmak zorunda — aksi halde ürettiği
 * `/play?skill=..&tc=..` linki /play tarafında bulunamaz ve oyun doğrudan
 * başlamaz. Bu yüzden iki kopya yerine tek kaynaktan türetiliyor.
 */
export const HOME_BOT_LEVELS = LEVELS.map((l) => ({
  label: `Düzey ${l.level}`,
  skill: l.skill,
  depth: l.depth,
  bars: l.level,
}));

/** Tempo kategorileri — "Süresiz" KASTEN yok (madde g). */
export const HOME_TEMPO_GROUPS: { cat: string; color: string; items: string[] }[] =
  TIME_GROUPS.map((g, i) => ({
    cat: g.cat,
    color: ['#fbbf24', '#38bdf8', '#2dd4bf'][i] ?? '#a78bfa',
    items: g.items.map((t) => t.label),
  }));

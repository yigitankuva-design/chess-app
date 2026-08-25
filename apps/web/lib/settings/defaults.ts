// Sporcu paneli global ayarları — tip + varsayılanlar + derin birleştirme.
// Sunucudan gelen ayar eksik/boşsa bu varsayılanlar (bugünkü görünüm) kullanılır (fail-safe).
import { LEVELS, TIME_GROUPS } from '@/lib/play/levels';
import type { PlayLevel } from '@/lib/play/levels';
import type { TimeControl } from '@/components/BotGame';

export interface PlayTimeGroup {
  cat: string;
  emoji: string;
  items: TimeControl[];
}

export interface AppSettingsData {
  labels: {
    levels: Record<string, string>;      // "1".."4"
    features: { play: string; lessons: string; analiz: string; eglence: string };
    sections: { quickAccess: string; lessonsPick: string };
    /**
     * 4 sabit Hızlı Erişim sekmesinin ikon havuzundan seçilmiş ikonu
     * (madde 1, 2026-08-19). Boş string = admin hiç seçmedi, sporcu tarafı
     * eski sabit çizgi-ikonlara (kılıç/kitap/büyüteç/yapboz) düşer.
     */
    icons: { play: string; lessons: string; analiz: string; eglence: string };
  };
  tabs: { play: boolean; lessons: boolean; analiz: boolean; eglence: boolean };
  /** Sekmelerin sporcu ekranındaki sırası (admin sürükleyip değiştirebilir). */
  tabOrder: TabKey[];
  board: {
    lightSquare: string;
    darkSquare: string;
    pieces: Record<string, string>;      // wK..bP → data-URI; yoksa gömülü SVG
  };
  /**
   * Madde 2026-09-05 (2+5): Maç Yap ayarları admin'den düzenlenebilir.
   * `levels` 10 SABİT eleman sayısında kalır (Kolay/Orta/Zor grupları
   * [0]/[4]/[9] indekslerine bağlı) — admin yalnızca skill/depth/blunderChance
   * düzenler, eleman ekleyip çıkaramaz. `timeGroups`'un 3 kategorisi
   * (Yıldırım/Hızlı/Klasik) SABİT kalır, admin yalnızca içindeki süre
   * seçeneklerini (item) ekleyip/kaldırıp/düzenleyebilir.
   */
  play: {
    levels: PlayLevel[];
    timeGroups: PlayTimeGroup[];
    tournamentDefaults: { roundsTotal: number; timeControlLabel: string; rated: boolean };
  };
  /**
   * Madde 2026-09-05 (3): Analiz Et'in 3 alt özelliği admin'den ayrı ayrı
   * gösterilip gizlenebilir — AnalizPanel.tsx'teki SUB_TABS ile aynı sıra
   * (matches="Maçlarımın Analizi", freePlay="Yeni Analiz", position="Konum Analizi").
   */
  analizFeatures: { matches: boolean; freePlay: boolean; position: boolean };
}

export type TabKey = 'play' | 'lessons' | 'analiz' | 'eglence';

/** Uygulamada içeriği olan sekmeler — admin bunları ekleyip/kaldırıp sıralayabilir. */
export const ALL_TABS: TabKey[] = ['play', 'lessons', 'analiz', 'eglence'];

export const DEFAULT_SETTINGS: AppSettingsData = {
  labels: {
    levels: { '1': 'Temel Düzey', '2': 'Başlangıç Düzeyi', '3': 'Orta Düzey', '4': 'İleri Düzey' },
    features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz Et', eglence: 'Eğlence' },
    sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Dersler — Düzey Seç' },
    icons: { play: '', lessons: '', analiz: '', eglence: '' },
  },
  tabs: { play: true, lessons: true, analiz: true, eglence: true },
  tabOrder: ['play', 'lessons', 'analiz', 'eglence'],
  board: {
    lightSquare: '#eef0fb',
    darkSquare: '#c3c6ee',
    pieces: {},
  },
  play: {
    levels: LEVELS.map((l) => ({ ...l })),
    timeGroups: TIME_GROUPS.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) })),
    tournamentDefaults: { roundsTotal: 4, timeControlLabel: '10+0', rated: true },
  },
  analizFeatures: { matches: true, freePlay: true, position: true },
};

/**
 * Sporcu ekranında gösterilecek sekmeleri, admin sırasına göre döndürür.
 * Fail-safe: tabOrder eksik/bozuksa varsayılan sıraya düşer, sırada olmayan
 * sekmeler sona eklenir (hiçbir sekme sessizce kaybolmaz).
 */
export function visibleTabsInOrder(s: AppSettingsData): TabKey[] {
  const raw = Array.isArray(s.tabOrder) ? s.tabOrder : [];
  const order = raw.filter((t): t is TabKey => ALL_TABS.includes(t as TabKey));
  const complete = [...order, ...ALL_TABS.filter((t) => !order.includes(t))];
  return complete.filter((t) => s.tabs?.[t] !== false);
}

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** remote'u DEFAULT üstüne derin birleştirir; eksik alanlar varsayılanda kalır. */
export function mergeSettings(remote: unknown): AppSettingsData {
  function merge(base: Json, inc: Json): Json {
    const out: Json = { ...base };
    for (const [k, v] of Object.entries(inc)) {
      if (isObj(v) && isObj(out[k])) out[k] = merge(out[k] as Json, v);
      else if (v !== undefined && v !== null) out[k] = v;
    }
    return out;
  }
  const base = DEFAULT_SETTINGS as unknown as Json;
  const merged = isObj(remote) ? merge(base, remote) : base;
  return merged as unknown as AppSettingsData;
}

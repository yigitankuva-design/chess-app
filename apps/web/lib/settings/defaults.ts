// Sporcu paneli global ayarları — tip + varsayılanlar + derin birleştirme.
// Sunucudan gelen ayar eksik/boşsa bu varsayılanlar (bugünkü görünüm) kullanılır (fail-safe).

export interface AppSettingsData {
  labels: {
    levels: Record<string, string>;      // "1".."4"
    features: { play: string; lessons: string; analiz: string; eglence: string };
    sections: { quickAccess: string; lessonsPick: string };
  };
  tabs: { play: boolean; lessons: boolean; analiz: boolean; eglence: boolean };
  /** Sekmelerin sporcu ekranındaki sırası (admin sürükleyip değiştirebilir). */
  tabOrder: TabKey[];
  board: {
    lightSquare: string;
    darkSquare: string;
    pieces: Record<string, string>;      // wK..bP → data-URI; yoksa gömülü SVG
  };
}

export type TabKey = 'play' | 'lessons' | 'analiz' | 'eglence';

/** Uygulamada içeriği olan sekmeler — admin bunları ekleyip/kaldırıp sıralayabilir. */
export const ALL_TABS: TabKey[] = ['play', 'lessons', 'analiz', 'eglence'];

export const DEFAULT_SETTINGS: AppSettingsData = {
  labels: {
    levels: { '1': 'Temel Düzey', '2': 'Başlangıç Düzeyi', '3': 'Orta Düzey', '4': 'İleri Düzey' },
    features: { play: 'Maç Yap', lessons: 'Dersler', analiz: 'Analiz Et', eglence: 'Eğlence' },
    sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Dersler — Düzey Seç' },
  },
  tabs: { play: true, lessons: true, analiz: true, eglence: true },
  tabOrder: ['play', 'lessons', 'analiz', 'eglence'],
  board: {
    lightSquare: '#eef0fb',
    darkSquare: '#c3c6ee',
    pieces: {},
  },
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

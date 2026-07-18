// Sporcu paneli global ayarları — tip + varsayılanlar + derin birleştirme.
// Sunucudan gelen ayar eksik/boşsa bu varsayılanlar (bugünkü görünüm) kullanılır (fail-safe).

export interface AppSettingsData {
  labels: {
    levels: Record<string, string>;      // "1".."4"
    features: { play: string; lessons: string; puzzle: string; badges: string };
    sections: { quickAccess: string; lessonsPick: string };
  };
  tabs: { play: boolean; puzzle: boolean; badges: boolean };
  board: {
    lightSquare: string;
    darkSquare: string;
    pieces: Record<string, string>;      // wK..bP → data-URI; yoksa gömülü SVG
  };
}

export const DEFAULT_SETTINGS: AppSettingsData = {
  labels: {
    levels: { '1': 'Temel Düzey', '2': 'Başlangıç Düzeyi', '3': 'Orta Düzey', '4': 'İleri Düzey' },
    features: { play: 'Oyna', lessons: 'Dersler', puzzle: 'Bulmaca', badges: 'Rozetler' },
    sections: { quickAccess: 'Hızlı Erişim', lessonsPick: 'Dersler — Düzey Seç' },
  },
  tabs: { play: true, puzzle: true, badges: true },
  board: {
    lightSquare: '#eef0fb',
    darkSquare: '#c3c6ee',
    pieces: {},
  },
};

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

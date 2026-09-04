import { hasPieces } from '@/lib/admin/movePieceSteps';
import type { StepInfo } from '@/lib/admin/movePieceSteps';

/**
 * b) Açılış Teorisini Hatırla (eski adıyla Teori Pratiği) sorusunun 7
 * adımlık akışının saf mantığı — madde 2026-09-06 (üçüncü tur/3): eski
 * "Talimatı Gir" adımı KALDIRILDI (Zafer onayı: sabit bir talimat kullanılır
 * — bkz. TEORI_PRATIGI_INSTRUCTION — geri kalan 7 adım DEĞİŞMEDEN kalır).
 * Kalan sıra: Konum Diz, Konumu Kaydet, Cevap Hamlelerini Yap ve Notasyon
 * Oluştur, Notasyonu Kaydet, Açılış veya Varyantın Adını Gir, Hamle Sırasını
 * Belirle, Soruyu Ekle. `movePieceSteps.ts`'teki "Taşı Oynat" akışıyla AYNI
 * setup/record/save fazlarını kullanır, üstüne açılış adı + sporcunun rengi
 * eklenir.
 */
export interface TeoriPratigiStepState {
  /** Adım 1 — dizme tahtasının FEN'i. */
  setupFen: string;
  /** Adım 2 — "Konumu Kaydet" sonrası kilitlenen konum; null = henüz kaydedilmedi. */
  fen: string | null;
  /** Adım 3 — kaydedilen SAN hamleleri. */
  moves: string[];
  /** Adım 4 — "Notasyonu Kaydet"e basıldı mı? */
  notationSaved: boolean;
  /** Adım 5 — açılış/varyant adı. */
  openingName: string;
  /**
   * Adım 6 — sporcunun rengi (Beyaz/Siyah) BİLFİİL seçildi mi? Varsayılan
   * bir renk olduğu için değere bakmak yetmez (movePieceSteps'teki
   * turnChosen tuzağıyla AYNI).
   */
  studentColorChosen: boolean;
}

/** Madde 2026-09-06 (üçüncü tur/3): admin artık talimat yazmıyor — sporcuya
 *  HER SORUDA aynı sabit talimat gösterilir (bkz. TeoriPratigiPractice.tsx). */
export const TEORI_PRATIGI_INSTRUCTION = 'Açılışın ilk hamlelerini oyna';

export const TEORI_PRATIGI_STEP_LABELS = [
  'Konum Diz',
  'Konumu Kaydet',
  'Cevap Hamlelerini Yap ve Notasyon Oluştur',
  'Notasyonu Kaydet',
  'Açılış veya Varyantın Adını Gir',
  'Hamle Sırasını Belirle',
] as const;

export function teoriPratigiSteps(s: TeoriPratigiStepState): StepInfo[] {
  const done = [
    hasPieces(s.setupFen),
    s.fen !== null,
    s.moves.length > 0,
    s.notationSaved,
    s.openingName.trim().length > 0,
    s.studentColorChosen,
  ];
  // "Soruyu Ekle" son satirdir: oncekilerin HEPSI bitince ✓.
  const all = [...done, done.every(Boolean)];
  return [...TEORI_PRATIGI_STEP_LABELS, 'Soruyu Ekle'].map((label, i) => ({ no: i + 1, label, done: all[i] }));
}

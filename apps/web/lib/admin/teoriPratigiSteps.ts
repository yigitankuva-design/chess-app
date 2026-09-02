import { hasPieces } from '@/lib/admin/movePieceSteps';
import type { StepInfo } from '@/lib/admin/movePieceSteps';

/**
 * b) Teori Pratiği sorusunun 8 adımlık akışının saf mantığı — Zafer'in
 * belirttiği sırayla: Talimatı Gir, Konum Diz, Konumu Kaydet, Cevap
 * Hamlelerini Yap ve Notasyon Oluştur, Notasyonu Kaydet, Açılış veya
 * Varyantın Adını Gir, Hamle Sırasını Belirle, Soruyu Ekle.
 * `movePieceSteps.ts`'teki "Taşı Oynat" akışıyla AYNI setup/record/save
 * fazlarını kullanır, üstüne açılış adı + sporcunun rengi eklenir.
 */
export interface TeoriPratigiStepState {
  instruction: string;
  /** Adım 2 — dizme tahtasının FEN'i. */
  setupFen: string;
  /** Adım 3 — "Konumu Kaydet" sonrası kilitlenen konum; null = henüz kaydedilmedi. */
  fen: string | null;
  /** Adım 4 — kaydedilen SAN hamleleri. */
  moves: string[];
  /** Adım 5 — "Notasyonu Kaydet"e basıldı mı? */
  notationSaved: boolean;
  /** Adım 6 — açılış/varyant adı. */
  openingName: string;
  /**
   * Adım 7 — sporcunun rengi (Beyaz/Siyah) BİLFİİL seçildi mi? Varsayılan
   * bir renk olduğu için değere bakmak yetmez (movePieceSteps'teki
   * turnChosen tuzağıyla AYNI).
   */
  studentColorChosen: boolean;
}

export const TEORI_PRATIGI_STEP_LABELS = [
  'Talimatı Gir',
  'Konum Diz',
  'Konumu Kaydet',
  'Cevap Hamlelerini Yap ve Notasyon Oluştur',
  'Notasyonu Kaydet',
  'Açılış veya Varyantın Adını Gir',
  'Hamle Sırasını Belirle',
] as const;

export function teoriPratigiSteps(s: TeoriPratigiStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
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

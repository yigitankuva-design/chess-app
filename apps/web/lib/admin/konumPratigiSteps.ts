import type { StepInfo } from '@/lib/admin/movePieceSteps';

/**
 * a) Açılışı Tahmin Et (eski adıyla Konum Pratiği) sorusunun 5 adımlık
 * akışının saf mantığı — madde 2026-09-06 (üçüncü tur/2): eski "Talimatı
 * Gir" adımı KALDIRILDI (Zafer onayı: tüm sorular SABİT bir talimat
 * paylaşır, admin artık tek tek yazmaz — bkz. KONUM_PRATIGI_INSTRUCTION).
 * Kalan sıra: FEN Ekle, Seçenek Sayısını Belirle, Cevap Tipini Belirle,
 * Cevapları Gir, Soruyu Ekle. `questionSteps.ts`'teki `choiceSteps` ile
 * AYNI desen, ama FEN burada ZORUNLU (generic sentence_question'da
 * opsiyoneldi) ve zorluk/yazı-şekil-renk adımları YOK — Zafer bunları bu
 * özellik için istemedi (KURAL #2, kapsam dışına çıkma).
 */
export interface KonumPratigiStepState {
  /** FEN metni geçerli bir konuma çözülüyor mu (bkz. lib/chess/fenInput.ts). */
  fenValid: boolean;
  /** "Belirle" adımı BİLFİİL tıklandı mı — varsayılana bakmak kilidi işlevsiz bırakır. */
  optionCountChosen: boolean;
  answerKindChosen: boolean;
  options: string[];
}

/** Madde 2026-09-06 (üçüncü tur/2): admin artık talimat yazmıyor — sporcuya
 *  HER SORUDA aynı sabit talimat gösterilir (bkz. KonumPratigiPractice.tsx). */
export const KONUM_PRATIGI_INSTRUCTION = 'Bu konum hangi açılıştır?';

export function konumPratigiSteps(s: KonumPratigiStepState): StepInfo[] {
  const answersDone = s.options.length >= 2 && s.options.every((o) => o.trim().length > 0);
  const labels = [
    'FEN Ekle',
    'Seçenek Sayısını Belirle',
    'Cevap Tipini Belirle',
    'Cevapları Gir',
  ];
  const done = [
    s.fenValid,
    s.optionCountChosen,
    s.answerKindChosen,
    answersDone,
  ];
  // "Soruyu Ekle" son satirdir: oncekilerin HEPSI bitince ✓.
  const all = [...done, done.every(Boolean)];
  return [...labels, 'Soruyu Ekle'].map((label, i) => ({ no: i + 1, label, done: all[i] }));
}

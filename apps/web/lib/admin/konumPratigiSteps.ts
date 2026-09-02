import type { StepInfo } from '@/lib/admin/movePieceSteps';

/**
 * a) Konum Pratiği sorusunun 6 adımlık akışının saf mantığı — Zafer'in
 * belirttiği sırayla: Talimatı Gir, FEN Ekle, Seçenek Sayısını Belirle,
 * Cevap Tipini Belirle, Cevapları Gir, Soruyu Ekle. `questionSteps.ts`'teki
 * `choiceSteps` ile AYNI desen, ama FEN burada ZORUNLU (generic
 * sentence_question'da opsiyoneldi) ve zorluk/yazı-şekil-renk adımları
 * YOK — Zafer bunları bu özellik için istemedi (KURAL #2, kapsam dışına
 * çıkma).
 */
export interface KonumPratigiStepState {
  instruction: string;
  /** FEN metni geçerli bir konuma çözülüyor mu (bkz. lib/chess/fenInput.ts). */
  fenValid: boolean;
  /** "Belirle" adımı BİLFİİL tıklandı mı — varsayılana bakmak kilidi işlevsiz bırakır. */
  optionCountChosen: boolean;
  answerKindChosen: boolean;
  options: string[];
}

export function konumPratigiSteps(s: KonumPratigiStepState): StepInfo[] {
  const answersDone = s.options.length >= 2 && s.options.every((o) => o.trim().length > 0);
  const labels = [
    'Talimatı Gir',
    'FEN Ekle',
    'Seçenek Sayısını Belirle',
    'Cevap Tipini Belirle',
    'Cevapları Gir',
  ];
  const done = [
    s.instruction.trim().length > 0,
    s.fenValid,
    s.optionCountChosen,
    s.answerKindChosen,
    answersDone,
  ];
  // "Soruyu Ekle" son satirdir: oncekilerin HEPSI bitince ✓.
  const all = [...done, done.every(Boolean)];
  return [...labels, 'Soruyu Ekle'].map((label, i) => ({ no: i + 1, label, done: all[i] }));
}

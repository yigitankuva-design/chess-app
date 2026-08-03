import { hasPieces } from '@/lib/admin/movePieceSteps';
import type { StepInfo } from '@/lib/admin/movePieceSteps';

/**
 * "Taşa Tıkla" sorusunun 8 adımlık akışının saf mantığı.
 * Sıra kullanıcının verdiği sıradır (zorluk adımı sonradan onaylanarak eklendi).
 */
export interface ClickPieceStepState {
  instruction: string;
  setupFen: string;
  /** "Konumu Kaydet" sonrası kilitlenen konum; null = kaydedilmedi. */
  savedFen: string | null;
  /** Cevap taşlarının bulunduğu kareler. */
  pieceSquares: string[];
  /** "Taş Seçimini Kaydet"e basıldı mı? */
  answerSaved: boolean;
  /** Hamle sırasına BİLFİİL tıklandı mı (varsayılan Beyaz olduğu için şart). */
  turnChosen: boolean;
  /** Zorluk etiketine BİLFİİL tıklandı mı? */
  difficultyChosen: boolean;
}

export const CLICK_PIECE_STEP_LABELS = [
  'Talimatı Gir',
  'Konumu Diz',
  'Konumu Kaydet',
  'Cevap Taşlarını Seç',
  'Taş Seçimini Kaydet',
  'Hamle Sırasını Belirle',
  'Zorluk Düzeyini Belirle',
  'Yazı-Şekil-Renk Ekle',
] as const;

export function clickPieceSteps(s: ClickPieceStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    // Konum bilerek kaydedilmişse dizme adımı tamam sayılır (clickSquareSteps ile aynı kural).
    hasPieces(s.setupFen) || s.savedFen !== null,
    s.savedFen !== null,
    s.pieceSquares.length > 0,
    s.answerSaved,
    s.turnChosen,
    s.difficultyChosen,
    true, // Yazı-Şekil-Renk Ekle
  ];
  const all = [...done, done.every(Boolean)];
  return [...CLICK_PIECE_STEP_LABELS, 'Soruyu Ekle'].map((label, i) => ({
    no: i + 1, label, done: all[i],
  }));
}

import { hasPieces } from '@/lib/admin/movePieceSteps';
import type { StepInfo } from '@/lib/admin/movePieceSteps';
import type { PiecePlacement } from '@/lib/play/placePieces';

/**
 * "Taş Nerde?" sorusunun 9 adımlık akışının saf mantığı.
 *
 * Adım sırası kullanıcının verdiği sıradır — diğer iki tipte "Hamle Sırasını
 * Belirle" 3. sıradadır, burada 7. sıradadır (hamle sırası cevabı etkilemiyor).
 */
export interface PlacePiecesStepState {
  /** Adım 1 — talimat metni. */
  instruction: string;
  /** Adım 2 — dizme tahtasının FEN'i. */
  setupFen: string;
  /** Adım 3 — "Konumu Kaydet" sonrası kilitlenen konum; null = kaydedilmedi. */
  savedFen: string | null;
  /** Adım 4 — palette seçili ama karesi henüz tıklanmamış taş. */
  selectedPiece: string | null;
  /** Adım 5 — tamamlanmış taş/kare çiftleri. */
  pieces: PiecePlacement[];
  /** Adım 6 — "Cevabı Kaydet"e basıldı mı? */
  answerSaved: boolean;
  /**
   * Adım 7 — hamle sırasına BİLFİİL tıklandı mı? Varsayılan Beyaz olduğu için
   * değere bakmak yetmez (movePieceSteps'teki aynı tuzak).
   */
  turnChosen: boolean;
  /** Adım 8 — zorluk etiketine BİLFİİL tıklandı mı? */
  difficultyChosen: boolean;
}

export const PLACE_PIECES_STEP_LABELS = [
  'Talimatı Gir',
  'Konumu Diz',
  'Konumu Kaydet',
  'Konuma Eklenecek Taşları Belirle',
  'Taşların Doğru Karelerini Belirle',
  'Cevabı Kaydet',
  'Hamle Sırasını Belirle',
  'Zorluk Düzeyini Belirle',
] as const;

export function placePiecesSteps(s: PlacePiecesStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    // BOŞ TAHTA MEŞRUDUR (clickSquareSteps ile aynı kural): konum bilerek
    // kaydedilmişse dizme adımı tamam sayılır.
    hasPieces(s.setupFen) || s.savedFen !== null,
    s.savedFen !== null,
    s.selectedPiece !== null || s.pieces.length > 0,
    s.pieces.length > 0,
    s.answerSaved,
    s.turnChosen,
    s.difficultyChosen,
  ];
  // "Soruyu Ekle" son satırdır: öncekilerin HEPSİ bitince ✓.
  const all = [...done, done.every(Boolean)];
  return [...PLACE_PIECES_STEP_LABELS, 'Soruyu Ekle'].map((label, i) => ({
    no: i + 1, label, done: all[i],
  }));
}

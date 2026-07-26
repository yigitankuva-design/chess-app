import { notationRows } from '@/lib/chess/moveRecorder';

/**
 * Taşı Oynat sorusunun 6 adımlık akışının saf mantığı.
 * React'ten bağımsızdır — doğrudan test edilir (mevcut desen: lib/practice/scoring.ts).
 */
export interface MovePieceStepState {
  /** Adım 1 — talimat metni. */
  instruction: string;
  /** Adım 2 — dizme tahtasının FEN'i (üst bileşen sahibi, bkz. MovePieceFields). */
  setupFen: string;
  /** Adım 3 — "Konumu Kaydet" sonrası kilitlenen konum; null = henüz kaydedilmedi. */
  moveFen: string | null;
  /** Adım 4 — kaydedilen SAN hamleleri. */
  moves: string[];
  /** Adım 5 — "Notasyonu Kaydet"e basıldı mı? */
  notationSaved: boolean;
  /**
   * Adım 6 — zorluk etiketine BİLFİİL tıklandı mı?
   * `difficulty` state'i varsayılan 1 olduğu için sayıya bakmak yetmez; bakılsa
   * adım hiç tıklanmadan tamamlanmış görünür ve kilit işlevsiz kalır.
   */
  difficultyChosen: boolean;
}

export interface StepInfo {
  no: number;
  label: string;
  done: boolean;
}

export const MOVE_PIECE_STEP_LABELS = [
  'Talimat Ekle',
  'Konum Diz',
  'Konumu Kaydet',
  'Cevap Hamlelerini Yap ve Notasyon Oluştur',
  'Notasyonu Kaydet',
  'Zorluk Düzeyinin Seçimini Yap',
] as const;

/**
 * FEN'in tahta alanında en az bir taş var mı?
 * EMPTY_FEN sabitiyle karşılaştırmak yerine tahta alanı taranır — sıra/rok/hamle
 * alanları farklı olan boş tahtalar da doğru biçimde "boş" sayılır. Ayrıca bu
 * fonksiyon BoardEditor bileşenine bağımlı olmaz (saf modül kalır).
 */
export function hasPieces(fen: string): boolean {
  const board = fen.split(' ')[0] ?? '';
  return /[a-zA-Z]/.test(board);
}

export function movePieceSteps(s: MovePieceStepState): StepInfo[] {
  const done = [
    s.instruction.trim().length > 0,
    hasPieces(s.setupFen),
    s.moveFen !== null,
    s.moves.length > 0,
    s.notationSaved,
    s.difficultyChosen,
  ];
  return MOVE_PIECE_STEP_LABELS.map((label, i) => ({ no: i + 1, label, done: done[i] }));
}

export function firstIncompleteStep(s: MovePieceStepState): StepInfo | null {
  return movePieceSteps(s).find((st) => !st.done) ?? null;
}

export function allStepsDone(s: MovePieceStepState): boolean {
  return firstIncompleteStep(s) === null;
}

/**
 * SAN hamlelerini tek satırlık okunur notasyona çevirir ("1. Rh4 Kf8 2. Rh8").
 * Satırlara bölme işini mevcut `notationRows` yapar (DRY) — siyahın başladığı
 * konumlarda ilk satırın beyaz hücresini boş bırakma davranışı orada zaten doğru.
 */
export function formatNotation(fen: string, moves: string[]): string {
  if (moves.length === 0) return '';
  return notationRows(fen, moves)
    .map((r) => (r.white
      ? `${r.no}. ${r.white}${r.black ? ` ${r.black}` : ''}`
      : `${r.no}... ${r.black}`))
    .join(' ');
}
